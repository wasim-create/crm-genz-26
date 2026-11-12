// The "who needs help" rules, checked on the demo team for several "todays",
// plus a few hand-made cases for the edges.

import test from 'node:test';
import assert from 'node:assert/strict';
import { USERS, INITIAL_GAME_RULES } from '../../../data/seedData';
import { buildDemoData } from '../../../data/demo/story';
import { buildSeed } from '../../myplan/data/seed';
import { computeNextSteps } from '../../../utils/nextStepStatus';
import { repReport, workdaysBefore, workdaysBetween } from '../signals';
import type { User } from '../../../types/crm';

for (const iso of ['2026-11-09T14:00:00Z', '2026-11-12T16:00:00Z', '2026-12-31T15:00:00Z', '2027-03-08T15:00:00Z']) {
  const now = new Date(iso);
  const today = iso.slice(0, 10);
  // Ellie is always "hired three weeks ago", whatever today is.
  const users: User[] = USERS.map(u => (u.id === 'u_ellie' ? { ...u, hireDate: workdaysBefore(today, 15)[14] } : u));
  const D = buildDemoData(users, INITIAL_GAME_RULES, now);
  const seed = buildSeed({ users, dealerships: D.dealerships, contacts: D.contacts, groups: D.groups, catalog: D.products, today, activities: D.activities, assists: D.assists, priorities: D.priorities, workspace: D.workspace });
  const refs = seed.slots.filter(s => (s.status === 'planned' || s.status === 'basket') && s.target.kind !== 'block').map(s => ({ targetId: s.target.id, rooftopIds: s.target.rooftopIds, date: s.date, time: s.fixedTime, status: s.status, label: s.how }));
  const nextSteps = computeNextSteps(D.dealerships, D.activities, refs, D.assists, today);
  const planned = seed.slots.filter(s => s.status === 'planned' && s.date && s.target.kind === 'dealership').map(s => ({ userId: s.userId, date: s.date!, how: s.how }));
  const report = (id: string) =>
    repReport({ rep: users.find(u => u.id === id)!, managerName: 'Jason', dealerships: D.dealerships, activities: D.activities, nextSteps, planned, assists: D.assists, streak: D.gamification[id]?.streakDays, today });
  const ids = (id: string) => report(id).flags.map(f => `${f.id}:${f.level}`);

  test(`[${today}] Marcus has gone quiet: needs help, nothing planned, deals with no next step`, () => {
    const r = report('u_marcus');
    assert.equal(r.status, 'help', ids('u_marcus').join(', '));
    assert.ok(r.flags.some(f => f.id === 'quiet' && f.level === 'help'));
    assert.ok(r.flags.some(f => f.id === 'plan'));
    assert.ok(r.flags.some(f => f.id === 'no_next' && f.level === 'help' && f.dealershipIds.length >= 3));
  });

  test(`[${today}] Priya keeps losing at Negotiation and has a stuck deal`, () => {
    const r = report('u_priya');
    assert.equal(r.status, 'help', ids('u_priya').join(', '));
    assert.ok(r.flags.some(f => f.id === 'losses_Negotiation' && f.level === 'help'), ids('u_priya').join(', '));
    assert.ok(r.flags.some(f => f.id === 'stuck' && f.dealershipIds.includes('deal_ct_capitol')));
    assert.ok(r.flags.some(f => f.id === 'assist_waiting' && !f.repTitle), 'manager-only flag for the unanswered assist');
  });

  test(`[${today}] Ellie is a new starter behind on milestones`, () => {
    const r = report('u_ellie');
    assert.ok(r.flags.some(f => f.id === 'new_rep'), ids('u_ellie').join(', '));
    assert.notEqual(r.status, 'good');
  });

  test(`[${today}] Kevin, the steady veteran, is not flagged as needing help`, () => {
    assert.notEqual(report('u_kevin').status, 'help', ids('u_kevin').join(', '));
  });
}

const rep: User = { id: 'r1', firstName: 'Sam', lastName: 'Test', email: '', role: 'veteran_rep', region: 'Northeast', managerId: 'm', homeZipCode: '', homeCoords: { lat: 0, lng: 0 }, phone: '', hireDate: '2020-01-01' };

test('handled flags stay quiet unless they get worse', () => {
  const base = { rep, dealerships: [], activities: [], nextSteps: new Map(), planned: [], assists: [], today: '2026-11-12' };
  const quiet = repReport({ ...base, rules: undefined });
  assert.equal(quiet.status, 'help'); // nothing logged at all
  const handledHelp = repReport({ ...base, handled: { quiet: { at: '2026-11-11T10:00:00Z', by: 'Jason', action: 'Checked in', level: 'help' } } });
  assert.ok(handledHelp.flags.find(f => f.id === 'quiet')?.handled);
  assert.equal(handledHelp.status, 'good');
  const old = repReport({ ...base, handled: { quiet: { at: '2026-10-01T10:00:00Z', by: 'Jason', action: 'Checked in', level: 'help' } } });
  assert.equal(old.status, 'help', 'a week later it comes back');
  const escalated = repReport({ ...base, handled: { quiet: { at: '2026-11-11T10:00:00Z', by: 'Jason', action: 'Nudged', level: 'watch' } } });
  assert.equal(escalated.status, 'help', 'got worse since it was handled');
});

test('working-day helpers skip weekends', () => {
  assert.deepEqual(workdaysBefore('2026-11-09', 2), ['2026-11-06', '2026-11-05']);
  assert.equal(workdaysBetween('2026-11-06', '2026-11-09'), 1);
});
