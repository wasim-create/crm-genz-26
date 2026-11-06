import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanSlot } from '../../types';
import { DEFAULT_ENGINE_SETTINGS, distanceBand, estimateDriveMinutes, milesBetween } from '../geo';
import {
  layoutDay,
  moveByArrow,
  pastEditWindow,
  reorderDay,
  sendTimeAdvice,
  staggerSendTimes,
  suggestPlacements,
  suggestSendTime
} from '../schedule';
import { durationFor, workTypeForStage } from '../tasks';
import { format12h, startOfWeek, toMin } from '../time';

// Carlos Martinez lives in Dallas.
const HOME = { lat: 32.7876, lng: -96.7996 };
const PLANO = { lat: 33.019, lng: -96.698 };
const FRISCO = { lat: 33.15, lng: -96.823 };
const FORT_WORTH = { lat: 32.755, lng: -97.33 };
const WACO = { lat: 31.549, lng: -97.146 };
const ctx = { home: HOME, settings: DEFAULT_ENGINE_SETTINGS };

let n = 0;
function slot(partial: Partial<PlanSlot> & { name?: string; coords?: { lat: number; lng: number } }): PlanSlot {
  n += 1;
  const { name, coords, ...rest } = partial;
  return {
    id: rest.id ?? `s${n}`,
    userId: 'u_carlos',
    date: '2026-11-10',
    orderIndex: n,
    status: 'planned',
    how: 'in_person',
    workType: 'prospect',
    target: { kind: 'dealership', id: `d${n}`, name: name ?? `Dealer ${n}`, coords },
    tasks: [{ taskId: 'p_followup' }],
    contactIds: [],
    contactNames: [],
    timeMode: 'flow',
    durationMin: 30,
    source: 'manual',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
    ...rest
  };
}

test('distance bands: ≤60 home, 60–69 edge, 70+ out of town', () => {
  assert.equal(distanceBand(42), 'home');
  assert.equal(distanceBand(60), 'home');
  assert.equal(distanceBand(64), 'edge');
  assert.equal(distanceBand(69), 'edge');
  assert.equal(distanceBand(70), 'out_of_town');
  assert.equal(distanceBand(milesBetween(HOME, WACO)), 'out_of_town');
});

test('distances use real coordinates in every region (not a Texas-only lookup)', () => {
  const boston = { lat: 42.3588, lng: -71.0638 };
  const worcester = { lat: 42.262, lng: -71.802 };
  const d = milesBetween(boston, worcester);
  assert.ok(d > 35 && d < 45, `Boston→Worcester ≈ 38 mi, got ${d}`);
});

test('drive time: ×1.3 road factor, 30 mph metro / 50 mph longer, rounded up to 5 min', () => {
  assert.equal(estimateDriveMinutes(10), 30); // 13 road mi @30 = 26 → 30
  assert.equal(estimateDriveMinutes(40), 65); // 52 road mi @50 = 62.4 → 65
  assert.equal(estimateDriveMinutes(0), 0);
});

test('empty day: no travel, no leave-by, fullness empty', () => {
  const layout = layoutDay([], ctx);
  assert.equal(layout.hasInPerson, false);
  assert.equal(layout.leaveBy, undefined);
  assert.equal(layout.driveMin, 0);
  assert.equal(layout.fullness, 'empty');
});

test('phone-only day: no travel and no leave-by time', () => {
  const day = [slot({ how: 'phone', durationMin: 15 }), slot({ how: 'phone', durationMin: 15 })];
  const layout = layoutDay(day, ctx);
  assert.equal(layout.hasInPerson, false);
  assert.equal(layout.leaveBy, undefined);
  assert.equal(layout.driveMin, 0);
  assert.equal(layout.rows.filter(r => r.kind === 'travel').length, 0);
  // Calls are live contact, so they start at 10:00 AM.
  assert.equal(format12h(layout.timings[day[0].id].start), '10:00 AM');
});

test('first visit starts at 10 AM and leave-by = start − drive − parking − margin', () => {
  const a = slot({ name: 'Plano Ford', coords: PLANO });
  const layout = layoutDay([a], ctx);
  const t = layout.timings[a.id];
  assert.equal(format12h(t.start), '10:00 AM');
  const drive = estimateDriveMinutes(milesBetween(HOME, PLANO));
  assert.equal(t.travelBefore, drive + 10);
  assert.equal(layout.leaveBy, t.start - drive - 10 - 10);
  assert.ok(layout.homeAt! > t.end, 'home time comes after the last visit');
});

test('leave-by never falls during an earlier item such as a team call from home', () => {
  const call = slot({ how: 'meet', orderIndex: 0, timeMode: 'exact', fixedTime: '08:30', durationMin: 30, target: { kind: 'block', id: 'b', name: 'Team call' } });
  const visit = slot({ name: 'Fort Worth', coords: FORT_WORTH, orderIndex: 1 });
  const layout = layoutDay([call, visit], ctx);
  assert.ok(layout.leaveBy! >= layout.timings[call.id].end, 'leave after the call ends');
});

test('drive between visits is dealership-to-dealership', () => {
  const a = slot({ name: 'Plano', coords: PLANO, orderIndex: 0 });
  const b = slot({ name: 'Frisco', coords: FRISCO, orderIndex: 1 });
  const layout = layoutDay([a, b], ctx);
  const expected = estimateDriveMinutes(milesBetween(PLANO, FRISCO)) + 10;
  assert.equal(layout.timings[b.id].travelBefore, expected);
});

test('▼ arrow swap: both slots get new times from their new positions (bug fix)', () => {
  const a = slot({ name: 'Plano', coords: PLANO, orderIndex: 0, timeMode: 'exact', fixedTime: '10:00' });
  const b = slot({ name: 'Fort Worth', coords: FORT_WORTH, orderIndex: 1, timeMode: 'exact', fixedTime: '13:30' });
  const swapped = moveByArrow([a, b], a.id, 'down');
  const after = layoutDay(swapped, ctx);
  assert.deepEqual(after.sequence, [b.id, a.id]);
  // Plano moved down into Fort Worth's 1:30 PM slot…
  assert.equal(format12h(after.timings[a.id].start), '1:30 PM');
  // …and Fort Worth now comes first instead of keeping a stale time.
  assert.equal(format12h(after.timings[b.id].start), '10:00 AM');
});

test('arrows on flowing slots: the new first slot does NOT keep its old later time', () => {
  const a = slot({ name: 'Plano', coords: PLANO, orderIndex: 0 });
  const b = slot({ name: 'Frisco', coords: FRISCO, orderIndex: 1 });
  const swapped = moveByArrow([a, b], b.id, 'up');
  const after = layoutDay(swapped, ctx);
  assert.equal(after.sequence[0], b.id);
  assert.equal(format12h(after.timings[b.id].start), '10:00 AM');
});

test('locked slot keeps its time and others flow around it; a locked slot cannot be moved', () => {
  const locked = slot({ name: 'Manager Assist', coords: PLANO, orderIndex: 1, locked: true, fixedTime: '11:30', durationMin: 45 });
  const a = slot({ name: 'Frisco', coords: FRISCO, orderIndex: 0 });
  const c = slot({ name: 'Fort Worth', coords: FORT_WORTH, orderIndex: 2 });
  const day = [a, locked, c];
  const unchanged = moveByArrow(day, locked.id, 'up');
  assert.deepEqual(unchanged, day);

  const moved = reorderDay(day, c.id, 0);
  const layout = layoutDay(moved, ctx);
  assert.equal(format12h(layout.timings[locked.id].start), '11:30 AM');
});

test('overlap with a locked slot is flagged in plain English', () => {
  const longVisit = slot({ name: 'Frisco', coords: FRISCO, orderIndex: 0, durationMin: 90 });
  const locked = slot({ name: 'Plano Assist', coords: PLANO, orderIndex: 1, locked: true, fixedTime: '11:00' });
  const layout = layoutDay([longVisit, locked], ctx);
  const w = layout.warnings.find(x => x.code === 'late_for_fixed');
  assert.ok(w, 'expected a late warning');
  assert.match(w!.message, /can't reach Plano Assist by 11:00 AM/);
  assert.equal(format12h(layout.timings[locked.id].start), '11:00 AM');
});

test('live contact outside 10–4 is flagged; email/text never take live time', () => {
  const early = slot({ how: 'phone', timeMode: 'exact', fixedTime: '08:30', durationMin: 15 });
  const late = slot({ how: 'phone', timeMode: 'exact', fixedTime: '15:55', durationMin: 15 });
  const email = slot({ how: 'email', durationMin: 5, sendTime: '10:15' });
  const layout = layoutDay([early, late, email], ctx);
  const codes = layout.warnings.filter(w => w.code === 'outside_live').map(w => w.slotId);
  assert.deepEqual(codes.sort(), [early.id, late.id].sort());
  assert.ok(!layout.sequence.includes(email.id));
  assert.equal(layout.messages[0].slotId, email.id);
});

test('out-of-town visits are flagged as a trip candidate', () => {
  const layout = layoutDay([slot({ name: 'Waco Toyota', coords: WACO })], ctx);
  assert.ok(layout.warnings.some(w => w.code === 'out_of_town'));
});

test('over-full day is detected', () => {
  const day = Array.from({ length: 9 }, (_, i) => slot({ coords: i % 2 ? PLANO : FORT_WORTH, orderIndex: i, durationMin: 45 }));
  const layout = layoutDay(day, ctx);
  assert.equal(layout.fullness, 'too_much');
  assert.ok(layout.warnings.some(w => w.code === 'long_day'));
});

test('overrun: extending a visit pushes later slots and can push one past 4 PM', () => {
  const a = slot({ name: 'Plano', coords: PLANO, orderIndex: 0, durationMin: 60 });
  const b = slot({ how: 'phone', name: 'Call', orderIndex: 1, timeMode: 'exact', fixedTime: '14:00', durationMin: 15 });
  const c = slot({ how: 'phone', name: 'Late call', orderIndex: 2, durationMin: 15 });
  const base = layoutDay([a, b, c], ctx);
  const extended = layoutDay([{ ...a, durationMin: 60 + 330 }, b, c], ctx);
  assert.ok(extended.timings[c.id].start > base.timings[c.id].start);
  assert.ok(extended.warnings.some(w => w.code === 'outside_live' && w.slotId === c.id));
});

test('lunch is placed once, after noon', () => {
  const day = Array.from({ length: 5 }, (_, i) => slot({ coords: PLANO, orderIndex: i, durationMin: 45 }));
  const layout = layoutDay(day, ctx);
  const lunches = layout.rows.filter(r => r.kind === 'lunch');
  assert.equal(lunches.length, 1);
  assert.ok((lunches[0] as { start: number }).start >= 12 * 60);
});

test('slot suggestions prefer the least extra driving and explain why', () => {
  const plano = slot({ name: 'Plano Ford', coords: PLANO, orderIndex: 0 });
  const fw = slot({ name: 'Fort Worth Honda', coords: FORT_WORTH, orderIndex: 1 });
  const frisco = slot({ id: 'cand', name: 'Frisco Kia', coords: FRISCO, orderIndex: 99, date: '2026-11-10' });
  const suggestions = suggestPlacements([plano, fw], frisco, ctx);
  assert.ok(suggestions.length >= 2);
  assert.ok(suggestions[0].fits);
  assert.match(suggestions[0].reason, /Plano Ford|First stop/);
  // Frisco is next to Plano, so placing it right after Plano beats after Fort Worth.
  assert.equal(suggestions[0].index <= 1, true);
});

test('email send times: Monday afternoon, Tue–Thu morning; batches are staggered separately', () => {
  assert.equal(suggestSendTime('email', '2026-11-09'), '14:00'); // Monday
  assert.equal(suggestSendTime('email', '2026-11-10'), '10:15'); // Tuesday
  assert.deepEqual(staggerSendTimes('email', '10:15', 3), ['10:15', '10:20', '10:25']);
  assert.equal(sendTimeAdvice('email', '2026-11-10', '10:20'), null);
  assert.ok(sendTimeAdvice('email', '2026-11-09', '09:00'));
});

test('past-slot edit window is 24 hours', () => {
  const done = { completedAt: '2026-11-05T15:00:00Z', date: '2026-11-05' };
  assert.equal(pastEditWindow(done, new Date('2026-11-06T10:00:00Z')).open, true);
  assert.equal(pastEditWindow(done, new Date('2026-11-06T15:30:00Z')).open, false);
});

test('stage mapping: prospects, sign-up & onboarding, clients', () => {
  assert.equal(workTypeForStage('HOT'), 'prospect');
  assert.equal(workTypeForStage('Visited'), 'prospect');
  assert.equal(workTypeForStage('Contract'), 'signup');
  assert.equal(workTypeForStage('Onboarding'), 'signup');
  assert.equal(workTypeForStage('Client'), 'client');
  assert.equal(workTypeForStage('Lost'), null);
});

test('several tasks on one visit add up realistically, capped', () => {
  assert.equal(durationFor('in_person', [{ taskId: 'c_checkin' }]), 20);
  assert.equal(durationFor('in_person', [{ taskId: 'c_upsell' }, { taskId: 'c_keyfetch' }]), 30);
  assert.ok(durationFor('in_person', [{ taskId: 's_training' }, { taskId: 's_contract' }, { taskId: 's_setup' }]) <= 90);
  assert.equal(durationFor('email', [{ taskId: 'c_upsell' }]), 5);
});

test('week helpers', () => {
  assert.equal(startOfWeek('2026-11-08'), '2026-11-02'); // Sunday → previous Monday
  assert.equal(startOfWeek('2026-11-06'), '2026-11-02');
  assert.equal(toMin('13:45'), 825);
});

// ---------- v2 behaviours ----------
import { checkDuplicates, dragIntent, holdRestOfDay, nudgedTime, replanPreview } from '../schedule';
import { isClockChangeDay, utcOffsetMinutes, zoneDiffMinutes, zoneFor } from '../timezones';

test('arrow swap: the moved slot takes the earlier slot’s set time; the other follows after', () => {
  const a = slot({ name: 'A', coords: PLANO, orderIndex: 0, timeMode: 'exact', fixedTime: '10:30' });
  const b = slot({ name: 'B', coords: FRISCO, orderIndex: 1 });
  const after = layoutDay(moveByArrow([a, b], b.id, 'up'), ctx);
  assert.deepEqual(after.sequence, [b.id, a.id]);
  assert.equal(format12h(after.timings[b.id].start), '10:30 AM');
  assert.ok(after.timings[a.id].start >= after.timings[b.id].end);
});

test('smart drag: 5-min steps up to 15, 10-min up to 60, 30-min up to 3 h, swap past half the neighbour', () => {
  const half = 100;
  assert.deepEqual(dragIntent(4, half, true), { mode: 'none' });
  assert.deepEqual(dragIntent(-12, half, true), { mode: 'nudge', minutes: -5 });
  assert.deepEqual(dragIntent(30, half, true), { mode: 'nudge', minutes: 15 });
  assert.deepEqual(dragIntent(36, half, true), { mode: 'nudge', minutes: 20 });
  assert.deepEqual(dragIntent(-64, half, true), { mode: 'nudge', minutes: -60 });
  assert.deepEqual(dragIntent(70, half, true), { mode: 'nudge', minutes: 90 });
  assert.deepEqual(dragIntent(99, half, true), { mode: 'nudge', minutes: 180 });
  assert.deepEqual(dragIntent(-101, half, true), { mode: 'swap', direction: 'up' });
  // no neighbour to swap with → keeps nudging
  assert.equal(dragIntent(150, half, false).mode, 'nudge');
  assert.equal(nudgedTime(10 * 60 + 10, 90), 12 * 60); // 11:40 → lands on 12:00
  assert.equal(nudgedTime(10 * 60, -5), 9 * 60 + 55);
});

test('check-in holds the rest of the day; re-plan moves them only when asked', () => {
  const a = slot({ name: 'A', coords: PLANO, orderIndex: 0, durationMin: 30 });
  const b = slot({ name: 'B', coords: FRISCO, orderIndex: 1, durationMin: 30 });
  const lay = layoutDay([a, b], ctx);
  const plannedB = lay.timings[b.id].start;
  // Rep arrives 40 minutes late.
  const late = new Date(`2026-11-10T${'10:40'}:00`).toISOString();
  const held = holdRestOfDay([a, b], lay, a.id).map(x => (x.id === a.id ? { ...x, status: 'in_progress' as const, checkInAt: late } : x));
  const now = layoutDay(held, ctx);
  assert.equal(now.timings[a.id].start, 10 * 60 + 40, 'actual check-in time is used');
  assert.equal(now.timings[b.id].start, plannedB, 'B has NOT moved by itself');
  assert.ok(now.warnings.some(w => w.code === 'late_for_fixed' && w.slotId === b.id), 'overlap is flagged');
  const preview = replanPreview(held, ctx);
  assert.equal(preview.changes.length, 1);
  assert.ok(preview.changes[0].to > preview.changes[0].from, 'B would move later');
});

test('lunch: flexible, fixed per day, or off', () => {
  const day = Array.from({ length: 5 }, (_, i) => slot({ coords: PLANO, orderIndex: i, durationMin: 45 }));
  const fixed = layoutDay(day, { ...ctx, settings: { ...ctx.settings, lunchFlexible: false, lunchTime: '13:00', lunchDurationMin: 45 } });
  const l = fixed.rows.find(r => r.kind === 'lunch') as { start: number; end: number };
  assert.ok(l.start >= 13 * 60 && l.end - l.start === 45);
  const off = layoutDay(day, { ...ctx, settings: { ...ctx.settings, lunch: false } });
  assert.equal(off.rows.filter(r => r.kind === 'lunch').length, 0);
});

test('time zones & daylight saving: Arizona vs Denver, Eastern vs Central, clock-change days', () => {
  assert.equal(zoneFor('AZ'), 'America/Phoenix');
  assert.equal(zoneFor('TX', 'El Paso'), 'America/Denver');
  assert.equal(zoneDiffMinutes('America/Denver', 'America/Phoenix', '2026-07-15'), -60); // summer: Phoenix 1 h behind
  assert.equal(zoneDiffMinutes('America/Denver', 'America/Phoenix', '2026-01-15'), 0); // winter: same
  assert.equal(zoneDiffMinutes('America/Chicago', 'America/New_York', '2026-11-10'), 60);
  assert.equal(utcOffsetMinutes('America/New_York', '2026-11-02'), -300);
  assert.equal(isClockChangeDay('America/New_York', '2026-11-01'), 'back');
  assert.equal(isClockChangeDay('America/New_York', '2026-03-08'), 'forward');
  assert.equal(isClockChangeDay('America/Phoenix', '2026-03-08'), null);
  assert.equal(isClockChangeDay('America/New_York', '2026-10-31'), null);
});

test('10–4 is the dealership’s time: a Dallas rep calling New York at 3:30 PM is too late there', () => {
  const call = slot({ how: 'phone', timeMode: 'exact', fixedTime: '15:30', durationMin: 15 });
  const layout = layoutDay([call], { ...ctx, tzDiff: () => 60 });
  assert.ok(layout.warnings.some(w => w.code === 'outside_live'));
  const suggested = layoutDay([slot({ how: 'phone', durationMin: 15 })], { ...ctx, tzDiff: () => 60 });
  assert.equal(format12h(Object.values(suggested.timings)[0].start), '9:00 AM'); // = 10 AM in New York
});

test('suggestions for today start from now', () => {
  const cand = slot({ id: 'c', name: 'C', coords: PLANO, orderIndex: 9 });
  const s = suggestPlacements([], cand, ctx, 3, { notBefore: 13 * 60 + 2 });
  assert.ok(s[0].start >= 13 * 60 + 2);
});

test('duplicates: same dealership + same method + overlapping time is blocked; same day otherwise warns', () => {
  const visit = slot({ id: 'v', name: 'Smith Motors', coords: PLANO, orderIndex: 0, target: { kind: 'dealership', id: 'dX', name: 'Smith Motors', coords: PLANO } });
  const layout = layoutDay([visit], ctx);
  const t = layout.timings.v;
  const blocked = checkDuplicates({ candidate: { id: 'n', how: 'in_person', target: visit.target, durationMin: 30 }, start: t.start + 10, date: visit.date!, daySlots: [visit], layout });
  assert.equal(blocked[0].level, 'block');
  const warned = checkDuplicates({ candidate: { id: 'n', how: 'phone', target: visit.target, durationMin: 15 }, start: 15 * 60, date: visit.date!, daySlots: [visit], layout });
  assert.equal(warned[0].level, 'warn');
});
