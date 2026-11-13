import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STOCK_RULES, addDaysISO, dealerStock, officeStock, indexStock } from '../stock';
import type { ContractRow, InventoryData } from '../types';

const today = '2026-11-13';
const rules = { ...DEFAULT_STOCK_RULES, trackFrom: '2026-01-01' };
/** n contracts a week for the last `weeks` weeks. */
const sold = (dealerId: string, perWeek: number, weeks: number, prefix = dealerId): ContractRow[] =>
  Array.from({ length: perWeek * weeks }, (_, i) => ({ nameNumber: 'x', contractNumber: `${prefix}-${i}`, effectiveDate: addDaysISO(today, -Math.floor((i / perWeek) * 7) - 1), dealerId }));
const base = (over: Partial<InventoryData>): InventoryData => ({ orders: [], contracts: [], dispatches: [], counts: [], setups: {}, rules, imports: {}, ...over });

test('direct supply: on hand = delivered - contracts; order now when it will not last the lead time', () => {
  const data = base({
    setups: { d1: { dealerId: 'd1', everyContract: true, supply: 'direct' } },
    orders: [{ orderDate: '2026-02-01', po: 'P1', dealerName: 'D1', dealerId: 'd1', quantity: 200, status: 'Delivered', dateDelivered: '2026-03-01' }],
    contracts: sold('d1', 5, 30)
  });
  const s = dealerStock('d1', data, today)!;
  assert.equal(s.onHand, 50);
  assert.equal(s.pace, 5);
  assert.equal(s.weeksLeft, 10 - 0); // 50 / 5
  assert.equal(s.status, 'order_soon'); // 10 weeks: not under 9 + 1
  const tighter = dealerStock('d1', { ...data, contracts: sold('d1', 6, 26) }, today)!;
  assert.equal(tighter.status, 'order_now', `${tighter.weeksLeft} weeks`);
  assert.ok(tighter.suggestedQty > 0);
});

test('orders on the way count towards cover; duplicates count once', () => {
  const data = base({
    setups: { d1: { dealerId: 'd1', everyContract: true, supply: 'direct' } },
    orders: [
      { orderDate: '2026-02-01', po: 'P1', dealerName: 'D1', dealerId: 'd1', quantity: 200, status: 'Delivered', dateDelivered: '2026-03-01' },
      { orderDate: '2026-10-20', po: 'P2', dealerName: 'D1', dealerId: 'd1', quantity: 100, status: 'Shipped', estShipDate: '2026-11-05' }
    ],
    contracts: [...sold('d1', 5, 30), ...sold('d1', 5, 2)] // second batch repeats contract numbers
  });
  const s = dealerStock('d1', data, today)!;
  assert.equal(s.onHand, 50);
  assert.equal(s.onTheWayQty, 100);
  assert.equal(s.weeksLeft, 30);
  assert.equal(s.status, 'ok');
  assert.equal(s.onTheWay[0].eta, '2026-11-26');
});

test('tracking start: earlier contracts are ignored; opening stock is used', () => {
  const data = base({
    rules: { ...rules, trackFrom: addDaysISO(today, -70) },
    setups: { d1: { dealerId: 'd1', everyContract: true, supply: 'direct', openingStock: 120 } },
    contracts: sold('d1', 4, 20)
  });
  const s = dealerStock('d1', data, today)!;
  assert.equal(s.contractsSinceStart, 40);
  assert.equal(s.onHand, 80);
});

test('a stock count resets the running total', () => {
  const data = base({
    setups: { d1: { dealerId: 'd1', everyContract: true, supply: 'direct' } },
    orders: [{ orderDate: '2026-02-01', po: 'P1', dealerName: 'D1', dealerId: 'd1', quantity: 200, status: 'Delivered', dateDelivered: '2026-03-01' }],
    contracts: sold('d1', 5, 30),
    counts: [{ id: 'c', dealerId: 'd1', date: addDaysISO(today, -14), count: 90, byName: 'Kelley' }]
  });
  assert.equal(dealerStock('d1', data, today)!.onHand, 90 - 10);
});

test('not every contract uses a keychain: pace from counts, and a count is asked for when old', () => {
  const data = base({
    setups: { d2: { dealerId: 'd2', everyContract: false, supply: 'direct' } },
    counts: [
      { id: 'a', dealerId: 'd2', date: addDaysISO(today, -70), count: 100, byName: 'x' },
      { id: 'b', dealerId: 'd2', date: addDaysISO(today, -42), count: 80, byName: 'x' }
    ],
    contracts: sold('d2', 9, 10)
  });
  const s = dealerStock('d2', data, today)!;
  assert.equal(s.basis, 'counts');
  assert.equal(s.pace, 5);
  assert.equal(s.onHand, 50);
  assert.ok(s.estimated);
  assert.ok(s.countDue);
  assert.equal(dealerStock('d2', { ...data, counts: [] }, today)!.status, 'needs_count');
});

test('office-supplied store: short warning to send from the office; office stock follows the group', () => {
  const data = base({
    heldGroupId: 'g1',
    officeOpening: 0,
    setups: { s1: { dealerId: 's1', everyContract: true, supply: 'office' }, s2: { dealerId: 's2', everyContract: true, supply: 'office' } },
    orders: [{ orderDate: '2026-01-10', po: 'O1', dealerName: 'Office', dealerId: 'g1', quantity: 600, status: 'Delivered', dateDelivered: '2026-03-01', toOffice: true }],
    dispatches: [
      { timestamp: '2026-03-05', dealershipName: 'S1', quantity: 160, dealerId: 's1' },
      { timestamp: '2026-03-05', dealershipName: 'S2', quantity: 160, dealerId: 's2' }
    ],
    contracts: [...sold('s1', 5, 30), ...sold('s2', 4, 30)]
  });
  const s1 = dealerStock('s1', data, today)!;
  assert.equal(s1.onHand, 10);
  assert.equal(s1.status, 'send');
  const stocks = new Map(['s1', 's2'].map(id => [id, dealerStock(id, data, today)!]));
  const off = officeStock(data, ['s1', 's2'], stocks, today, indexStock(data))!;
  assert.equal(off.onHand, 280);
  assert.equal(off.inStores, 10 + 40);
  assert.equal(off.pace, 9);
  assert.equal(off.status, 'ok'); // (280 + 50) / 9 = 36 weeks
});

test('a sharp drop in contracts is flagged', () => {
  const steady = sold('d1', 5, 9).map(c => ({ ...c, effectiveDate: addDaysISO(c.effectiveDate, -21) }));
  const data = base({ setups: { d1: { dealerId: 'd1', everyContract: true, supply: 'direct', openingStock: 500 } }, contracts: steady });
  const s = dealerStock('d1', data, today)!;
  assert.ok(s.drop, JSON.stringify(s.weekly));
});
