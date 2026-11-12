// "Records fill themselves": turn a finished slot (with its task outcomes)
// into CRM updates — activities, product interest, upsells, products signed,
// stage changes, contacts, action points, points and an audit entry.
// Pure function: the App applies the result to its state and storage.

import { stageTracking } from '../../../utils/stageTracking';
import {
  Activity,
  AuditLogRecord,
  Contact,
  Dealership,
  DealershipProductInterest,
  GameRule,
  PipelineStage,
  PointsLedgerEntry,
  ProductBonus,
  ProductCatalogItem,
  UpsellOpportunity,
  User
} from '../../../types/crm';
import { ActionPoint, PlanSlot, SlotTask } from '../types';
import { HOW_LABEL, TASK_BY_ID, isLive } from '../engine/tasks';
import { toMin } from '../engine/time';

export interface WritebackInput {
  slot: PlanSlot;
  user: User;
  dealerships: Dealership[];
  catalog: ProductCatalogItem[];
  gameRules: GameRule[];
  productBonuses: ProductBonus[];
  /** Start time the slot actually happened (HH:MM), for the 10–4 check. */
  startedAt?: string;
  now: string;
  acceptedStageChanges?: Record<string, PipelineStage>;
  newContacts?: Contact[];
  extraActionPoints?: ActionPoint[];
  /** What happens next (saved on the CRM activity so every screen can see it). */
  nextStep?: { action: string; date?: string; time?: string };
  /** The rep chose not to plan a next step, and why. */
  nextSkipped?: { reason: 'waiting' | 'not_now' | 'none'; label: string; nurtureDate?: string };
}

export interface WritebackResult {
  activities: Activity[];
  dealershipUpdates: Dealership[];
  newContacts: Contact[];
  actionPoints: ActionPoint[];
  points: PointsLedgerEntry[];
  audit: AuditLogRecord[];
  totalPoints: number;
}

const ACTIVITY_TYPE: Record<PlanSlot['how'], Activity['activityType']> = {
  in_person: 'In-Person Visit',
  phone: 'Phone Call',
  meet: 'Google Meet',
  email: 'Email',
  text: 'Text Message'
};

const COMM_TYPE: Record<PlanSlot['how'], Activity['communicationType']> = {
  in_person: 'In-Person',
  phone: 'Phone',
  meet: 'Virtual',
  email: 'Email',
  text: 'Phone'
};

let idCounter = 0;
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

function bonusFor(
  productId: string,
  kind: ProductBonus['actionTypes'][number],
  user: User,
  bonuses: ProductBonus[],
  today: string
): ProductBonus | undefined {
  return bonuses.find(
    b =>
      b.isActive &&
      b.productId === productId &&
      b.actionTypes.includes(kind) &&
      b.startDate <= today &&
      b.endDate >= today &&
      (b.targetType === 'all' ||
        (b.targetType === 'region' && b.targetValue === user.region) ||
        (b.targetType === 'rep' && b.targetValue === user.id) ||
        b.targetType === 'team')
  );
}

/** Estimated points for planning a slot (shown on cards). */
export function estimatePoints(slot: Pick<PlanSlot, 'how' | 'fixedTime'>, rules: GameRule[]): number {
  const action = contactActionType(slot.how, slot.fixedTime ?? '11:00');
  return rules.find(r => r.actionType === action && r.enabled)?.basePoints ?? 0;
}

function contactActionType(how: PlanSlot['how'], startedAt: string): string {
  if (how === 'in_person') {
    const t = toMin(startedAt);
    return t >= 600 && t <= 960 ? 'visit_good_window' : 'visit_bad_window';
  }
  if (how === 'phone') return 'phone_call';
  if (how === 'meet') return 'google_meet';
  return 'email_outreach';
}

export function describeTask(task: SlotTask, catalog: ProductCatalogItem[]): string {
  const def = TASK_BY_ID[task.taskId];
  const name = (id: string) => catalog.find(p => p.id === id)?.name ?? id;
  const label = def?.label ?? task.taskId;
  const o = task.outcome;
  if (!o) return label;
  switch (o.kind) {
    case 'simple': {
      const map = { done: 'done', follow_up: 'needs follow-up', not_now: 'not now', issue: 'issue to fix' };
      return `${label}: ${map[o.result]}`;
    }
    case 'interest':
      return `${label}: ${Object.entries(o.levels).map(([p, l]) => `${name(p)} ${l === 'None' ? 'not interested' : l.toLowerCase()}`).join(', ')}`;
    case 'upsell':
      return `${label}: ${Object.entries(o.results).map(([p, r]) => `${name(p)} ${r.toLowerCase()}`).join(', ')}`;
    case 'keyfetch':
      return o.needsRefill ? `${label}: refill needed (${o.quantity ?? 0} units)` : `${label}: stock OK`;
    case 'signed':
      return `${label}: ${o.productIds.map(name).join(', ') || 'no products'}`;
  }
}

export function buildWriteback(input: WritebackInput): WritebackResult {
  const { slot, user, catalog, gameRules, productBonuses, now } = input;
  const today = now.slice(0, 10);
  const userName = `${user.firstName} ${user.lastName}`;
  const startedAt = input.startedAt ?? slot.fixedTime ?? '11:00';
  const productName = (id: string) => catalog.find(p => p.id === id)?.name ?? id;

  const affectedIds =
    slot.target.kind === 'dealership'
      ? [slot.target.id]
      : slot.target.kind === 'group'
        ? slot.target.rooftopIds ?? []
        : [];
  const affected = input.dealerships.filter(d => affectedIds.includes(d.id));

  const points: PointsLedgerEntry[] = [];
  const award = (actionType: string, description: string, dealership?: { id: string; name: string }, productId?: string, bonusKind?: ProductBonus['actionTypes'][number]) => {
    const rule = gameRules.find(r => r.actionType === actionType);
    if (!rule || !rule.enabled) return;
    let pts = rule.basePoints;
    let desc = description;
    if (productId && bonusKind) {
      const bonus = bonusFor(productId, bonusKind, user, productBonuses, today);
      if (bonus) {
        if (bonus.multiplier) {
          pts = Math.round(pts * bonus.multiplier);
          desc += ` (${bonus.multiplier}× ${bonus.productName} bonus)`;
        } else if (bonus.bonusPoints) {
          pts += bonus.bonusPoints;
          desc += ` (+${bonus.bonusPoints} ${bonus.productName} bonus)`;
        }
      }
    }
    points.push({
      id: uid('ple'),
      userId: user.id,
      dealershipId: dealership?.id,
      dealershipName: dealership?.name,
      actionType,
      description: desc,
      pointsAwarded: pts,
      ruleVersion: 'v2.0',
      timestamp: now
    });
  };

  const primary = { id: slot.target.id, name: slot.target.name };
  award(contactActionType(slot.how, startedAt), `${HOW_LABEL[slot.how]} — ${slot.target.name}`, primary);

  const interestEntries: [string, string][] = [];
  const upsellEntries: [string, string][] = [];
  const signedIds = new Set<string>();
  let refill: number | undefined;

  for (const task of slot.tasks) {
    const o = task.outcome;
    if (!o) continue;
    if (o.kind === 'interest') {
      Object.entries(o.levels).forEach(([p, l]) => l !== 'None' && interestEntries.push([p, l]));
    } else if (o.kind === 'upsell') {
      Object.entries(o.results).forEach(([p, r]) => upsellEntries.push([p, r]));
    } else if (o.kind === 'signed') {
      o.productIds.forEach(p => signedIds.add(p));
    } else if (o.kind === 'keyfetch' && o.needsRefill && (o.quantity ?? 0) > 0) {
      refill = o.quantity;
    }
  }

  if (interestEntries.length > 0) {
    award('record_product_interest', `Product interest recorded — ${slot.target.name}`, primary);
    interestEntries.forEach(([p]) => {
      const bonus = bonusFor(p, 'interest_recorded', user, productBonuses, today);
      if (bonus?.bonusPoints) {
        points.push({
          id: uid('ple'),
          userId: user.id,
          dealershipId: primary.id,
          dealershipName: primary.name,
          actionType: 'product_bonus',
          description: `${bonus.productName} interest bonus`,
          pointsAwarded: bonus.bonusPoints,
          ruleVersion: 'v2.0',
          timestamp: now
        });
      }
    });
  }
  upsellEntries
    .filter(([, r]) => r === 'Won')
    .forEach(([p]) => award('upsell_won', `Upsell won: ${productName(p)} — ${slot.target.name}`, primary, p, 'upsell_won'));
  signedIds.forEach(p => award('product_signed', `Signed: ${productName(p)} — ${slot.target.name}`, primary, p, 'signed'));
  if (refill) award('keyfetch_topup', `Keyfetch refill logged (${refill} units) — ${slot.target.name}`, primary);
  if (slot.source === 'manager_priority') award('complete_priority', `Manager priority done — ${slot.target.name}`, primary);

  const stageChanges = input.acceptedStageChanges ?? {};
  Object.entries(stageChanges).forEach(([id, stage]) => {
    if (stage === 'Signed' || stage === 'Won') {
      const d = affected.find(x => x.id === id);
      award('deal_won', `Deal won — ${d?.dealershipName ?? slot.target.name}`, d ? { id: d.id, name: d.dealershipName } : primary);
    }
  });

  const totalPoints = points.reduce((s, p) => s + p.pointsAwarded, 0);

  // Dealership updates
  const dealershipUpdates = affected.map(d => {
    const productInterests: DealershipProductInterest[] = [...(d.productInterests ?? [])];
    interestEntries.forEach(([p, level]) => {
      const entry: DealershipProductInterest = {
        productId: p,
        productName: productName(p),
        interestLevel: level as DealershipProductInterest['interestLevel'],
        recordedDate: now,
        recordedByUserId: user.id,
        recordedByUserName: userName
      };
      const idx = productInterests.findIndex(x => x.productId === p);
      if (idx >= 0) productInterests[idx] = entry;
      else productInterests.push(entry);
    });

    const signedProducts = new Set(d.signedProducts ?? []);
    signedIds.forEach(p => signedProducts.add(p));

    const upsells: UpsellOpportunity[] = [...(d.upsells ?? [])];
    upsellEntries.forEach(([p, result]) => {
      const idx = upsells.findIndex(u => u.productId === p && u.stage !== 'Won' && u.stage !== 'Lost');
      const base: UpsellOpportunity =
        idx >= 0
          ? upsells[idx]
          : {
              id: uid('ups'),
              dealershipId: d.id,
              productId: p,
              productName: productName(p),
              stage: 'Identified',
              ownerId: user.id,
              ownerName: userName,
              nextStep: '',
              createdAt: now
            };
      const updated: UpsellOpportunity = {
        ...base,
        stage: result as UpsellOpportunity['stage'],
        nextStep: result === 'Interested' ? 'Send details and follow up' : base.nextStep,
        wonDate: result === 'Won' ? now : base.wonDate,
        wonByUserId: result === 'Won' ? user.id : base.wonByUserId
      };
      if (idx >= 0) upsells[idx] = updated;
      else upsells.push(updated);
      if (result === 'Won') signedProducts.add(p);
    });

    const moved = stageChanges[d.id] && stageChanges[d.id] !== d.stage;
    return {
      ...d,
      ...(moved ? stageTracking(d, stageChanges[d.id]!, now.slice(0, 10)) : {}),
      stage: stageChanges[d.id] ?? d.stage,
      nurtureFollowUpDate: input.nextSkipped?.nurtureDate ?? (stageChanges[d.id] === 'Not Now' ? input.nextStep?.date : undefined) ?? d.nurtureFollowUpDate,
      lastTouchpointDate: now,
      productInterests,
      signedProducts: [...signedProducts],
      upsells,
      updatedAt: now
    };
  });

  // Activities (one per dealership the conversation covered)
  const taskSummary = slot.tasks.map(t => describeTask(t, catalog)).join(' · ');
  const notes = [taskSummary, slot.outcomeNote].filter(Boolean).join('\n');
  const spokeWith = slot.spokeWithNames?.join(', ') || slot.contactNames.join(', ') || undefined;
  const interestRank = { High: 3, Medium: 2, Low: 1 } as const;
  const topInterest = interestEntries
    .map(([, l]) => l as keyof typeof interestRank)
    .sort((a, b) => interestRank[b] - interestRank[a])[0];
  const productsDiscussed = Array.from(
    new Set(slot.tasks.flatMap(t => t.productIds ?? []).map(productName))
  );
  const activityTargets = affected.length > 0 ? affected.map(d => ({ id: d.id, name: d.dealershipName })) : [primary];
  const activities: Activity[] = activityTargets.map((t, i) => ({
    id: uid('act'),
    dealershipId: t.id,
    dealershipName: t.name,
    userId: user.id,
    userName,
    contactId: slot.spokeWithContactIds?.[0] ?? slot.contactIds[0],
    contactName: spokeWith,
    activityType: ACTIVITY_TYPE[slot.how],
    communicationType: COMM_TYPE[slot.how],
    status: 'completed',
    plannedDate: slot.date,
    plannedTime: startedAt,
    completedAt: now,
    isGoodWindow: isLive(slot.how) ? toMin(startedAt) >= 600 && toMin(startedAt) <= 960 : undefined,
    notes: slot.target.kind === 'group' ? `[Group: ${slot.target.name}] ${notes}` : notes,
    productsDiscussed,
    interestLevel: topInterest,
    pointsEarned: i === 0 ? totalPoints : undefined,
    nextAction: input.nextStep?.action ?? (input.nextSkipped && input.nextSkipped.reason !== 'none' ? input.nextSkipped.label : undefined),
    nextActionDate: input.nextStep?.date ?? input.nextSkipped?.nurtureDate,
    nextActionTime: input.nextStep?.time,
    tags: input.nextSkipped ? [`next_skipped_${input.nextSkipped.reason}`] : input.nextStep ? undefined : ['no_next_step']
  }));

  // Action points
  const actionPoints: ActionPoint[] = [...(input.extraActionPoints ?? [])];
  if (refill) {
    actionPoints.unshift({
      id: uid('ap'),
      userId: user.id,
      title: `Place Keyfetch order for ${slot.target.name} — ${refill} units (order system)`,
      dealershipId: slot.target.kind === 'dealership' ? slot.target.id : undefined,
      dealershipName: slot.target.name,
      slotId: slot.id,
      dueDate: today,
      done: false,
      source: 'task',
      createdAt: now,
      updatedAt: now
    });
  }

  const audit: AuditLogRecord[] = activityTargets.map(t => ({
    id: uid('aud'),
    timestamp: now,
    userId: user.id,
    userName,
    dealershipId: t.id,
    dealershipName: t.name,
    action: `${ACTIVITY_TYPE[slot.how]} logged from My Plan`,
    details: [notes, stageChanges[t.id] ? `Stage → ${stageChanges[t.id]}` : ''].filter(Boolean).join(' · ')
  }));

  return {
    activities,
    dealershipUpdates,
    newContacts: input.newContacts ?? [],
    actionPoints,
    points,
    audit,
    totalPoints
  };
}

/** One-tap stage change the rep can confirm after a contact. Never applied silently. */
export function suggestStageChange(slot: PlanSlot, dealership: Dealership): { to: PipelineStage; reason: string } | null {
  const done = (id: string) => slot.tasks.find(t => t.taskId === id && t.outcome);
  const stage = dealership.stage;
  const signed = slot.tasks.some(t => t.outcome?.kind === 'signed' && t.outcome.productIds.length > 0);
  const notNow = slot.tasks.some(t => t.outcome?.kind === 'simple' && t.outcome.result === 'not_now');
  const highInterest = slot.tasks.some(
    t => t.outcome?.kind === 'interest' && Object.values(t.outcome.levels).includes('High')
  );

  if (signed && ['Contract', 'Won', 'HOT', 'Negotiation'].includes(stage)) return { to: 'Signed', reason: 'Products were signed' };
  if (done('s_handover') && stage !== 'Client') return { to: 'Client', reason: 'Handed over to servicing' };
  if (done('s_training') && stage === 'Signed') return { to: 'Onboarding', reason: 'Onboarding training started' };
  if (stage === 'Client' || dealership.stage === 'Onboarding') return null;
  if (notNow) return { to: 'Not Now', reason: 'They said not now' };
  if (highInterest && ['Visited', 'In Progress', 'Follow-up'].includes(stage)) return { to: 'HOT', reason: 'High interest in a product' };
  if (isLive(slot.how) && ['Pool', 'Claimed', 'Visit Planned'].includes(stage)) return { to: 'Visited', reason: 'First contact made' };
  return null;
}

/** Smart action-point suggestions from the outcome (rules-based; the rep accepts, edits or dismisses). */
export function suggestActionPoints(slot: PlanSlot, catalog: ProductCatalogItem[]): string[] {
  const name = (id: string) => catalog.find(p => p.id === id)?.name ?? id;
  const out: string[] = [];
  for (const t of slot.tasks) {
    const o = t.outcome;
    if (!o) continue;
    if (o.kind === 'simple' && o.result === 'follow_up') out.push(`Follow up with ${slot.target.name}`);
    if (o.kind === 'simple' && o.result === 'issue') out.push(`Sort out the issue at ${slot.target.name}`);
    if (o.kind === 'upsell') {
      Object.entries(o.results)
        .filter(([, r]) => r === 'Interested')
        .forEach(([p]) => out.push(`Send ${name(p)} details to ${slot.target.name}`));
    }
    if (o.kind === 'interest') {
      Object.entries(o.levels)
        .filter(([, l]) => l === 'High')
        .forEach(([p]) => out.push(`Ask your manager to help close ${name(p)} at ${slot.target.name}`));
    }
    if (o.kind === 'signed' && o.productIds.length > 0) out.push(`Book onboarding training with ${slot.target.name}`);
  }
  return Array.from(new Set(out)).slice(0, 4);
}
