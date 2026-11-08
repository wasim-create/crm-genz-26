// Demo plans for every user, built from the CRM's own demo data so My Plan
// and the CRM always tell the same story:
//   • the past 4 weeks = the CRM's logged visits, calls, Meets, emails and texts
//     (same dealership, time, contact, note and points);
//   • the coming week = what the CRM says is booked: next actions with a date,
//     accepted Manager Assists, scheduled manager priorities, onboarding steps,
//     plus sensible client check-ins (Keyfetch due) to fill each day;
//   • a weekly team call, an over-full day, a trip day for far accounts, a
//     dealer-group meeting, an email batch, a call list and a plan-later basket;
//   • action points from real open items (Keyfetch orders, email follow-ups).

import { Activity, Contact, DealerGroup, Dealership, ManagerAssist, ManagerPriority, ProductCatalogItem, User, WorkspaceItem } from '../../../types/crm';
import { ActionPoint, HowType, PlanSlot, SlotTask, TaskOutcome, WorkType } from '../types';
import { distanceBand, milesBetween } from '../engine/geo';
import { defaultTaskIds, durationFor, TASK_BY_ID, workTypeForStage } from '../engine/tasks';
import { addDays, isWeekend, nextWeekday } from '../engine/time';
import { staggerSendTimes, suggestSendTime } from '../engine/schedule';
import { hasKeyfetch } from '../services/suggestions';
import { zoneFor } from '../engine/timezones';

export interface SeedInput {
  users: User[];
  dealerships: Dealership[];
  contacts: Contact[];
  groups: DealerGroup[];
  catalog: ProductCatalogItem[];
  today: string;
  activities?: Activity[];
  assists?: ManagerAssist[];
  priorities?: ManagerPriority[];
  workspace?: WorkspaceItem[];
}

let seq = 0;
const sid = (p: string) => `${p}_${(seq++).toString(36)}`;

export function contactsFor(dealershipId: string, contacts: Contact[]) {
  return contacts.filter(c => c.dealershipId === dealershipId);
}

export function targetFromDealership(d: Dealership) {
  return {
    kind: 'dealership' as const,
    id: d.id,
    name: d.dealershipName,
    city: d.city,
    state: d.state,
    coords: d.coordinates,
    address: [d.address, d.city, `${d.state} ${d.zipCode}`.trim()].filter(Boolean).join(', '),
    timeZone: zoneFor(d.state, d.city)
  };
}

export function targetFromGroup(g: DealerGroup, rooftops: Dealership[]) {
  const withCoords = rooftops.filter(r => r.coordinates);
  const coords = withCoords.length
    ? {
        lat: withCoords.reduce((s, r) => s + r.coordinates.lat, 0) / withCoords.length,
        lng: withCoords.reduce((s, r) => s + r.coordinates.lng, 0) / withCoords.length
      }
    : undefined;
  return {
    kind: 'group' as const,
    id: g.id,
    name: g.name,
    city: g.hqCity,
    state: g.hqState,
    coords,
    address: [g.hqAddress, g.hqCity, `${g.hqState} ${g.hqZip}`.trim()].filter(Boolean).join(', '),
    timeZone: zoneFor(g.hqState, g.hqCity),
    rooftopIds: rooftops.map(r => r.id)
  };
}

const HOW_OF: Partial<Record<Activity['activityType'], HowType>> = {
  'In-Person Visit': 'in_person',
  'Phone Call': 'phone',
  'Google Meet': 'meet',
  Email: 'email',
  'Text Message': 'text'
};

const PRODUCT_ID_BY_NAME = (catalog: ProductCatalogItem[]) => Object.fromEntries(catalog.map(p => [p.name, p.id]));

/** Turn a logged CRM activity's tasks into My Plan tasks with outcomes. */
function tasksFromActivity(a: Activity, catalog: ProductCatalogItem[]): SlotTask[] {
  const byName = PRODUCT_ID_BY_NAME(catalog);
  const productIds = a.productsDiscussed.map(n => byName[n]).filter(Boolean);
  const ids = a.taskIds?.length ? a.taskIds : [a.activityType === 'Email' || a.activityType === 'Text Message' ? 'p_followup' : 'c_checkin'];
  return ids
    .filter(id => TASK_BY_ID[id])
    .map(taskId => {
      const def = TASK_BY_ID[taskId];
      let outcome: TaskOutcome;
      switch (def.outcome) {
        case 'interest':
          outcome = { kind: 'interest', levels: Object.fromEntries(productIds.map(p => [p, a.interestLevel ?? 'Medium'])) };
          return { taskId, productIds, outcome };
        case 'upsell':
          outcome = { kind: 'upsell', results: Object.fromEntries(productIds.map(p => [p, a.tags?.includes('upsell_won') ? 'Won' : a.interestLevel === 'Low' ? 'Lost' : 'Pitched'])) };
          return { taskId, productIds, outcome };
        case 'keyfetch': {
          const qty = Number(a.notes.match(/refill of (\d+)/)?.[1]);
          outcome = a.tags?.includes('refill') ? { kind: 'keyfetch', needsRefill: true, quantity: qty || undefined } : { kind: 'keyfetch', needsRefill: false };
          return { taskId, outcome };
        }
        case 'signed':
          outcome = { kind: 'signed', productIds };
          return { taskId, productIds, outcome };
        default:
          outcome = { kind: 'simple', result: a.tags?.includes('voicemail') || a.nextAction ? 'follow_up' : a.tags?.includes('issue') ? 'issue' : 'done' };
          return { taskId, outcome };
      }
    });
}

function plannedTask(taskId: string, d: Dealership): SlotTask {
  const def = TASK_BY_ID[taskId];
  if (def.products === 'not_owned') {
    const owned = d.signedProducts ?? [];
    return { taskId, productIds: ['prod_10', 'prod_4', 'prod_5'].filter(p => !owned.includes(p)).slice(0, 1) };
  }
  if (def.products) {
    const interested = (d.productInterests ?? []).map(p => p.productId);
    return { taskId, productIds: (interested.length ? interested : ['prod_3', 'prod_1']).slice(0, 2) };
  }
  return { taskId };
}

/** What a CRM "next action" means in My Plan. */
function nextActionPlan(text: string, d: Dealership): { how: HowType; taskIds: string[] } {
  const t = text.toLowerCase();
  if (t.includes('call') || t.includes('try the gsm') || t.includes('chase')) return { how: 'phone', taskIds: [workTypeForStage(d.stage) === 'client' ? 'c_checkin' : 'p_followup'] };
  if (t.includes('send') || t.includes('email')) return { how: 'email', taskIds: ['p_followup'] };
  if (t.includes('first visit')) return { how: 'in_person', taskIds: ['p_intro', 'p_interest'] };
  if (t.includes('contract') || t.includes('signing')) return { how: 'in_person', taskIds: ['s_contract'] };
  if (t.includes('onboarding') || t.includes('kick-off')) return { how: 'in_person', taskIds: ['s_setup'] };
  return { how: 'in_person', taskIds: defaultTaskIds(d.stage, workTypeForStage(d.stage) ?? 'prospect', false) };
}

export function buildSeed(input: SeedInput): { slots: PlanSlot[]; actionPoints: ActionPoint[] } {
  const { users, dealerships, contacts, groups, catalog, today } = input;
  const activities = input.activities ?? [];
  const assists = input.assists ?? [];
  const priorities = input.priorities ?? [];
  const workspace = input.workspace ?? [];
  const nowISO = new Date().toISOString();
  const slots: PlanSlot[] = [];
  const actionPoints: ActionPoint[] = [];
  const dealerById = new Map(dealerships.map(d => [d.id, d]));

  const make = (user: User, d: Dealership, date: string | undefined, orderIndex: number, how: HowType, tasks: SlotTask[], extra: Partial<PlanSlot> = {}): PlanSlot => {
    const work = (workTypeForStage(d.stage) ?? 'prospect') as WorkType;
    const cs = contactsFor(d.id, contacts);
    return {
      id: sid('slot'),
      userId: user.id,
      date,
      orderIndex,
      status: date ? 'planned' : 'basket',
      how,
      workType: work,
      target: targetFromDealership(d),
      tasks,
      contactIds: cs.slice(0, 1).map(c => c.id),
      contactNames: cs.slice(0, 1).map(c => `${c.firstName} ${c.lastName}`),
      timeMode: 'flow',
      durationMin: durationFor(how, tasks),
      source: 'seed',
      createdAt: nowISO,
      updatedAt: nowISO,
      ...extra
    };
  };

  const upcoming: string[] = [];
  let cursor = today;
  while (upcoming.length < 7) {
    cursor = nextWeekday(cursor);
    upcoming.push(cursor);
  }
  const planDays = isWeekend(today) ? upcoming.slice(0, 5) : [today, ...upcoming.slice(0, 4)];
  const historyFrom = addDays(today, -28);

  for (const user of users) {
    const isRep = user.role === 'new_rep' || user.role === 'veteran_rep';
    const isManager = user.role === 'manager' || user.role === 'team_lead';
    const home = user.homeCoords;
    const band = (d: Dealership) => distanceBand(milesBetween(home, d.coordinates));

    // ── History: the CRM's own log for this user ──
    const mine = activities.filter(a => a.userId === user.id && a.plannedDate && a.plannedDate >= historyFrom && a.plannedDate < today && HOW_OF[a.activityType]);
    const byDay = new Map<string, Activity[]>();
    mine.forEach(a => byDay.set(a.plannedDate!, [...(byDay.get(a.plannedDate!) ?? []), a]));
    byDay.forEach((list, date) => {
      list
        .sort((a, b) => (a.plannedTime ?? '').localeCompare(b.plannedTime ?? ''))
        .forEach((a, j) => {
          const d = dealerById.get(a.dealershipId);
          if (!d) return;
          const how = HOW_OF[a.activityType]!;
          const tasks = tasksFromActivity(a, catalog);
          const isMsg = how === 'email' || how === 'text';
          const dur = durationFor(how, tasks);
          const cancelled = a.status === 'cancelled';
          slots.push(
            make(user, d, date, isMsg ? 100 + j : j, how, tasks, {
              status: cancelled ? 'skipped' : 'done',
              timeMode: isMsg ? 'flow' : 'exact',
              fixedTime: isMsg ? undefined : a.plannedTime,
              sendTime: isMsg ? a.plannedTime : undefined,
              message: isMsg ? a.notes : undefined,
              contactIds: a.contactId ? [a.contactId] : [],
              contactNames: a.contactName ? [a.contactName] : [],
              skippedReason: cancelled ? a.notes : undefined,
              checkInAt: cancelled || isMsg ? undefined : a.completedAt,
              completedAt: cancelled ? undefined : new Date(new Date(a.completedAt!).getTime() + (isMsg ? 0 : dur) * 60000).toISOString(),
              outcomeNote: cancelled ? undefined : a.notes,
              pointsAwarded: a.pointsEarned ?? 0,
              spokeWithNames: a.contactName && !a.tags?.includes('voicemail') && !isMsg ? [a.contactName] : undefined
            })
          );
        });
    });

    if (isRep) {
      const book = dealerships.filter(d => d.assignedRepId === user.id && workTypeForStage(d.stage) && !d.isPlaceholder);
      const local = book.filter(d => band(d) !== 'out_of_town');
      const far = book.filter(d => band(d) === 'out_of_town');
      const clients = local.filter(d => d.stage === 'Client');
      const lastKeyfetch = (d: Dealership) =>
        activities.filter(a => a.dealershipId === d.id && a.taskIds?.includes('c_keyfetch')).map(a => a.plannedDate!).sort().pop() ?? '0000';
      // Clients most due for a Keyfetch check first
      const clientsDue = [...clients].sort((a, b) => lastKeyfetch(a).localeCompare(lastKeyfetch(b)));
      const live = local.filter(d => ['In Progress', 'HOT', 'Negotiation', 'Follow-up', 'Visited'].includes(d.stage));
      const onDay = new Map<string, Set<string>>();
      const thisWeek = new Set<string>();
      const taken = (date: string, id: string) => onDay.get(date)?.has(id) ?? false;
      const mark = (date: string, id: string) => {
        onDay.set(date, new Set([...(onDay.get(date) ?? []), id]));
        thisWeek.add(id);
      };
      const push = (s: PlanSlot) => {
        if (s.date && s.target.kind === 'dealership') mark(s.date, s.target.id);
        slots.push(s);
      };

      // 1) Booked next actions from the CRM (latest activity per dealership)
      const latestByDealer = new Map<string, Activity>();
      activities
        .filter(a => a.userId === user.id && a.status === 'completed' && a.nextAction)
        .forEach(a => {
          const cur = latestByDealer.get(a.dealershipId);
          if (!cur || (a.completedAt ?? '') > (cur.completedAt ?? '')) latestByDealer.set(a.dealershipId, a);
        });
      latestByDealer.forEach(a => {
        if (!a.nextAction || !a.nextActionDate || a.nextActionDate < today) return;
        const d = dealerById.get(a.dealershipId);
        if (!d) return;
        const date = isWeekend(a.nextActionDate) ? nextWeekday(a.nextActionDate) : a.nextActionDate;
        const { how, taskIds } = nextActionPlan(a.nextAction, d);
        const isMsg = how === 'email' || how === 'text';
        push(
          make(user, d, date, isMsg ? 100 : 5, how, taskIds.map(t => plannedTask(t, d)), {
            timeMode: a.nextActionTime ? 'exact' : 'flow',
            fixedTime: a.nextActionTime,
            sendTime: isMsg ? suggestSendTime(how, date) : undefined,
            message: isMsg ? `Hi {first name}, following up as promised — ${a.nextAction.toLowerCase()}.` : undefined,
            contactIds: a.contactId ? [a.contactId] : [],
            contactNames: a.contactName ? [a.contactName] : [],
            notes: a.nextAction
          })
        );
      });

      // 2) Manager Assists the manager accepted (locked)
      const manager = users.find(u => u.id === user.managerId);
      assists
        .filter(x => x.originRepId === user.id && (x.status === 'Accepted' || x.status === 'Pending' || x.status === 'Reschedule Proposed'))
        .forEach(x => {
          const d = dealerById.get(x.dealershipId);
          if (!d) return;
          const date = x.status === 'Reschedule Proposed' && x.rescheduledDate ? x.rescheduledDate : x.proposedDate;
          const time = x.status === 'Reschedule Proposed' && x.rescheduledTime ? x.rescheduledTime : x.proposedTime;
          if (date < today) return;
          const how: HowType = x.assistType === 'google_meet' || x.assistType === 'strategy_session' || x.status === 'Reschedule Proposed' ? 'meet' : x.assistType === 'join_call' ? 'phone' : 'in_person';
          push(
            make(user, d, date, 0, how, [{ taskId: 'p_assist' }, plannedTask('p_pitch', d)], {
              timeMode: 'exact',
              fixedTime: time,
              locked: x.status === 'Accepted',
              source: 'assist',
              assistManagerName: manager ? `${manager.firstName} ${manager.lastName}` : x.assignedManagerName,
              notes:
                x.status === 'Accepted'
                  ? `${x.assignedManagerName.split(' ')[0]} is joining to help close.`
                  : x.status === 'Pending'
                    ? `Waiting for ${x.assignedManagerName.split(' ')[0]} to accept.`
                    : `${x.assignedManagerName.split(' ')[0]} proposed this new time (Google Meet).`
            })
          );
        });

      // 3) Scheduled / accepted manager priorities
      priorities
        .filter(pr => pr.targetType === 'rep' && pr.targetId === user.id && (pr.status === 'scheduled' || pr.status === 'accepted') && pr.linkedDealershipId && pr.dueDate >= today)
        .forEach(pr => {
          const d = dealerById.get(pr.linkedDealershipId!);
          if (!d) return;
          const date = isWeekend(pr.dueDate) ? nextWeekday(pr.dueDate) : pr.dueDate;
          if (taken(date, d.id)) return;
          const work = workTypeForStage(d.stage) ?? 'prospect';
          push(
            make(user, d, date, 1, 'in_person', defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).map(t => plannedTask(t, d)), {
              source: 'manager_priority',
              managerPriorityFrom: pr.managerName,
              notes: pr.title
            })
          );
        });

      const inBasket = new Set<string>();
      // Deals the rep left without a next step stay that way (the demo shows the warning).
      const lastTags = (id: string) =>
        activities.filter(a => a.dealershipId === id && a.status === 'completed' && a.activityType !== 'System Note').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0]?.tags ?? [];
      book.filter(d => lastTags(d.id).some(t => t === 'no_next_step' || t.startsWith('next_skipped'))).forEach(d => inBasket.add(d.id));
      const booked = new Set([...latestByDealer.values()].filter(a => a.nextActionDate && a.nextActionDate >= today).map(a => a.dealershipId));

      // 4) Fill each plan day with sensible stops (each dealership once a week)
      const fill = (date: string, wanted: number, pool: Dealership[], startIdx: number, allowRepeat = false) => {
        const count = () => slots.filter(s => s.userId === user.id && s.date === date && s.how !== 'email' && s.how !== 'text' && s.target.kind !== 'block').length;
        let i = 0;
        while (count() < wanted && i < pool.length * 2) {
          const d = pool[(startIdx + i) % pool.length];
          i++;
          if (!d || taken(date, d.id) || inBasket.has(d.id) || (!allowRepeat && (thisWeek.has(d.id) || booked.has(d.id)))) continue;
          const work = workTypeForStage(d.stage)!;
          const ids = defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog));
          const taskIds = work === 'client' && i % 2 === 0 ? [...ids, 'c_upsell'] : ids;
          push(make(user, d, date, count(), 'in_person', taskIds.map(t => plannedTask(t, d))));
        }
      };
      const mixed = [...clientsDue, ...live].filter((d, i, a) => a.indexOf(d) === i);
      // Today comes first, so the day the demo is opened is always a real working day
      if (!isWeekend(today)) {
        fill(today, 3, mixed, 0);
        fill(today, 3, local.filter(d => d.stage !== 'Not Now'), 0, true); // small book: reuse a dealership booked later in the week
      }

      // 5) Plan-later basket: Not Now nurture dates, fresh claims, upsell ideas, low health
      const basket: { d: Dealership; note: string }[] = [];
      book.forEach(d => {
        if (thisWeek.has(d.id) || inBasket.has(d.id)) return;
        if (d.stage === 'Not Now' && d.nurtureFollowUpDate) basket.push({ d, note: `Nurture follow-up due ${d.nurtureFollowUpDate}` });
        else if (d.stage === 'Client' && (d.clientHealthScore ?? 100) < 70) basket.push({ d, note: 'Health is low — book a proper visit with the owner' });
        else if (d.stage === 'Client' && d.upsells.some(u => u.stage === 'Interested' || u.stage === 'Identified')) {
          const u = d.upsells.find(x => x.stage === 'Interested' || x.stage === 'Identified')!;
          basket.push({ d, note: `${u.productName}: ${u.nextStep}` });
        } else if (['Visited', 'Follow-up'].includes(d.stage) && !latestByDealer.get(d.id)?.nextActionDate) basket.push({ d, note: 'Second visit — bring the claims sample' });
      });
      if (basket.length < 2) {
        local.filter(d => d.stage === 'Client' && !thisWeek.has(d.id) && !basket.some(b => b.d === d)).slice(0, 2 - basket.length).forEach(d => basket.push({ d, note: 'Drop off refreshed menu cards' }));
      }
      basket.forEach(b => inBasket.add(b.d.id));
      basket.slice(0, 6).forEach(({ d, note }, j) => {
        const work = workTypeForStage(d.stage)!;
        slots.push(make(user, d, undefined, j, 'in_person', defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).map(t => plannedTask(t, d)), { basketNote: note }));
      });

      planDays.forEach((date, k) => {
        if (k === 0 && !isWeekend(today)) return; // today was filled first
        fill(date, 2, k % 2 === 0 ? mixed : [...live, ...clientsDue], k * 2);
      });

      const [p1, , p3, p4, p5] = planDays;
      // Weekly team call (Google Calendar) on the first plan day
      push({
        id: sid('slot'),
        userId: user.id,
        date: p1,
        orderIndex: 0,
        status: 'planned',
        how: 'meet',
        workType: 'block',
        target: { kind: 'block', id: 'blk_team', name: 'Weekly team call' },
        tasks: [],
        contactIds: [],
        contactNames: [],
        timeMode: 'exact',
        fixedTime: '08:30',
        durationMin: 30,
        locked: true,
        source: 'calendar',
        createdAt: nowISO,
        updatedAt: nowISO
      });

      // Personal Google Calendar events (busy — no visits then)
      const PERSONAL = [
        { name: 'Dentist', time: '15:30', min: 60 },
        { name: 'School pickup', time: '15:00', min: 45 },
        { name: 'Car service', time: '08:00', min: 60 },
        { name: 'Doctor’s appointment', time: '16:15', min: 60 },
        { name: 'Kids’ game', time: '15:45', min: 60 }
      ];
      const pi = users.filter(u => u.role.endsWith('_rep')).indexOf(user);
      const pe = PERSONAL[pi % PERSONAL.length];
      const peDay = planDays[1 + (pi % 3)];
      if (peDay)
        slots.push({
          id: sid('slot'),
          userId: user.id,
          date: peDay,
          orderIndex: 90,
          status: 'planned',
          how: 'in_person',
          workType: 'block',
          target: { kind: 'block', id: `blk_personal_${pi}`, name: pe.name },
          tasks: [],
          contactIds: [],
          contactNames: [],
          timeMode: 'exact',
          fixedTime: pe.time,
          durationMin: pe.min,
          locked: true,
          source: 'calendar',
          notes: 'From your Google Calendar (busy)',
          createdAt: nowISO,
          updatedAt: nowISO
        });

      // Email batch on the first plan day: follow-ups to recent first visits
      const emailTargets = local.filter(d => ['Visited', 'Follow-up', 'In Progress', 'HOT'].includes(d.stage) && !taken(p1, d.id) && !inBasket.has(d.id) && !/send|email/i.test(latestByDealer.get(d.id)?.nextAction ?? '')).slice(0, 2);
      if (emailTargets.length) {
        const times = staggerSendTimes('email', suggestSendTime('email', p1), emailTargets.length);
        const batch = sid('batch');
        emailTargets.forEach((d, j) =>
          push(
            make(user, d, p1, 100 + j, 'email', [plannedTask('p_followup', d)], {
              sendTime: times[j],
              batchId: batch,
              message: `Hi {first name}, thanks again for your time. Ahead of our next conversation, here’s how similar stores near ${d.city} use ${d.productInterests[0]?.productName ?? 'Keyfetch'}. Happy to walk through it this week.`
            })
          )
        );
      }

      // Over-full day for the top rep, who tends to squeeze in too much (shows the warnings)
      if (p3) fill(p3, user.id === 'u_kevin' ? 6 : 3, [...local].sort((a, b) => a.dealershipName.localeCompare(b.dealershipName)), 0, user.id === 'u_kevin');

      // Trip day for out-of-town accounts
      if (p4 && !far.length) fill(p4, 2, [...live, ...clientsDue], 3);
      if (p4 && user.isRookie)
        push({
          id: sid('slot'),
          userId: user.id,
          date: p4,
          orderIndex: 0,
          status: 'planned',
          how: 'meet',
          workType: 'block',
          target: { kind: 'block', id: 'blk_training', name: 'Rookie product training — Ceramic Pro & EV Solutions' },
          tasks: [],
          contactIds: [],
          contactNames: [],
          timeMode: 'exact',
          fixedTime: '09:30',
          durationMin: 180,
          locked: true,
          source: 'calendar',
          notes: 'With Jose Matos (Google Meet)',
          createdAt: nowISO,
          updatedAt: nowISO
        });
      if (p4 && far.length) far.slice(0, 2).forEach((d, j) => push(make(user, d, p4, j, 'in_person', defaultTaskIds(d.stage, 'client', hasKeyfetch(d, catalog)).map(t => plannedTask(t, d)), { notes: 'Trip day — outside the 60-mile territory' })));

      // Dealer-group meeting + call list on the last plan day
      const myGroups = groups.filter(g => book.some(d => d.groupId === g.id));
      const group = myGroups[0];
      if (p5 && group) {
        const rooftops = book.filter(d => d.groupId === group.id && band(d) !== 'out_of_town').slice(0, 3);
        if (rooftops.length) {
          slots.push({
            id: sid('slot'),
            userId: user.id,
            date: p5,
            orderIndex: 0,
            status: 'planned',
            how: 'in_person',
            workType: 'group',
            target: targetFromGroup(group, rooftops),
            tasks: [{ taskId: 'g_meeting' }, { taskId: 'g_pitch', productIds: ['prod_10'] }],
            contactIds: [],
            contactNames: [group.mainDecisionMaker.replace(/ \(.*\)$/, '')],
            timeMode: 'flow',
            durationMin: durationFor('in_person', [{ taskId: 'g_meeting' }, { taskId: 'g_pitch' }]),
            source: 'seed',
            notes: `Quarterly review at ${group.hqCity} HQ`,
            createdAt: nowISO,
            updatedAt: nowISO
          });
        }
        const callBatch = sid('batch');
        clientsDue
          .filter(d => !taken(p5, d.id) && !inBasket.has(d.id))
          .slice(-3)
          .forEach((d, j) => push(make(user, d, p5, j + 1, 'phone', [plannedTask('c_checkin', d)], { batchId: callBatch })));
      }

      // Action points from real open items
      const ap = (title: string, d: Dealership | undefined, dueDate: string | undefined, done = false): ActionPoint => ({
        id: sid('ap'),
        userId: user.id,
        title,
        dealershipId: d?.id,
        dealershipName: d?.dealershipName,
        dueDate,
        done,
        doneAt: done ? nowISO : undefined,
        source: 'task',
        createdAt: nowISO,
        updatedAt: nowISO
      });
      // Keyfetch refills ordered on a visit but not delivered yet
      activities
        .filter(a => a.userId === user.id && a.tags?.includes('refill'))
        .forEach(a => {
          const delivered = activities.some(t => t.dealershipId === a.dealershipId && t.activityType === 'Keyfetch Top-up' && (t.completedAt ?? '') > (a.completedAt ?? ''));
          const qty = a.notes.match(/refill of (\d+)/)?.[1];
          const d = dealerById.get(a.dealershipId);
          if (!d) return;
          if (!delivered) actionPoints.push(ap(`Place Keyfetch order for ${d.dealershipName} — ${qty} tags (order system)`, d, addDays(a.plannedDate!, 1)));
        });
      const lastDelivered = activities.filter(a => a.userId === user.id && a.activityType === 'Keyfetch Top-up').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
      if (lastDelivered) {
        const d = dealerById.get(lastDelivered.dealershipId);
        actionPoints.push(ap(`Place Keyfetch order for ${lastDelivered.dealershipName} — ${lastDelivered.notes.match(/(\d+) tags/)?.[1]} tags (order system)`, d, lastDelivered.plannedDate, true));
      }
      workspace
        .filter(w => w.userId === user.id && w.isMatched && w.actionItems?.length)
        .forEach(w => w.actionItems!.forEach(t => actionPoints.push(ap(t, w.dealershipId ? dealerById.get(w.dealershipId) : undefined, planDays[0]))));
      dealerships
        .filter(d => d.assignedRepId === user.id && d.onboardingTasks?.some(t => !t.completed))
        .forEach(d => {
          const t = d.onboardingTasks!.find(x => !x.completed)!;
          actionPoints.push(ap(`${d.dealershipName}: ${t.title}`, d, t.dueDate < today ? planDays[0] : t.dueDate));
        });
      actionPoints.push(ap('Update mileage log for the week', undefined, planDays[planDays.length - 1]));
    }

    if (isManager) {
      const reps = users.filter(u => u.managerId === user.id);
      // History: Manager Assists they joined in the last 4 weeks
      assists
        .filter(x => x.assignedManagerId === user.id && x.status === 'Completed' && x.completedAt && x.proposedDate >= historyFrom && x.proposedDate < today)
        .forEach((x, j) => {
          const d = dealerById.get(x.dealershipId);
          if (!d) return;
          const how: HowType = x.assistType === 'google_meet' ? 'meet' : x.assistType === 'join_call' ? 'phone' : 'in_person';
          slots.push(
            make(user, d, x.proposedDate, j, how, [{ taskId: 'p_assist', outcome: { kind: 'simple', result: 'done' } }], {
              status: 'done',
              timeMode: 'exact',
              fixedTime: x.proposedTime,
              checkInAt: x.completedAt,
              completedAt: new Date(new Date(x.completedAt!).getTime() + 45 * 60000).toISOString(),
              outcomeNote: x.outcomeNotes,
              notes: `Assist for ${x.originRepName}`,
              source: 'assist',
              contactNames: [x.decisionMakerName],
              spokeWithNames: [x.decisionMakerName]
            })
          );
        });
      // Mirror each accepted assist onto the manager's plan
      assists
        .filter(x => x.assignedManagerId === user.id && x.status === 'Accepted' && x.proposedDate >= today)
        .forEach((x, j) => {
          const d = dealerById.get(x.dealershipId);
          if (!d) return;
          const rep = reps.find(r => r.id === x.originRepId);
          slots.push(
            make(user, d, x.proposedDate, j, x.assistType === 'strategy_session' || x.assistType === 'google_meet' ? 'meet' : 'in_person', [{ taskId: 'p_assist' }], {
              timeMode: 'exact',
              fixedTime: x.proposedTime,
              locked: true,
              source: 'assist',
              notes: `Assist for ${rep ? `${rep.firstName} ${rep.lastName}` : x.originRepName}`,
              contactNames: [x.decisionMakerName]
            })
          );
        });
      const ownGroup = groups.find(g => g.groupAccountOwnerId === user.id);
      if (ownGroup) {
        const rooftops = dealerships.filter(d => d.groupId === ownGroup.id).slice(0, 4);
        slots.push({
          id: sid('slot'),
          userId: user.id,
          date: planDays[2] ?? upcoming[2],
          orderIndex: 0,
          status: 'planned',
          how: 'meet',
          workType: 'group',
          target: targetFromGroup(ownGroup, rooftops),
          tasks: [{ taskId: 'g_meeting' }, { taskId: 'g_expand' }],
          contactIds: [],
          contactNames: [ownGroup.mainDecisionMaker.replace(/ \(.*\)$/, '')],
          timeMode: 'exact',
          fixedTime: '14:00',
          durationMin: 45,
          source: 'seed',
          createdAt: nowISO,
          updatedAt: nowISO
        });
      }
      const pendingCount = assists.filter(x => x.assignedManagerId === user.id && x.status === 'Pending').length;
      actionPoints.push({
        id: sid('ap'),
        userId: user.id,
        title: pendingCount ? `Answer ${pendingCount} pending assist request${pendingCount > 1 ? 's' : ''}` : 'Review this week’s assist requests',
        dueDate: planDays[0],
        done: false,
        source: 'manual',
        createdAt: nowISO,
        updatedAt: nowISO
      });
    }
  }

  // Order each upcoming day by time: booked times first in clock order,
  // flexible stops fitted in between (emails / texts keep their send time).
  const groupsByDay = new Map<string, PlanSlot[]>();
  slots.filter(s => s.status === 'planned' && s.date).forEach(s => {
    const k = `${s.userId}|${s.date}`;
    groupsByDay.set(k, [...(groupsByDay.get(k) ?? []), s]);
  });
  groupsByDay.forEach(list => {
    const live = list.filter(s => s.how !== 'email' && s.how !== 'text');
    const flex = live.filter(s => !(s.timeMode === 'exact' && s.fixedTime));
    const fixed = live.filter(s => s.timeMode === 'exact' && s.fixedTime).sort((a, b) => a.fixedTime!.localeCompare(b.fixedTime!));
    const morning = fixed.filter(f => Number(f.fixedTime!.slice(0, 2)) < 13);
    const afternoon = fixed.filter(f => Number(f.fixedTime!.slice(0, 2)) >= 13);
    const ordered: PlanSlot[] = [...morning, ...flex.slice(0, 1), ...afternoon, ...flex.slice(1)];
    ordered.forEach((s, i) => (s.orderIndex = i));
  });
  return { slots, actionPoints };
}
