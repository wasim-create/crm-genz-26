import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_DEALERSHIPS, INITIAL_GAME_RULES, INITIAL_PRODUCT_BONUSES, PRODUCT_CATALOG, USERS } from '../../../../data/seedData';
import { PlanSlot } from '../../types';
import { buildWriteback, suggestActionPoints, suggestStageChange } from '../writeback';
import { buildSeed } from '../../data/seed';
import { INITIAL_CONTACTS, DEALER_GROUPS } from '../../../../data/seedData';

const kelley = USERS.find(u => u.id === 'u_kelley')!;
const client = INITIAL_DEALERSHIPS.find(d => d.assignedRepId === 'u_kelley' && d.stage === 'Client')!;

function clientVisit(): PlanSlot {
  return {
    id: 'slot_test',
    userId: kelley.id,
    date: '2026-11-06',
    orderIndex: 0,
    status: 'done',
    how: 'in_person',
    workType: 'client',
    target: { kind: 'dealership', id: client.id, name: client.dealershipName, coords: client.coordinates },
    tasks: [
      { taskId: 'c_upsell', productIds: ['prod_10', 'prod_4'], outcome: { kind: 'upsell', results: { prod_10: 'Won', prod_4: 'Interested' } } },
      { taskId: 'c_keyfetch', outcome: { kind: 'keyfetch', needsRefill: true, quantity: 200 } }
    ],
    contactIds: [],
    contactNames: ['Pat Doe'],
    timeMode: 'flow',
    durationMin: 30,
    source: 'manual',
    createdAt: '2026-11-06T09:00:00Z',
    updatedAt: '2026-11-06T09:00:00Z'
  };
}

test('client visit write-back: upsell statuses, products, refill action point, activity and points', () => {
  const result = buildWriteback({
    slot: clientVisit(),
    user: kelley,
    dealerships: INITIAL_DEALERSHIPS,
    catalog: PRODUCT_CATALOG,
    gameRules: INITIAL_GAME_RULES,
    productBonuses: INITIAL_PRODUCT_BONUSES,
    startedAt: '11:00',
    now: '2026-11-06T11:40:00.000Z'
  });

  const updated = result.dealershipUpdates[0];
  assert.ok(updated.signedProducts.includes('prod_10'), 'won upsell is added to the client products');
  const gap = updated.upsells.find(u => u.productId === 'prod_4');
  assert.equal(gap?.stage, 'Interested');
  assert.equal(updated.lastTouchpointDate, '2026-11-06T11:40:00.000Z');

  assert.equal(result.activities.length, 1);
  assert.equal(result.activities[0].activityType, 'In-Person Visit');
  assert.equal(result.activities[0].isGoodWindow, true);
  assert.match(result.activities[0].notes, /refill needed \(200 units\)/);

  const ap = result.actionPoints[0];
  assert.match(ap.title, /Place Keyfetch order for .* — 200 units/);
  assert.equal(ap.dueDate, '2026-11-06');

  const actions = result.points.map(p => p.actionType);
  assert.ok(actions.includes('visit_good_window'));
  assert.ok(actions.includes('upsell_won'));
  assert.ok(actions.includes('keyfetch_topup'));
  // Ceramic Pro launch bonus (+150) applies to the upsell win.
  const upsell = result.points.find(p => p.actionType === 'upsell_won')!;
  assert.equal(upsell.pointsAwarded, 75 + 150);
  assert.equal(result.totalPoints, result.points.reduce((s, p) => s + p.pointsAwarded, 0));
});

test('no money is written anywhere', () => {
  const result = buildWriteback({
    slot: clientVisit(),
    user: kelley,
    dealerships: INITIAL_DEALERSHIPS,
    catalog: PRODUCT_CATALOG,
    gameRules: INITIAL_GAME_RULES,
    productBonuses: INITIAL_PRODUCT_BONUSES,
    now: '2026-11-06T11:40:00.000Z'
  });
  assert.doesNotMatch(JSON.stringify(result), /\$\d/);
});

test('group meeting writes an activity on each ticked rooftop', () => {
  const rooftops = INITIAL_DEALERSHIPS.filter(d => d.groupId === 'grp_holman').slice(0, 3);
  const slot: PlanSlot = {
    ...clientVisit(),
    workType: 'group',
    target: { kind: 'group', id: 'grp_holman', name: 'Holman Automotive Group', rooftopIds: rooftops.map(r => r.id) },
    tasks: [{ taskId: 'g_pitch', productIds: ['prod_10'], outcome: { kind: 'interest', levels: { prod_10: 'High' } } }]
  };
  const result = buildWriteback({
    slot,
    user: kelley,
    dealerships: INITIAL_DEALERSHIPS,
    catalog: PRODUCT_CATALOG,
    gameRules: INITIAL_GAME_RULES,
    productBonuses: INITIAL_PRODUCT_BONUSES,
    now: '2026-11-06T11:40:00.000Z'
  });
  assert.equal(result.activities.length, 3);
  assert.deepEqual(result.activities.map(a => a.dealershipId).sort(), rooftops.map(r => r.id).sort());
  assert.ok(result.dealershipUpdates.every(d => d.productInterests.some(p => p.productId === 'prod_10' && p.interestLevel === 'High')));
});

test('stage suggestions are offered, never silent', () => {
  const prospect = { ...client, stage: 'Claimed' as const };
  const slot = { ...clientVisit(), workType: 'prospect' as const, tasks: [{ taskId: 'p_intro', outcome: { kind: 'simple' as const, result: 'done' as const } }] };
  assert.deepEqual(suggestStageChange(slot, prospect), { to: 'Visited', reason: 'First contact made' });
  const signing = { ...clientVisit(), tasks: [{ taskId: 's_contract', outcome: { kind: 'signed' as const, productIds: ['prod_3'] } }] };
  assert.equal(suggestStageChange(signing, { ...client, stage: 'Contract' })?.to, 'Signed');
});

test('smart action-point suggestions from outcomes', () => {
  const tips = suggestActionPoints(clientVisit(), PRODUCT_CATALOG);
  assert.ok(tips.some(t => /Send GAP details/.test(t)));
});

test('seed: every rep gets history, today, a basket, action points and their own plan', () => {
  const seed = buildSeed({
    users: USERS,
    dealerships: INITIAL_DEALERSHIPS,
    contacts: INITIAL_CONTACTS,
    groups: DEALER_GROUPS,
    catalog: PRODUCT_CATALOG,
    today: '2026-11-06'
  });
  for (const rep of USERS.filter(u => u.role.endsWith('_rep'))) {
    const mine = seed.slots.filter(s => s.userId === rep.id);
    assert.ok(mine.some(s => s.status === 'done'), `${rep.firstName} has history`);
    assert.ok(mine.some(s => s.status === 'basket'), `${rep.firstName} has a basket`);
    assert.ok(mine.some(s => s.locked && s.source === 'assist'), `${rep.firstName} has a locked Manager Assist meeting`);
    assert.ok(seed.actionPoints.some(a => a.userId === rep.id && !a.done));
    // every planned target is the rep's own dealership (or their group)
    assert.ok(mine.filter(s => s.target.kind === 'dealership').every(s => INITIAL_DEALERSHIPS.find(d => d.id === s.target.id)?.assignedRepId === rep.id));
  }
  assert.ok(seed.slots.some(s => s.target.kind === 'group'), 'a dealer-group meeting exists');
  assert.ok(seed.slots.some(s => s.batchId && s.how === 'email'), 'an email batch exists (separate slots)');
});
