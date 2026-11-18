import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickNextUp } from '../nextUp';

type S = { id: string; status: 'planned' | 'in_progress' | 'done' | 'skipped' | 'basket' };
const ends: Record<string, number> = { call: 9 * 60, a: 10 * 60 + 45, b: 12 * 60 + 20, c: 14 * 60 + 35 };
const endOf = (id: string) => ends[id];
const day: S[] = [
  { id: 'call', status: 'planned' },
  { id: 'a', status: 'planned' },
  { id: 'b', status: 'planned' },
  { id: 'c', status: 'planned' }
];

test('Next up skips what is already over; those go to Still to log', () => {
  const r = pickNextUp(day, endOf, 11 * 60 + 20);
  assert.equal(r.next?.id, 'b');
  assert.deepEqual(r.missed.map(s => s.id), ['call', 'a']);
});

test('Something still running (not yet over) is next', () => {
  const r = pickNextUp(day, endOf, 10 * 60 + 30);
  assert.equal(r.next?.id, 'a');
  assert.deepEqual(r.missed.map(s => s.id), ['call']);
});

test('A checked-in visit is next even after its planned end', () => {
  const r = pickNextUp([{ id: 'call', status: 'done' }, { id: 'a', status: 'in_progress' }, { id: 'b', status: 'planned' }] as S[], endOf, 11 * 60);
  assert.equal(r.next?.id, 'a');
  assert.deepEqual(r.missed, []);
});

test('Logged items are never missed; end of day leaves nothing next', () => {
  const r = pickNextUp([{ id: 'call', status: 'done' }, { id: 'a', status: 'skipped' }, { id: 'b', status: 'planned' }] as S[], endOf, 17 * 60);
  assert.equal(r.next, undefined);
  assert.deepEqual(r.missed.map(s => s.id), ['b']);
});

test('Items with no time yet are treated as not over', () => {
  const r = pickNextUp([{ id: 'x', status: 'planned' }] as S[], () => undefined, 23 * 60);
  assert.equal(r.next?.id, 'x');
});

import { nextMessage, overdueMessages } from '../nextUp';

test('Unsent emails past their time go to Still to log; Next up only offers ones still to go out', () => {
  const msgs = [{ id: 'e1', status: 'planned' }, { id: 'e2', status: 'planned' }, { id: 'e3', status: 'done' }] as S[];
  const send: Record<string, number> = { e1: 10 * 60 + 15, e2: 15 * 60, e3: 9 * 60 };
  assert.deepEqual(overdueMessages(msgs, id => send[id], 18 * 60 + 30).map(m => m.id), ['e1', 'e2']);
  assert.equal(nextMessage(msgs, id => send[id], 18 * 60 + 30), undefined);
  assert.equal(nextMessage(msgs, id => send[id], 11 * 60)?.id, 'e2');
});
