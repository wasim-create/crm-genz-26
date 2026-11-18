// Logic review, stage C (RC7): times are read in the rep's own time zone, wherever the device is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { instantAt, wallClock } from '../timezones';
import { isoToLocalMin } from '../schedule';

test("a Boston visit logged at 10:10 AM reads 10:10 AM, whatever the device's zone", () => {
  const iso = '2026-11-17T15:10:00.000Z'; // 10:10 AM in Boston (EST)
  assert.equal(isoToLocalMin(iso, 'America/New_York'), 10 * 60 + 10);
  assert.equal(isoToLocalMin(iso, 'America/Chicago'), 9 * 60 + 10);
  assert.equal(wallClock(new Date(iso), 'America/New_York').date, '2026-11-17');
});

test('summer time is handled (EDT in October)', () => {
  assert.equal(isoToLocalMin('2026-10-28T15:00:00.000Z', 'America/New_York'), 11 * 60);
});

test('late evening in the UK is still the same afternoon for a rep in Texas', () => {
  const w = wallClock(new Date('2026-11-19T01:30:00Z'), 'America/Chicago');
  assert.equal(w.date, '2026-11-18');
  assert.equal(w.minutes, 19 * 60 + 30);
  assert.equal(w.weekday, 3);
});

test('instantAt turns a wall-clock time in a zone back into the real moment', () => {
  assert.equal(instantAt('2026-11-18', 10 * 60 + 55, 'America/Chicago').toISOString(), '2026-11-18T16:55:00.000Z');
  assert.equal(instantAt('2026-07-01', 9 * 60, 'America/New_York').toISOString(), '2026-07-01T13:00:00.000Z');
});
