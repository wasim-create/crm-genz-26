// Realistic demo plans for every user, built from the CRM's real seeded
// dealerships, groups and contacts, relative to TODAY so the demo always
// looks current: 4 weeks of history, today, the next week (partly planned),
// a plan-later basket, action points, a dealer-group meeting, a trip, an email
// batch, a call list, an over-full day and a locked Manager Assist meeting.

import { Contact, DealerGroup, Dealership, ProductCatalogItem, User } from '../../../types/crm';
import { ActionPoint, HowType, PlanSlot, SlotTask, TaskOutcome, WorkType } from '../types';
import { distanceBand, milesBetween } from '../engine/geo';
import { defaultTaskIds, durationFor, TASK_BY_ID, workTypeForStage } from '../engine/tasks';
import { addDays, isWeekend, nextWeekday, toHHMM } from '../engine/time';
import { staggerSendTimes, suggestSendTime } from '../engine/schedule';
import { hasKeyfetch } from '../services/suggestions';

export interface SeedInput {
  users: User[];
  dealerships: Dealership[];
  contacts: Contact[];
  groups: DealerGroup[];
  catalog: ProductCatalogItem[];
  today: string;
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
    coords: d.coordinates
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
    rooftopIds: rooftops.map(r => r.id)
  };
}

function sampleOutcome(taskId: string, i: number, d: Dealership): { task: SlotTask } {
  const def = TASK_BY_ID[taskId];
  let outcome: TaskOutcome;
  let productIds: string[] | undefined;
  switch (def.outcome) {
    case 'interest':
      productIds = i % 2 ? ['prod_1', 'prod_10'] : ['prod_4'];
      outcome = { kind: 'interest', levels: Object.fromEntries(productIds.map((p, k) => [p, k === 0 ? 'High' : 'Medium'])) };
      break;
    case 'upsell': {
      const owned = d.signedProducts ?? [];
      productIds = ['prod_10', 'prod_4', 'prod_5'].filter(p => !owned.includes(p)).slice(0, 1);
      outcome = { kind: 'upsell', results: Object.fromEntries(productIds.map(p => [p, i % 3 === 0 ? 'Interested' : 'Pitched'])) };
      break;
    }
    case 'keyfetch':
      outcome = i % 2 ? { kind: 'keyfetch', needsRefill: true, quantity: 150 + (i % 3) * 50 } : { kind: 'keyfetch', needsRefill: false };
      break;
    case 'signed':
      productIds = ['prod_3', 'prod_1'];
      outcome = { kind: 'signed', productIds };
      break;
    default:
      outcome = { kind: 'simple', result: i % 4 === 0 ? 'follow_up' : 'done' };
  }
  return { task: { taskId, productIds, outcome } };
}

function plannedTask(taskId: string, d: Dealership): SlotTask {
  const def = TASK_BY_ID[taskId];
  if (def.products === 'not_owned') {
    const owned = d.signedProducts ?? [];
    return { taskId, productIds: ['prod_10', 'prod_4'].filter(p => !owned.includes(p)).slice(0, 1) };
  }
  if (def.products) return { taskId, productIds: ['prod_1', 'prod_10'] };
  return { taskId };
}

export function buildSeed(input: SeedInput): { slots: PlanSlot[]; actionPoints: ActionPoint[] } {
  const { users, dealerships, contacts, groups, catalog, today } = input;
  const nowISO = new Date().toISOString();
  const slots: PlanSlot[] = [];
  const actionPoints: ActionPoint[] = [];

  const make = (
    user: User,
    d: Dealership,
    date: string | undefined,
    orderIndex: number,
    how: HowType,
    tasks: SlotTask[],
    extra: Partial<PlanSlot> = {}
  ): PlanSlot => {
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

  for (const user of users) {
    const isRep = user.role === 'new_rep' || user.role === 'veteran_rep';
    const isManager = user.role === 'manager' || user.role === 'team_lead';
    const home = user.homeCoords;
    const band = (d: Dealership) => distanceBand(milesBetween(home, d.coordinates));

    if (isRep) {
      const mine = dealerships.filter(d => d.assignedRepId === user.id && workTypeForStage(d.stage));
      const local = mine.filter(d => band(d) !== 'out_of_town');
      const far = mine.filter(d => band(d) === 'out_of_town');
      const prospects = local.filter(d => workTypeForStage(d.stage) === 'prospect');
      const clients = local.filter(d => workTypeForStage(d.stage) === 'client');
      const signups = local.filter(d => workTypeForStage(d.stage) === 'signup');
      const hot = prospects.filter(d => d.heatLevel === 'Hot');
      if (local.length === 0) continue;
      const pick = (list: Dealership[], i: number) => (list.length ? list[i % list.length] : local[i % local.length]);

      // --- 4 weeks of history ---
      let k = 0;
      for (let back = 28; back >= 1; back--) {
        const date = addDays(today, -back);
        if (isWeekend(date)) continue;
        const count = 2 + (k % 3);
        for (let j = 0; j < count; j++) {
          const pool = j % 2 === 0 ? prospects : clients.length ? clients : signups;
          const d = pick(pool.length ? pool : local, k + j);
          const work = workTypeForStage(d.stage)!;
          const how: HowType = j === count - 1 && k % 2 === 0 ? 'phone' : 'in_person';
          const taskIds = defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).concat(work === 'client' && j % 2 ? ['c_upsell'] : []);
          const tasks = taskIds.map((t, ti) => sampleOutcome(t, k + j + ti, d).task);
          const startMin = 600 + j * 85;
          const skipped = (k + j) % 11 === 0;
          slots.push(
            make(user, d, date, j, how, tasks, {
              status: skipped ? 'skipped' : 'done',
              skippedReason: skipped ? 'Dealership asked to reschedule' : undefined,
              completedAt: skipped ? undefined : new Date(`${date}T${toHHMM(startMin + 30)}:00`).toISOString(),
              checkInAt: skipped ? undefined : new Date(`${date}T${toHHMM(startMin)}:00`).toISOString(),
              outcomeNote: skipped ? undefined : j % 2 ? 'Good conversation, they want to see numbers from similar lots.' : 'Quick visit, all on track.',
              pointsAwarded: skipped ? 0 : how === 'in_person' ? 40 + (tasks.some(t => t.outcome?.kind === 'upsell') ? 20 : 0) : 10,
              spokeWithNames: undefined
            })
          );
        }
        k++;
      }

      // --- Today ---
      if (!isWeekend(today)) {
        const todays = [pick(clients, 0), pick(prospects, 1), pick(signups.length ? signups : prospects, 2)];
        todays.forEach((d, j) => {
          const work = workTypeForStage(d.stage)!;
          const ids = defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog));
          const taskIds = work === 'client' ? [...ids, 'c_upsell'] : ids;
          slots.push(make(user, d, today, j, 'in_person', taskIds.map(t => plannedTask(t, d))));
        });
        const callTo = pick(prospects, 4);
        slots.push(make(user, callTo, today, 3, 'phone', [plannedTask('p_followup', callTo)]));
        const emailTargets = [pick(prospects, 5), pick(prospects, 6)].filter((d, i, a) => a.indexOf(d) === i);
        const times = staggerSendTimes('email', suggestSendTime('email', today), emailTargets.length);
        const batch = sid('batch');
        emailTargets.forEach((d, j) =>
          slots.push(
            make(user, d, today, 100 + j, 'email', [plannedTask('p_followup', d)], {
              sendTime: times[j],
              batchId: batch,
              message: `Hi {first name}, thanks for your time recently. Happy to share how similar lots in ${d.city} are using our products — would a quick call this week work?`
            })
          )
        );
      }

      // --- Next 5 working days ---
      const [d1, d2, d3, d4, d5] = upcoming;
      // d1: team call from Google Calendar + three visits + a call
      slots.push({
        id: sid('slot'),
        userId: user.id,
        date: d1,
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
      [pick(prospects, 7), pick(clients, 2), pick(prospects, 8)].forEach((d, j) => {
        const work = workTypeForStage(d.stage)!;
        slots.push(make(user, d, d1, j + 1, 'in_person', defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).map(t => plannedTask(t, d))));
      });

      // d2: locked Manager Assist meeting + one more visit
      const manager = users.find(u => u.id === user.managerId);
      const assistTarget = hot[0] ?? pick(prospects, 9);
      slots.push(
        make(user, assistTarget, d2, 0, 'in_person', [{ taskId: 'p_assist' }, plannedTask('p_pitch', assistTarget)], {
          timeMode: 'exact',
          fixedTime: '11:00',
          locked: true,
          source: 'assist',
          assistManagerName: manager ? `${manager.firstName} ${manager.lastName}` : undefined,
          notes: manager ? `${manager.firstName} is joining to help close.` : undefined
        })
      );
      const d2Visit = pick(clients, 3);
      slots.push(make(user, d2Visit, d2, 1, 'in_person', defaultTaskIds(d2Visit.stage, 'client', hasKeyfetch(d2Visit, catalog)).map(t => plannedTask(t, d2Visit))));

      // d3: an over-full day
      local.slice(0, 7).forEach((d, j) => {
        const work = workTypeForStage(d.stage)!;
        slots.push(make(user, d, d3, j, 'in_person', defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).map(t => plannedTask(t, d))));
      });

      // d4: an out-of-town trip day (if the rep has far-away dealerships)
      if (far.length > 0) {
        far.slice(0, 2).forEach((d, j) => {
          const work = workTypeForStage(d.stage)!;
          slots.push(make(user, d, d4, j, 'in_person', defaultTaskIds(d.stage, work, false).map(t => plannedTask(t, d)), { notes: 'Trip day' }));
        });
      }

      // d5: dealer-group meeting + call list (separate slots)
      const myGroupIds = Array.from(new Set(mine.map(d => d.groupId).filter(Boolean))) as string[];
      const group = groups.find(g => myGroupIds.includes(g.id));
      if (group) {
        const rooftops = mine.filter(d => d.groupId === group.id && band(d) !== 'out_of_town').slice(0, 3);
        if (rooftops.length) {
          slots.push({
            id: sid('slot'),
            userId: user.id,
            date: d5,
            orderIndex: 0,
            status: 'planned',
            how: 'in_person',
            workType: 'group',
            target: targetFromGroup(group, rooftops),
            tasks: [{ taskId: 'g_meeting' }, { taskId: 'g_pitch', productIds: ['prod_10'] }],
            contactIds: [],
            contactNames: [group.mainDecisionMaker],
            timeMode: 'flow',
            durationMin: durationFor('in_person', [{ taskId: 'g_meeting' }, { taskId: 'g_pitch' }]),
            source: 'seed',
            createdAt: nowISO,
            updatedAt: nowISO
          });
        }
      }
      const callBatch = sid('batch');
      [pick(clients, 4), pick(clients, 5), pick(prospects, 10)]
        .filter((d, i, a) => a.indexOf(d) === i)
        .forEach((d, j) => slots.push(make(user, d, d5, j + 1, 'phone', [plannedTask(workTypeForStage(d.stage) === 'client' ? 'c_checkin' : 'p_followup', d)], { batchId: callBatch })));

      // --- Plan-later basket ---
      const planned = new Set(slots.filter(s => s.userId === user.id && s.date && s.date >= today && s.date !== d3).map(s => s.target.id));
      const basketNotes = ['Ask about the spring promotion', 'GM back from vacation next week', 'Keyfetch stock looked low', 'Wants to see Ceramic Pro samples', 'Try the new F&I manager', 'Follow up on GAP interest', 'Drop off brochures'];
      const basketPool = local.filter(d => !planned.has(d.id));
      (basketPool.length >= 3 ? basketPool : [...basketPool, ...local.slice().reverse()])
        .filter((d, i, a) => a.indexOf(d) === i)
        .slice(0, 7)
        .forEach((d, j) => {
          const work = workTypeForStage(d.stage)!;
          slots.push(
            make(user, d, undefined, j, 'in_person', defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog)).map(t => plannedTask(t, d)), {
              basketNote: basketNotes[j % basketNotes.length]
            })
          );
        });

      // --- Action points ---
      const c0 = pick(clients, 0);
      const p0 = pick(prospects, 2);
      const s0 = pick(signups.length ? signups : prospects, 0);
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
      actionPoints.push(
        ap(`Place Keyfetch order for ${c0.dealershipName} — 150 units (order system)`, c0, addDays(today, -2)),
        ap(`Send Ceramic Pro details to ${p0.dealershipName}`, p0, today),
        ap(`Call back ${s0.dealershipName} about onboarding dates`, s0, today),
        ap(`Bring a copy of the signed agreement to ${s0.dealershipName}`, s0, d2),
        ap('Update mileage log for the week', undefined, d5),
        ap(`Place Keyfetch order for ${pick(clients, 1).dealershipName} — 200 units (order system)`, pick(clients, 1), addDays(today, -6), true)
      );
    }

    if (isManager) {
      const reps = users.filter(u => u.managerId === user.id);
      const [d1, d2, d3] = upcoming;
      // Mirror each rep's locked Manager Assist meeting onto the manager's plan.
      reps.forEach((rep, j) => {
        const assist = slots.find(s => s.userId === rep.id && s.source === 'assist');
        if (!assist) return;
        slots.push({
          ...assist,
          id: sid('slot'),
          userId: user.id,
          orderIndex: j,
          notes: `Assist for ${rep.firstName} ${rep.lastName}`,
          assistManagerName: undefined,
          contactNames: assist.contactNames
        });
      });
      const ownGroup = groups.find(g => g.groupAccountOwnerId === user.id);
      if (ownGroup) {
        const rooftops = dealerships.filter(d => d.groupId === ownGroup.id).slice(0, 3);
        slots.push({
          id: sid('slot'),
          userId: user.id,
          date: d3,
          orderIndex: 0,
          status: 'planned',
          how: 'meet',
          workType: 'group',
          target: targetFromGroup(ownGroup, rooftops),
          tasks: [{ taskId: 'g_meeting' }, { taskId: 'g_expand' }],
          contactIds: [],
          contactNames: [ownGroup.mainDecisionMaker],
          timeMode: 'exact',
          fixedTime: '14:00',
          durationMin: 45,
          source: 'seed',
          createdAt: nowISO,
          updatedAt: nowISO
        });
        rooftops.slice(0, 2).forEach((d, j) =>
          slots.push(make(user, d, undefined, j, 'phone', [plannedTask('c_checkin', d)], { basketNote: 'Check in with the GM' }))
        );
      }
      void d1;
      void d2;
      actionPoints.push({
        id: sid('ap'),
        userId: user.id,
        title: 'Review this week’s assist requests',
        dueDate: today,
        done: false,
        source: 'manual',
        createdAt: nowISO,
        updatedAt: nowISO
      });
    }
  }

  return { slots, actionPoints };
}
