import test from 'node:test';
import assert from 'node:assert/strict';
import type { Dealership } from '../../../../types/crm';
import { distanceText, metresBetween, whereAmI } from '../whereAmI';

const d = (id: string, lat: number, lng: number) => ({ id, dealershipName: id, coordinates: { lat, lng } }) as unknown as Dealership;
const granite = d('granite', 42.959, -71.441);
const bedford = d('bedford', 42.948, -71.515);
const nashua = d('nashua', 42.765, -71.492);
const mine = [granite, bedford, nashua];
const stops = [
  { slotId: 's1', dealershipId: 'bedford', start: 9 * 60, end: 10 * 60, how: 'in_person' },
  { slotId: 's2', dealershipId: 'nashua', start: 11 * 60, end: 12 * 60, how: 'in_person' }
];

test('standing at a dealership wins, even if it is not on the plan', () => {
  const r = whereAmI({ mine, stops, nowMin: 9 * 60 + 30, position: { lat: 42.9592, lng: -71.4412 } });
  assert.equal(r.best?.dealership.id, 'granite');
  assert.equal(r.best?.why, 'nearby');
  assert.ok((r.best?.metres ?? 999) < 100);
  assert.deepEqual(r.plan.map(p => p.slotId), ['s1', 's2']);
});

test('no location: the stop happening now', () => {
  const r = whereAmI({ mine, stops, nowMin: 10 * 60 + 15 });
  assert.equal(r.best?.slotId, 's1');
  assert.equal(r.best?.why, 'now');
  assert.deepEqual(r.plan.map(p => p.slotId), ['s2']);
});

test('a stop starting within 20 minutes counts as now', () => {
  assert.equal(whereAmI({ mine, stops, nowMin: 10 * 60 + 45 }).best?.slotId, 's2');
});

test('before the first stop: the next one', () => {
  const r = whereAmI({ mine, stops, nowMin: 7 * 60 });
  assert.equal(r.best?.slotId, 's1');
  assert.equal(r.best?.why, 'next');
});

test('nothing planned and no location: recent dealerships offered', () => {
  const r = whereAmI({ mine, stops: [], nowMin: 600, recent: ['nashua', 'granite'] });
  assert.equal(r.best, undefined);
  assert.deepEqual(r.others.map(o => o.dealership.id), ['nashua', 'granite']);
});

test('far from everything: nearest listed, none chosen', () => {
  const r = whereAmI({ mine, stops: [], nowMin: 600, position: { lat: 42.36, lng: -71.06 } });
  assert.equal(r.best, undefined);
  assert.equal(r.others[0].dealership.id, 'nashua');
});

test('distance helpers', () => {
  assert.ok(Math.abs(metresBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111195) < 50);
  assert.equal(distanceText(123), '120 m away');
  assert.equal(distanceText(3862), '2.4 miles away');
});
