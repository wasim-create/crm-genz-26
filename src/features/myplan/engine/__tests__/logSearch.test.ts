import test from 'node:test';
import assert from 'node:assert/strict';
import type { Contact, DealerGroup, Dealership, User } from '../../../../types/crm';
import { relationshipOf, searchDealerships } from '../logSearch';

const dl = (id: string, name: string, stage: string, assignedRepId?: string, extra: Partial<Dealership> = {}) =>
  ({ id, dealershipName: name, stage, assignedRepId, city: 'Naperville', address: '1 Main St', zipCode: '60540', state: 'IL', ...extra }) as unknown as Dealership;
const all = [
  dl('a', 'Lakeshore Honda of Naperville', 'Client', 'u_kevin', { groupId: 'g1', address: '1550 W Ogden Ave' }),
  dl('b', 'Lakeshore Hyundai of Naperville', 'Visited', 'u_kevin', { groupId: 'g1' }),
  dl('c', 'Lakeshore Kia of Joliet', 'Lost', 'u_kevin', { city: 'Joliet' }),
  dl('d', 'Prairie Ford', 'Pool', undefined),
  dl('e', 'Fox Valley Toyota', 'HOT', 'u_other')
];
const groups = [{ id: 'g1', name: 'Lakeshore Auto Group' }] as DealerGroup[];
const contacts = [{ id: 'k1', dealershipId: 'e', firstName: 'Dana', lastName: 'Ruiz' }] as Contact[];
const users = [{ id: 'u_other', firstName: 'Ellie', lastName: 'Hartwell' }] as User[];
const input = { all, userId: 'u_kevin', contacts, groups, users };

test('relationship labels', () => {
  assert.equal(relationshipOf({ stage: 'Client' }).label, 'Client');
  assert.equal(relationshipOf({ stage: 'HOT' }).label, 'Prospect');
  assert.equal(relationshipOf({ stage: 'Onboarding' }).label, 'Signing up');
  assert.equal(relationshipOf({ stage: 'Pool' }).label, 'Prospect pool');
  assert.equal(relationshipOf({ stage: 'Lost' }).label, 'Lost');
});

test('search finds by street, group name and contact name, not just the dealership name', () => {
  assert.deepEqual(searchDealerships('ogden', input).mine.map(d => d.id), ['a']);
  assert.deepEqual(searchDealerships('lakeshore auto', input).mine.map(d => d.id), ['a', 'b']);
  const r = searchDealerships('dana', input);
  assert.equal(r.mine.length, 0);
  assert.equal(r.hidden[0].dealership.id, 'e');
});

test('matches that are not on your list come back with the reason', () => {
  const r = searchDealerships('lakeshore kia', input);
  assert.deepEqual(r.hidden.map(h => h.reason), ['lost']);
  assert.equal(searchDealerships('prairie', input).hidden[0].reason, 'pool');
  const t = searchDealerships('fox valley', input).hidden[0];
  assert.equal(t.reason, 'teammate');
  assert.equal(t.ownerName, 'Ellie Hartwell');
});
