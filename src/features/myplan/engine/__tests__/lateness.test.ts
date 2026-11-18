// Logic review, stage A (RC1): lateness must fit what the item is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanSlot } from '../../types';
import { DEFAULT_ENGINE_SETTINGS } from '../geo';
import { layoutDay, replanPreview } from '../schedule';
import { toMin } from '../time';

const HOME = { lat: 32.7876, lng: -96.7996 }; // Dallas
const GRAPEVINE = { lat: 32.9343, lng: -97.0781 };
const settings = { ...DEFAULT_ENGINE_SETTINGS, dayStart: '08:30', preferredFinish: '17:30', lunch: true, lunchTime: '12:00', lunchDurationMin: 30, lunchFlexible: true };
const ctx = { home: HOME, settings };

let n = 0;
const slot = (p: Partial<PlanSlot> & { name?: string; coords?: { lat: number; lng: number }; kind?: 'dealership' | 'block' }): PlanSlot => {
  n += 1;
  const { name, coords, kind, ...rest } = p;
  return {
    id: `s${n}`, userId: 'u_carlos', date: '2026-11-18', orderIndex: n, status: 'planned', how: 'in_person', workType: 'client',
    target: { kind: kind ?? 'dealership', id: `${kind === 'block' ? 'blk_' : 'd'}${n}`, name: name ?? `Dealer ${n}`, coords },
    tasks: [], contactIds: [], contactNames: [], timeMode: 'flow', durationMin: 30, source: 'manual',
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...rest
  } as PlanSlot;
};

test('a call booked after the last visit is not "late" because of the drive home or lunch (Big Tex)', () => {
  const visit = slot({ name: 'Trinity Honda of Grapevine', coords: GRAPEVINE, durationMin: 60, timeMode: 'exact', fixedTime: '11:00' });
  const call = slot({ name: 'Big Tex Chevrolet', how: 'phone', durationMin: 20, timeMode: 'exact', fixedTime: '12:35' });
  const l = layoutDay([visit, call], ctx);
  assert.equal(l.warnings.filter(w => w.code === 'late_for_fixed').length, 0);
  assert.equal(l.timings[call.id].start, toMin('12:35'));
  // The drive home comes after the call, so home is later than the call.
  assert.ok((l.homeAt ?? 0) > l.timings[call.id].end);
  // Re-plan has nothing to move.
  assert.deepEqual(replanPreview([visit, call], ctx).changes, []);
});

test('a flexible lunch never makes a set time late; it waits until after', () => {
  const a = slot({ how: 'phone', timeMode: 'exact', fixedTime: '11:40', durationMin: 20 });
  const b = slot({ how: 'phone', timeMode: 'exact', fixedTime: '12:10', durationMin: 20 });
  const l = layoutDay([a, b], ctx);
  assert.equal(l.warnings.filter(w => w.code === 'late_for_fixed').length, 0);
  const lunch = l.rows.find(r => r.kind === 'lunch');
  assert.ok(!lunch || (lunch.kind === 'lunch' && lunch.start >= l.timings[b.id].end));
});

test('personal time before the work day starts is not "late"', () => {
  const car = slot({ name: 'Car service', kind: 'block', blockType: 'personal', timeMode: 'exact', fixedTime: '08:00', locked: true, durationMin: 60 });
  const visit = slot({ coords: GRAPEVINE, durationMin: 45 });
  const l = layoutDay([car, visit], ctx);
  assert.equal(l.warnings.filter(w => w.code === 'late_for_fixed').length, 0);
  assert.equal(l.timings[car.id].start, toMin('08:00'));
});

test('a real overlap with a call is worded as an overlap, not "can\'t reach"', () => {
  const visit = slot({ name: 'Trinity Honda of Grapevine', coords: GRAPEVINE, durationMin: 120, timeMode: 'exact', fixedTime: '10:00' });
  const call = slot({ name: 'Big Tex Chevrolet', how: 'phone', timeMode: 'exact', fixedTime: '11:00', durationMin: 20 });
  const w = layoutDay([visit, call], ctx).warnings.find(x => x.code === 'late_for_fixed');
  assert.ok(w);
  assert.match(w!.message, /Big Tex Chevrolet \(call, 11:00 AM\) overlaps Trinity Honda of Grapevine/);
  assert.doesNotMatch(w!.message, /can't reach/);
});

test('a visit you really can\'t get to in time still says so', () => {
  const first = slot({ coords: GRAPEVINE, durationMin: 60, timeMode: 'exact', fixedTime: '10:00' });
  const far = slot({ name: 'Waco Ford', coords: { lat: 31.549, lng: -97.146 }, timeMode: 'exact', fixedTime: '11:15' });
  const w = layoutDay([first, far], ctx).warnings.find(x => x.code === 'late_for_fixed');
  assert.match(w!.message, /You can't reach Waco Ford by 11:15 AM/);
});

test('stops held after a late check-in read as "running behind"', () => {
  const now = slot({ coords: GRAPEVINE, durationMin: 60, status: 'in_progress', checkInAt: new Date('2026-11-18T10:55:00').toISOString() });
  const held = slot({ name: 'Trinity Ford of Arlington', coords: { lat: 32.7357, lng: -97.1081 }, timeMode: 'exact', fixedTime: '11:50', autoPinned: true });
  const w = layoutDay([now, held], ctx).warnings.find(x => x.code === 'late_for_fixed');
  assert.match(w!.message, /^Running behind: Trinity Ford of Arlington was planned for 11:50 AM/);
});

test('Re-plan never moves a call booked with a dealer, and never moves an on-time stop later', () => {
  const visit = slot({ coords: GRAPEVINE, durationMin: 150, timeMode: 'exact', fixedTime: '10:00' });
  const call = slot({ name: 'Big Tex Chevrolet', how: 'phone', timeMode: 'exact', fixedTime: '11:00', durationMin: 20 });
  const rp = replanPreview([visit, call], ctx);
  assert.ok(!rp.changes.some(c => c.slotId === call.id), JSON.stringify(rp.changes));
  const a = slot({ coords: GRAPEVINE, durationMin: 60, timeMode: 'exact', fixedTime: '10:00' });
  const held = slot({ how: 'phone', timeMode: 'exact', fixedTime: '12:35', autoPinned: true, durationMin: 20 });
  // A held stop may be offered earlier (you're ahead), never later when it's on time.
  assert.ok(replanPreview([a, held], ctx).changes.every(c => c.to < c.from));
});
