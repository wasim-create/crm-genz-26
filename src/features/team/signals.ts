// Who needs help, and why. Plain rules that anyone can read; no AI decides
// a status. Each rule produces a "flag" with the same facts worded twice:
// once for the manager ("4 deals with no next step") and once for the rep
// ("4 of your deals have no next step").

import type { Activity, Dealership, ManagerAssist, PipelineStage, User } from '../../types/crm';
import type { NextStepState } from '../../utils/nextStepStatus';

export type FlagKind = 'effort' | 'deals' | 'skill' | 'new' | 'support';
export type FlagLevel = 'help' | 'watch';
export type RepStatus = 'help' | 'watch' | 'good';

export interface Flag {
  /** Stable per rep and rule, so "handled" can be remembered. */
  id: string;
  kind: FlagKind;
  level: FlagLevel;
  /** Manager's wording. */
  title: string;
  /** Rep's wording (undefined = manager only). */
  repTitle?: string;
  detail?: string;
  dealershipIds: string[];
  /** Set when the manager has acted on it recently and it hasn't got worse. */
  handled?: { at: string; by: string; action: string };
}

export interface RepReport {
  rep: User;
  status: RepStatus;
  flags: Flag[];
  /** Flags still needing attention (not handled). */
  open: Flag[];
  wins: string[];
  stats: {
    contactsLastWeek: number;
    usualPerWeek: number | null;
    plannedNextDays: number;
    liveDeals: number;
    workingDaysSinceHire: number;
  };
}

export interface TeamRules {
  /** Below this % of their own usual week = keep an eye; below half of it = needs help. */
  dropPct: number;
  /** Only compare with "usual" when the rep normally does at least this many a week. */
  minUsualPerWeek: number;
  /** Working days in a row with nothing logged before it's "needs help". */
  quietDays: number;
  /** Look this many working days ahead for planned visits and calls. */
  planAheadDays: number;
  /** Deals with no next step: "keep an eye" from the first one, "needs help" at this many. */
  noNextStepHelp: number;
  /** Days a deal can sit in a stage before it counts as stuck. */
  stuckDays: Partial<Record<PipelineStage, number>>;
  /** Losses at the same stage within the window that count as a pattern. */
  lossesSameStage: number;
  lossesWindowDays: number;
  /** Client health below this is "at risk". */
  atRiskHealth: number;
  /** Working days before an unanswered assist request is flagged. */
  assistWaitDays: number;
  /** How long a handled flag stays quiet (days) unless it gets worse. */
  handledQuietDays: number;
}

export const DEFAULT_RULES: TeamRules = {
  dropPct: 60,
  minUsualPerWeek: 5,
  quietDays: 3,
  planAheadDays: 2,
  noNextStepHelp: 3,
  stuckDays: { Visited: 21, 'Follow-up': 30, 'In Progress': 30, HOT: 21, Negotiation: 30, Contract: 14 },
  lossesSameStage: 3,
  lossesWindowDays: 30,
  atRiskHealth: 50,
  assistWaitDays: 2,
  handledQuietDays: 7
};

/** New-starter milestones, by working days since hire. */
export const NEW_REP_MILESTONES: { day: number; label: string; check: (m: { visits: number; reachedFollowUp: boolean; signed: boolean }) => boolean; count?: number }[] = [
  { day: 5, label: 'first visit', count: 1, check: m => m.visits >= 1 },
  { day: 10, label: '5 visits', count: 5, check: m => m.visits >= 5 },
  { day: 20, label: '12 visits', count: 12, check: m => m.visits >= 12 },
  { day: 30, label: 'a deal at Follow-up or later', check: m => m.reachedFollowUp },
  { day: 60, label: 'first signing', check: m => m.signed }
];
const NEW_REP_DAYS = 60;

export interface PlannedContact {
  userId: string;
  date: string;
  how: string;
}

export interface HandledMark {
  at: string;
  by: string;
  action: string;
  level: FlagLevel;
}

export interface SignalInput {
  rep: User;
  managerName?: string;
  dealerships: Dealership[];
  activities: Activity[];
  nextSteps: Map<string, NextStepState>;
  planned: PlannedContact[];
  assists: ManagerAssist[];
  streak?: number;
  rules?: TeamRules;
  /** Keyfetch stock at the rep's clients (from the stock sheets). */
  stock?: { dealerId: string; name: string; status: string; weeksLeft: number | null; onTheWayQty: number; countDue: boolean; drop?: { recent: number; usual: number } }[];
  /** Remembered manager actions, keyed by flag id. */
  handled?: Record<string, HandledMark>;
  today: string;
}

// ───────────────────────── date helpers ─────────────────────────

const atNoon = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isWorkday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** The n working days before `today` (most recent first). */
export function workdaysBefore(today: string, n: number): string[] {
  const out: string[] = [];
  const d = atNoon(today);
  while (out.length < n) {
    d.setDate(d.getDate() - 1);
    if (isWorkday(d)) out.push(iso(d));
  }
  return out;
}

/** The n working days after `today`. */
export function workdaysAfter(today: string, n: number): string[] {
  const out: string[] = [];
  const d = atNoon(today);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (isWorkday(d)) out.push(iso(d));
  }
  return out;
}

export function workdaysBetween(from: string, to: string): number {
  let n = 0;
  const d = atNoon(from);
  const end = atNoon(to);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (isWorkday(d)) n++;
  }
  return n;
}

const daysBetween = (from: string, to: string) => Math.round((atNoon(to).getTime() - atNoon(from).getTime()) / 86400000);
const dayName = (date: string) => atNoon(date).toLocaleDateString('en-US', { weekday: 'short' });
const shortDate = (date: string) => atNoon(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const perWeek = (n: number) => (n < 0.5 ? 'almost none' : `about ${n} a week`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listNames = (names: string[], max = 2) => (names.length <= max ? names.join(' and ') : `${names.slice(0, max).join(', ')} and ${names.length - max} more`);

const LIVE: PipelineStage[] = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding'];
const CONTACT_TYPES: Activity['activityType'][] = ['In-Person Visit', 'Phone Call', 'Google Meet'];
const STAGE_WORD: Partial<Record<PipelineStage, string>> = { HOT: 'Hot', 'In Progress': 'In progress', 'Follow-up': 'Follow-up' };
const stageWord = (s: PipelineStage) => STAGE_WORD[s] ?? s;

// ───────────────────────── the rules ─────────────────────────

export function repReport(input: SignalInput): RepReport {
  const { rep, today } = input;
  const rules = { ...DEFAULT_RULES, ...input.rules, stuckDays: { ...DEFAULT_RULES.stuckDays, ...input.rules?.stuckDays } };
  const first = rep.firstName;
  const mgr = input.managerName ?? 'your manager';
  const flags: Flag[] = [];
  const wins: string[] = [];

  const hire = rep.hireDate?.slice(0, 10) ?? '2000-01-01';
  const sinceHire = hire >= today ? 0 : workdaysBetween(hire, today);
  const isNew = sinceHire <= NEW_REP_DAYS;

  const mine = input.activities.filter(a => a.userId === rep.id && a.status === 'completed' && a.completedAt);
  const contacts = mine.filter(a => CONTACT_TYPES.includes(a.activityType));
  const dayOf = (a: Activity) => (a.plannedDate ?? a.completedAt!).slice(0, 10);
  const contactsOn = new Map<string, number>();
  contacts.forEach(a => contactsOn.set(dayOf(a), (contactsOn.get(dayOf(a)) ?? 0) + 1));

  const book = input.dealerships.filter(d => d.assignedRepId === rep.id && !d.isPlaceholder);
  const live = book.filter(d => LIVE.includes(d.stage));

  // ── effort: nothing logged lately ──
  const lastWeek = workdaysBefore(today, 5);
  const contactsLastWeek = lastWeek.reduce((n, d) => n + (contactsOn.get(d) ?? 0), 0);
  let quietRun = 0;
  for (const d of workdaysBefore(today, 15)) {
    if (d <= hire || (contactsOn.get(d) ?? 0) > 0) break;
    quietRun++;
  }
  const lastContact = contacts.map(dayOf).sort().pop();
  if (quietRun >= rules.quietDays) {
    flags.push({
      id: 'quiet',
      kind: 'effort',
      level: 'help',
      title: `Nothing logged for ${plural(quietRun, 'working day')}`,
      repTitle: `Nothing logged for ${plural(quietRun, 'working day')}. If you've been out, log what you did.`,
      detail: lastContact ? `Last visit or call: ${shortDate(lastContact)}` : undefined,
      dealershipIds: []
    });
  }

  // ── effort: fewer than their own usual ──
  const before = workdaysBefore(today, 25).slice(5).filter(d => d > hire);
  const usualPerWeek = before.length >= 10 ? Math.round((before.reduce((n, d) => n + (contactsOn.get(d) ?? 0), 0) / before.length) * 5) : null;
  if (quietRun < rules.quietDays && usualPerWeek !== null && usualPerWeek >= rules.minUsualPerWeek) {
    const ratio = (contactsLastWeek / usualPerWeek) * 100;
    if (ratio < rules.dropPct) {
      flags.push({
        id: 'drop',
        kind: 'effort',
        level: ratio < rules.dropPct / 2 ? 'help' : 'watch',
        title: `${plural(contactsLastWeek, 'visit or call', 'visits and calls')} in the last week, usually about ${usualPerWeek}`,
        repTitle: `Fewer visits and calls than usual this week (${contactsLastWeek}, usually about ${usualPerWeek})`,
        dealershipIds: []
      });
    } else if (contactsLastWeek >= usualPerWeek * 1.25 && contactsLastWeek >= 8) {
      wins.push(`${contactsLastWeek} visits and calls last week, above their usual ${usualPerWeek}`);
    }
  }

  // ── effort: nothing planned ahead ──
  const ahead = workdaysAfter(today, rules.planAheadDays);
  const plannedNextDays = input.planned.filter(p => p.userId === rep.id && ahead.includes(p.date) && p.how !== 'email' && p.how !== 'text').length;
  if (plannedNextDays === 0 && book.length > 0) {
    const days = listNames(ahead.map(dayName));
    flags.push({
      id: 'plan',
      kind: 'effort',
      level: 'watch',
      title: `Nothing planned for ${days}`,
      repTitle: `Nothing planned for ${days} yet`,
      dealershipIds: []
    });
  }

  // ── deals: no next step / waiting too long ──
  const missing = live.filter(d => input.nextSteps.get(d.id)?.kind === 'missing');
  if (missing.length) {
    flags.push({
      id: 'no_next',
      kind: 'deals',
      level: missing.length >= rules.noNextStepHelp ? 'help' : 'watch',
      title: `${plural(missing.length, 'deal')} with no next step`,
      repTitle: `${missing.length === 1 ? '1 of your deals has' : `${missing.length} of your deals have`} no next step`,
      detail: listNames(missing.map(d => d.dealershipName), 3),
      dealershipIds: missing.map(d => d.id)
    });
  }
  const waiting = live.filter(d => {
    const s = input.nextSteps.get(d.id);
    return s?.kind === 'waiting' && s.overdue;
  });
  if (waiting.length) {
    flags.push({
      id: 'waiting',
      kind: 'deals',
      level: 'watch',
      title: `${plural(waiting.length, 'deal')} waiting on the dealer too long`,
      repTitle: `${waiting.length === 1 ? '1 deal has' : `${waiting.length} deals have`} been waiting on the dealer too long. Time to chase?`,
      detail: listNames(waiting.map(d => d.dealershipName), 3),
      dealershipIds: waiting.map(d => d.id)
    });
  }

  // ── deals: stuck in a stage ──
  const stuck = live
    .map(d => ({ d, days: d.stageSince ? daysBetween(d.stageSince, today) : 0, limit: rules.stuckDays[d.stage] }))
    .filter(x => x.limit !== undefined && x.days > x.limit!)
    .sort((a, b) => b.days / b.limit! - a.days / a.limit!);
  if (stuck.length) {
    const top = stuck[0];
    const one = `${top.d.dealershipName} in ${stageWord(top.d.stage)} ${top.days} days (usually under ${top.limit})`;
    flags.push({
      id: 'stuck',
      kind: 'deals',
      level: stuck.length >= 2 || top.days > top.limit! * 2 ? 'help' : 'watch',
      title: stuck.length === 1 ? one : `${plural(stuck.length, 'deal')} stuck: ${one}`,
      repTitle: stuck.length === 1 ? `${top.d.dealershipName} has been in ${stageWord(top.d.stage)} for ${top.days} days` : `${stuck.length} deals have sat in one stage a long time, longest ${top.d.dealershipName}`,
      detail: stuck.length > 1 ? listNames(stuck.slice(1).map(x => `${x.d.dealershipName} (${stageWord(x.d.stage)} ${x.days} days)`), 3) : undefined,
      dealershipIds: stuck.map(x => x.d.id)
    });
  }

  // ── deals: clients at risk ──
  const risk = book.filter(d => d.stage === 'Client' && (d.clientHealthScore ?? 100) < rules.atRiskHealth);
  if (risk.length) {
    flags.push({
      id: 'risk',
      kind: 'deals',
      level: 'watch',
      title: risk.length === 1 ? `1 client at risk: ${risk[0].dealershipName}, health ${risk[0].clientHealthScore}` : `${risk.length} clients at risk`,
      repTitle: risk.length === 1 ? `${risk[0].dealershipName} is at risk (health ${risk[0].clientHealthScore}). Worth a proper visit.` : `${risk.length} of your clients are at risk`,
      detail: risk.length > 1 ? listNames(risk.map(d => `${d.dealershipName} (${d.clientHealthScore})`), 3) : undefined,
      dealershipIds: risk.map(d => d.id)
    });
  }

  // ── deals: Keyfetch keychains running low, counts due, contracts dropping ──
  const stock = input.stock ?? [];
  const low = stock.filter(s => s.status === 'out' || s.status === 'order_now');
  if (low.length) {
    const phrase = (s: (typeof low)[number]) =>
      s.status === 'out' ? `${s.name} is out of keychains${s.onTheWayQty ? ` (${s.onTheWayQty} on the way)` : ''}` : `${s.name} has about ${Math.round(s.weeksLeft ?? 0)} weeks of keychains left`;
    flags.push({
      id: 'keyfetch_low',
      kind: 'deals',
      level: 'watch',
      title: low.length === 1 ? phrase(low[0]) : `${low.length} clients low on Keyfetch keychains`,
      repTitle: low.length === 1 ? `${phrase(low[0])}. Check an order is in with the inventory team.` : `${low.length} of your clients are low on keychains. Check orders are in with the inventory team.`,
      detail: low.length > 1 ? listNames(low.map(phrase), 3) : undefined,
      dealershipIds: low.map(s => s.dealerId)
    });
  }
  const counts = stock.filter(s => s.countDue);
  if (counts.length) {
    flags.push({
      id: 'keyfetch_count',
      kind: 'deals',
      level: 'watch',
      title: `Keyfetch count due at ${listNames(counts.map(s => s.name))}`,
      repTitle: `Count the Keyfetch keychains at ${listNames(counts.map(s => s.name))} on your next visit`,
      dealershipIds: counts.map(s => s.dealerId)
    });
  }
  const drops = stock.filter(s => s.drop);
  if (drops.length) {
    const d0 = drops[0];
    flags.push({
      id: 'contracts_drop',
      kind: 'deals',
      level: 'watch',
      title: drops.length === 1 ? `${d0.name}: contracts down to ${perWeek(d0.drop!.recent)} (usually ${d0.drop!.usual} a week)` : `Contracts dropping at ${drops.length} clients`,
      repTitle: drops.length === 1 ? `${d0.name} is selling far fewer contracts lately (${perWeek(d0.drop!.recent)}, usually ${d0.drop!.usual} a week). Worth a visit.` : `Contracts are dropping at ${listNames(drops.map(s => s.name))}. Worth a visit.`,
      dealershipIds: drops.map(s => s.dealerId)
    });
  }

  // ── skill: losing deals at the same stage ──
  const windowStart = iso(new Date(atNoon(today).getTime() - rules.lossesWindowDays * 86400000));
  const lost = book.filter(d => d.stage === 'Lost' && d.lostDate && d.lostDate >= windowStart);
  const byStage = new Map<PipelineStage, Dealership[]>();
  lost.forEach(d => {
    const s = d.lostAtStage ?? 'Follow-up';
    byStage.set(s, [...(byStage.get(s) ?? []), d]);
  });
  const worst = [...byStage.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (worst && worst[1].length >= rules.lossesSameStage - 1) {
    const [stage, deals] = worst;
    flags.push({
      id: `losses_${stage}`,
      kind: 'skill',
      level: deals.length >= rules.lossesSameStage ? 'help' : 'watch',
      title: `Lost ${plural(deals.length, 'deal')} at ${stageWord(stage)} in the last ${rules.lossesWindowDays} days`,
      repTitle: `You've lost ${plural(deals.length, 'deal')} at ${stageWord(stage)} this month. Worth going through them with ${mgr}.`,
      detail: deals.map(d => `${d.dealershipName}${d.lostReason ? `: ${d.lostReason.replace(/\.$/, '').replace(/^They /, '')}` : ''}`).join(' · '),
      dealershipIds: deals.map(d => d.id)
    });
  }

  // ── new starter milestones ──
  if (isNew) {
    const visits = mine.filter(a => a.activityType === 'In-Person Visit' && dayOf(a) > hire).length;
    const reachedFollowUp = book.some(d => ['Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding', 'Client'].includes(d.stage));
    const signed = mine.some(a => a.tags?.includes('signed'));
    const m = { visits, reachedFollowUp, signed };
    const missed = NEW_REP_MILESTONES.filter(x => x.day <= sinceHire && !x.check(m));
    const next = NEW_REP_MILESTONES.find(x => x.day > sinceHire && !x.check(m));
    if (missed.length) {
      const x = missed[missed.length - 1];
      const has = x.count ? ` (has ${visits})` : '';
      flags.push({
        id: 'new_rep',
        kind: 'new',
        level: missed.length >= 2 ? 'help' : 'watch',
        title: `New starter, day ${sinceHire}: behind on ${x.label} by day ${x.day}${has}`,
        repTitle: `Day ${sinceHire}: the target was ${x.label} by day ${x.day}${x.count ? ` (you have ${visits})` : ''}. Ask ${mgr} for a ride-along.`,
        detail: next ? `Next milestone: ${next.label} by day ${next.day}` : undefined,
        dealershipIds: []
      });
    } else if (next) {
      wins.push(`New starter, day ${sinceHire}: on track (next: ${next.label} by day ${next.day})`);
    }
  }

  // ── support: their request for help is waiting on the manager ──
  const waitingOnMgr = input.assists.filter(a => a.originRepId === rep.id && a.status === 'Pending' && workdaysBetween(a.requestDate.slice(0, 10), today) >= rules.assistWaitDays);
  if (waitingOnMgr.length) {
    const a = waitingOnMgr[0];
    const days = workdaysBetween(a.requestDate.slice(0, 10), today);
    flags.push({
      id: 'assist_waiting',
      kind: 'support',
      level: 'watch',
      title: waitingOnMgr.length === 1 ? `Asked for your help on ${a.dealershipName} ${plural(days, 'working day')} ago, not answered yet` : `${waitingOnMgr.length} requests for your help not answered yet`,
      dealershipIds: waitingOnMgr.map(x => x.dealershipId)
    });
  }

  // ── wins ──
  const signedLately = mine.filter(a => a.tags?.includes('signed') && lastWeek.includes(dayOf(a)));
  if (signedLately.length) wins.unshift(`Signed ${listNames([...new Set(signedLately.map(a => a.dealershipName))])} this week`);
  if ((input.streak ?? 0) >= 5) wins.push(`${input.streak}-day streak`);

  // ── handled marks: quiet for a while unless it got worse ──
  const quietUntil = (at: string) => daysBetween(at.slice(0, 10), today) < rules.handledQuietDays;
  flags.forEach(f => {
    const h = input.handled?.[f.id];
    if (h && quietUntil(h.at) && !(f.level === 'help' && h.level === 'watch')) f.handled = { at: h.at, by: h.by, action: h.action };
  });

  const open = flags.filter(f => !f.handled);
  const helpCount = open.filter(f => f.level === 'help').length;
  const status: RepStatus = helpCount > 0 || open.length >= 3 ? 'help' : open.length ? 'watch' : 'good';

  // Most urgent first: needs help, then by kind order.
  const ORDER: FlagKind[] = ['effort', 'deals', 'skill', 'new', 'support'];
  flags.sort((a, b) => Number(!!a.handled) - Number(!!b.handled) || (a.level === b.level ? 0 : a.level === 'help' ? -1 : 1) || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));

  return {
    rep,
    status,
    flags,
    open,
    wins,
    stats: { contactsLastWeek, usualPerWeek, plannedNextDays, liveDeals: live.length, workingDaysSinceHire: sinceHire }
  };
}

const STATUS_ORDER: RepStatus[] = ['help', 'watch', 'good'];

/** Reps sorted: needs help first, then by how many open flags. */
export function sortReports(list: RepReport[]): RepReport[] {
  return [...list].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      b.open.filter(f => f.level === 'help').length - a.open.filter(f => f.level === 'help').length ||
      b.open.length - a.open.length ||
      a.rep.firstName.localeCompare(b.rep.firstName)
  );
}

export const STATUS_LABEL: Record<RepStatus, string> = { help: 'Needs help', watch: 'Keep an eye', good: 'On track' };
