// Logic review, stage C: in-person appointments are places (RC3); far-away manager joins are Google Meet (RC6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanSlot } from '../../types';
import { DEFAULT_ENGINE_SETTINGS, FAR_JOIN_MILES, managerJoinHow } from '../geo';
import { layoutDay } from '../schedule';

const HOME = { lat: 41.8853, lng: -87.6219 }; // Chicago (Kevin)
const LAKE_COUNTY = { lat: 42.3636, lng: -87.8448 };
const ORLAND = { lat: 41.6303, lng: -87.8539 };
const settings = { ...DEFAULT_ENGINE_SETTINGS, dayStart: '08:30', preferredFinish: '17:30', lunch: false };
const ctx = { home: HOME, settings };
let n = 0;
const slot = (p: Partial<PlanSlot> & { name?: string; coords?: { lat: number; lng: number }; kind?: 'dealership' | 'block'; address?: string }): PlanSlot => {
  n += 1;
  const { name, coords, kind, address, ...rest } = p;
  return {
    id: `s${n}`, userId: 'u_kevin', date: '2026-11-20', orderIndex: n, status: 'planned', how: 'in_person', workType: 'client',
    target: { kind: kind ?? 'dealership', id: `${kind === 'block' ? 'blk_personal_' : 'd'}${n}`, name: name ?? `Dealer ${n}`, coords, address },
    tasks: [], contactIds: [], contactNames: [], timeMode: 'flow', durationMin: 45, source: 'manual',
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...rest
  } as PlanSlot;
};

test('personal time with no address is near home: the drive there counts, and the next drive starts from home', () => {
  const lake = slot({ name: 'Lake County Volkswagen', coords: LAKE_COUNTY, timeMode: 'exact', fixedTime: '14:00', durationMin: 50 });
  const pickup = slot({ name: 'School pickup', kind: 'block', blockType: 'personal', timeMode: 'exact', fixedTime: '15:00', locked: true });
  const orland = slot({ name: 'Orland Park Chevrolet', coords: ORLAND });
  const l = layoutDay([lake, pickup, orland], ctx);
  // Getting from Lake County to the school pickup takes time, so 3:00 PM is tight.
  assert.ok(l.warnings.some(w => w.code === 'late_for_fixed' && w.slotId === pickup.id && /can't reach School pickup/.test(w.message)));
  // The drive to Orland Park is from home, not from Lake County.
  const toOrland = l.rows.find(r => r.kind === 'travel' && r.toSlotId === orland.id);
  assert.ok(toOrland && toOrland.kind === 'travel' && toOrland.fromHome);
});

test('a meeting at an address counts as a place; one with no address stays as it was', () => {
  const visit = slot({ coords: LAKE_COUNTY, durationMin: 30 });
  const training = slot({ name: 'Training at the office', kind: 'block', blockType: 'training', address: '200 W Madison, Chicago', timeMode: 'exact', fixedTime: '13:00', durationMin: 60 });
  const l = layoutDay([visit, training], ctx);
  assert.ok(l.rows.some(r => r.kind === 'travel' && r.toSlotId === training.id));
  const admin = slot({ name: 'Admin', kind: 'block', blockType: 'admin', timeMode: 'exact', fixedTime: '15:00', durationMin: 60 });
  const l2 = layoutDay([visit, admin], ctx);
  assert.ok(!l2.rows.some(r => r.kind === 'travel' && r.toSlotId === admin.id));
});

test('a manager joining far from home joins by Google Meet; nearby stays in person', () => {
  const miami = { lat: 25.7617, lng: -80.1918 };
  const grapevine = { lat: 32.9343, lng: -97.0781 };
  const far = managerJoinHow('in_person', miami, grapevine);
  assert.equal(far.how, 'meet');
  assert.ok((far.farMiles ?? 0) > FAR_JOIN_MILES);
  assert.equal(managerJoinHow('in_person', HOME, LAKE_COUNTY).how, 'in_person');
  assert.equal(managerJoinHow('phone', miami, grapevine).how, 'phone');
});
