// Logic review, stage B (RC5): the plan shouldn't follow the list into the evening.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanSlot } from '../../types';
import { DEFAULT_ENGINE_SETTINGS } from '../geo';
import { insertAt, layoutDay, suggestEarlierGap } from '../schedule';
import { format12h, toMin } from '../time';
import { estimatePoints } from '../../services/writeback';
import { INITIAL_GAME_RULES } from '../../../../data/seedData';

const HOME = { lat: 42.3588, lng: -71.0638 }; // Boston
const PROVIDENCE = { lat: 41.824, lng: -71.4128 };
const WORCESTER = { lat: 42.2626, lng: -71.8023 };
const settings = { ...DEFAULT_ENGINE_SETTINGS, dayStart: '08:30', preferredFinish: '17:30', lunch: true, lunchTime: '12:00', lunchDurationMin: 30, lunchFlexible: true };
const ctx = { home: HOME, settings };
let n = 0;
const slot = (p: Partial<PlanSlot> & { name?: string; coords?: { lat: number; lng: number }; kind?: 'dealership' | 'block' }): PlanSlot => {
  n += 1;
  const { name, coords, kind, ...rest } = p;
  return {
    id: `s${n}`, userId: 'u_kelley', date: '2026-11-19', orderIndex: n, status: 'planned', how: 'in_person', workType: 'client',
    target: { kind: kind ?? 'dealership', id: `${kind === 'block' ? 'blk_personal_' : 'd'}${n}`, name: name ?? `Dealer ${n}`, coords },
    tasks: [], contactIds: [], contactNames: [], timeMode: 'flow', durationMin: 45, source: 'manual',
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...rest
  } as PlanSlot;
};

test('a visit pushed past 4 PM by a set appointment is offered the free time earlier (Kelley, Thu)', () => {
  const ocean = slot({ name: 'Ocean State Honda', coords: PROVIDENCE, timeMode: 'exact', fixedTime: '11:00', durationMin: 30 });
  const dentist = slot({ name: 'Dentist', kind: 'block', blockType: 'personal', timeMode: 'exact', fixedTime: '15:30', locked: true, durationMin: 60 });
  const blackstone = slot({ name: 'Blackstone Valley Subaru', coords: WORCESTER });
  const day = [ocean, dentist, blackstone];
  const before = layoutDay(day, ctx);
  assert.ok(before.timings[blackstone.id].start > toMin('16:30'));
  const g = suggestEarlierGap(day, ctx);
  assert.ok(g, 'a suggestion is offered');
  assert.equal(g!.slotId, blackstone.id);
  assert.ok(g!.finishAfter < g!.finishBefore);
  const after = layoutDay(insertAt(day.filter(x => x.id !== blackstone.id), blackstone, g!.index), ctx);
  assert.ok(after.timings[blackstone.id].end <= toMin('16:00'));
  assert.equal(after.warnings.filter(w => w.code === 'late_for_fixed').length, 0);
});

test('no suggestion when the day already works, or when the earlier spot is in the past', () => {
  const a = slot({ coords: PROVIDENCE });
  const b = slot({ coords: WORCESTER });
  assert.equal(suggestEarlierGap([a, b], ctx), undefined);
  const ocean = slot({ coords: PROVIDENCE, timeMode: 'exact', fixedTime: '11:00', durationMin: 30 });
  const dentist = slot({ kind: 'block', blockType: 'personal', timeMode: 'exact', fixedTime: '15:30', locked: true, durationMin: 60 });
  const late = slot({ coords: WORCESTER });
  assert.equal(suggestEarlierGap([ocean, dentist, late], ctx, { notBefore: toMin('15:00') }), undefined);
});

test('times past midnight say "next day" and the day is flagged as not fitting', () => {
  assert.equal(format12h(25 * 60 + 30), '1:30 AM (next day)');
  assert.equal(format12h(13 * 60), '1:00 PM');
  const many = Array.from({ length: 10 }, (_, i) => slot({ coords: i % 2 ? WORCESTER : PROVIDENCE, durationMin: 90 }));
  const l = layoutDay(many, ctx);
  assert.ok((l.finish ?? 0) >= 24 * 60);
  assert.ok(l.warnings.some(w => w.code === 'too_much' && /past midnight/.test(w.message)));
});

test('a visit ending in the evening is "too late in the day", not "usually busy"', () => {
  const day = [slot({ coords: PROVIDENCE, timeMode: 'exact', fixedTime: '17:45', durationMin: 45 })];
  const w = layoutDay(day, ctx).warnings.find(x => x.code === 'outside_live');
  assert.match(w!.message, /too late in the day for a dealership visit/);
});

test('card points follow the planned time: a 5:55 PM visit shows the outside-10–4 rate', () => {
  const good = estimatePoints({ how: 'in_person', fixedTime: '11:00' }, INITIAL_GAME_RULES);
  const late = estimatePoints({ how: 'in_person', fixedTime: '17:55' }, INITIAL_GAME_RULES);
  assert.ok(late < good);
});

import { suggestPlacements } from '../schedule';

test('a suggested time that pushes another stop late says so, naming that stop', () => {
  const a = slot({ name: 'Ocean State Honda', coords: PROVIDENCE, timeMode: 'exact', fixedTime: '10:00', durationMin: 90 });
  const b = slot({ name: 'Golden Mile Hyundai', coords: WORCESTER, durationMin: 120 });
  const add = slot({ name: 'Blackstone Valley Subaru', coords: WORCESTER, durationMin: 120 });
  const between = suggestPlacements([a, b], add, ctx, 1, { onlyIndex: 1 })[0];
  assert.ok(between && !between.fits);
  assert.match(between.reason, /^Pushes Golden Mile Hyundai later, to end at .+, outside 10–4\.$/);
});
