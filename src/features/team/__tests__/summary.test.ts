import test from 'node:test';
import assert from 'node:assert/strict';
import type { User } from '../../../types/crm';
import type { Flag, RepReport, RepStatus } from '../signals';
import { summaryText, weekStart, weekSummary } from '../summary';

const rep = (id: string, first: string): User => ({ id, firstName: first, lastName: 'X', email: '', role: 'veteran_rep', region: 'Northeast', managerId: 'm', homeZipCode: '', homeCoords: { lat: 0, lng: 0 }, phone: '', hireDate: '2020-01-01' });
const flag = (id: string, level: 'help' | 'watch', title: string): Flag => ({ id, kind: 'effort', level, title, dealershipIds: [] });
const report = (u: User, status: RepStatus, flags: Flag[], wins: string[] = []): RepReport => ({
  rep: u,
  status,
  flags,
  open: flags,
  wins,
  stats: { contactsLastWeek: 0, usualPerWeek: null, plannedNextDays: 0, liveDeals: 0, workingDaysSinceHire: 400 }
});

const marcus = report(rep('m', 'Marcus'), 'help', [flag('quiet', 'help', 'Nothing logged for 5 working days'), flag('plan', 'watch', 'Nothing planned for Fri and Mon')]);
const priya = report(rep('p', 'Priya'), 'help', [flag('losses_Negotiation', 'help', 'Lost 3 deals at Negotiation'), flag('assist_waiting', 'watch', 'Asked for your help on Capitol 4 working days ago')]);
const kevin = report(rep('k', 'Kevin'), 'good', [], ['17-day streak']);

test('weekStart is the Monday of the week', () => {
  assert.equal(weekStart('2026-11-13'), '2026-11-09'); // Friday
  assert.equal(weekStart('2026-11-09'), '2026-11-09'); // Monday
  assert.equal(weekStart('2026-11-15'), '2026-11-09'); // Sunday
});

test('summary: headline, changes, first moves, check-ins due, waiting on you, wins', () => {
  const s = weekSummary([marcus, priya, kevin], {
    today: '2026-11-13',
    lastWeek: { m: 'watch', p: 'help', k: 'watch' },
    lastCheckIn: { m: '2026-10-28T16:00:00Z', p: '2026-11-11T16:00:00Z' }
  });
  assert.equal(s.headline, '2 need help, 1 on track.');
  assert.ok(s.changes.includes('Marcus has moved to needs help (was keep an eye)'));
  assert.ok(s.changes.includes('Kevin is back on track'));
  assert.ok(s.changes.some(c => c.startsWith('Priya still needs help')));
  assert.equal(s.needsHelp.find(l => l.repId === 'm')?.action, 'Call Marcus today');
  assert.equal(s.needsHelp.find(l => l.repId === 'p')?.action, "Answer Priya's request for help", 'a request waiting on the manager comes first');
  assert.deepEqual(s.checkInsDue.map(c => c.name), ['Kevin', 'Marcus']);
  assert.equal(s.waitingOnYou.length, 1);
  assert.deepEqual(s.wins, ['Kevin: 17-day streak']);
  const text = summaryText(s, 'Jason');
  assert.ok(text.startsWith('Team summary, week of Monday, November 9 (Jason)'));
  assert.ok(text.includes('- Marcus X: Nothing logged for 5 working days (+1 more thing). First move: call Marcus today.'));
});

test('no last week: no changes section', () => {
  const s = weekSummary([kevin], { today: '2026-11-13', lastWeek: null, lastCheckIn: { k: '2026-11-12T10:00:00Z' } });
  assert.deepEqual(s.changes, []);
  assert.equal(s.headline, '1 on track.');
  assert.deepEqual(s.checkInsDue, []);
});
