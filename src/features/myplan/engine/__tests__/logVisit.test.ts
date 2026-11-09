import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLoggedSlot, startedBefore } from '../../ui/logVisit';
import { INITIAL_CONTACTS, INITIAL_DEALERSHIPS, PRODUCT_CATALOG } from '../../../../data/seedData';

test('log a visit: builds an unplanned slot for today that started before now', () => {
  const d = INITIAL_DEALERSHIPS.find(x => x.stage === 'HOT')!;
  const now = new Date(2026, 10, 9, 14, 37);
  const s = buildLoggedSlot(d, d.assignedRepId!, INITIAL_CONTACTS, PRODUCT_CATALOG, '2026-11-09', now);
  assert.equal(s.unplanned, true);
  assert.equal(s.date, '2026-11-09');
  assert.equal(s.status, 'planned');
  assert.equal(s.target.id, d.id);
  assert.ok(s.tasks.length >= 1, 'has a task for the stage');
  assert.ok(s.fixedTime! < '14:37' && s.fixedTime!.endsWith('0') || s.fixedTime!.endsWith('5'));
  const contacts = INITIAL_CONTACTS.filter(c => c.dealershipId === d.id);
  if (contacts.length) assert.ok(contacts.some(c => c.id === s.contactIds[0]));
});

test('log a visit: start time rounds down to 5 minutes', () => {
  assert.equal(startedBefore(new Date(2026, 10, 9, 14, 37), 40), '13:55');
  assert.equal(startedBefore(new Date(2026, 10, 9, 0, 10), 40), '00:00');
});
