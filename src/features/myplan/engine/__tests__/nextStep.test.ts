import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseTime, readNote, defaultNextStep } from '../nextStep';

const MON = '2026-11-09'; // Monday
const WED = '2026-11-11';
const base = { today: MON, workType: 'prospect' as const, stage: 'In Progress', dealershipName: 'Ocean State Honda' };

test('dates: weekdays, next week, by, in N weeks, the 20th, month names, quarters', () => {
  assert.equal(parseDate('see him Tuesday', MON)!.date, '2026-11-10');
  assert.equal(parseDate('next Tuesday', MON)!.date, '2026-11-17');
  assert.equal(parseDate('by Friday', MON)!.date, '2026-11-13');
  assert.equal(parseDate('by Friday', MON)!.deadline, true);
  assert.equal(parseDate('Monday', MON)!.date, '2026-11-16', 'never today');
  assert.equal(parseDate('tomorrow', MON)!.date, '2026-11-10');
  assert.equal(parseDate('tomorrow', '2026-11-13')!.date, '2026-11-16', 'Saturday moves to Monday');
  assert.equal(parseDate('next week', WED)!.date, '2026-11-16');
  assert.equal(parseDate('in two weeks', MON)!.date, '2026-11-23');
  assert.equal(parseDate('in 3 days', MON)!.date, '2026-11-12');
  assert.equal(parseDate('GM is back after the 20th', MON)!.date, '2026-11-23');
  assert.equal(parseDate('on the 3rd', MON)!.date, '2026-12-03');
  assert.equal(parseDate('Dec 8', MON)!.date, '2026-12-08');
  assert.equal(parseDate('after Q1', MON)!.date, '2027-04-01');
  assert.equal(parseDate('in Q1', MON)!.date, '2027-01-01'.replace('01-01', '01-01'));
  assert.equal(parseDate('end of the month', MON)!.date, '2026-11-30');
  assert.equal(parseDate('counted 150 cars', MON), null);
  assert.equal(parseDate('needs 200 tags', MON), null);
});

test('times', () => {
  assert.equal(parseTime('at 2pm'), '14:00');
  assert.equal(parseTime('10:30 am'), '10:30');
  assert.equal(parseTime('at 2:30'), '14:30');
  assert.equal(parseTime('no time here'), undefined);
});

test('the note from the walkthrough: install next Tuesday + send the agenda by Friday', () => {
  const r = readNote({ ...base, stage: 'Signed', workType: 'signup', note: 'Kick-off went well. Greg wants the Keyfetch install next Tuesday and asked me to send the training agenda by Friday. Jenna will run the first deals.' });
  assert.equal(r.next!.label, 'Keyfetch install visit');
  assert.equal(r.next!.date, '2026-11-17');
  assert.deepEqual(r.next!.taskIds, ['s_setup']);
  assert.ok(r.next!.from.includes('next tuesday'));
  assert.equal(r.actionPoints.length, 1);
  assert.equal(r.actionPoints[0].title, 'Send training agenda to Ocean State Honda');
  assert.equal(r.actionPoints[0].dueDate, '2026-11-13');
});

test('call, demo, visit and time', () => {
  assert.deepEqual(
    [readNote({ ...base, note: 'Asked me to call him Thursday at 2pm.' }).next].map(n => [n!.how, n!.date, n!.time]),
    [['phone', '2026-11-12', '14:00']]
  );
  assert.equal(readNote({ ...base, note: 'F&I team wants a demo next week.' }).next!.how, 'meet');
  assert.equal(readNote({ ...base, note: 'Come back with the claims sample on the 18th.' }).next!.date, '2026-11-18');
  assert.equal(readNote({ ...base, note: 'He wants to bring my manager in to close it Friday.' }).next!.taskIds[0], 'p_assist');
});

test('lost and not now', () => {
  const lost = readNote({ ...base, note: 'They went with another provider for three years.' });
  assert.equal(lost.stage!.to, 'Lost');
  assert.equal(lost.noFurtherAction, true);
  assert.equal(lost.next, null);
  const later = readNote({ ...base, note: 'Likes it but wants to revisit after Q1 once inventory settles.' });
  assert.equal(later.stage!.to, 'Not Now');
  assert.equal(later.stage!.nurtureDate, '2027-04-01');
  assert.equal(later.next!.date, '2027-04-01');
});

test('nothing useful in the note → sensible default by stage, marked as default', () => {
  const r = readNote({ ...base, note: 'Good chat, all fine.' });
  assert.equal(r.next!.label, 'Follow-up call');
  assert.deepEqual(r.next!.from, []);
  assert.equal(defaultNextStep('Contract', 'signup', MON).taskIds[0], 's_contract');
  assert.equal(defaultNextStep('Client', 'client', MON).taskIds[0], 'c_keyfetch');
  const waiting = readNote({ ...base, note: 'GM is reviewing it with his partner, they will get back to me.' });
  assert.equal(waiting.next!.label, "Check in if they haven't replied");
});

test('clients: next step stays a client task', () => {
  const r = readNote({ ...base, workType: 'client', stage: 'Client', note: 'Call me next week about the holiday sale.' });
  assert.deepEqual(r.next!.taskIds, ['c_checkin']);
  assert.equal(r.stage, null, 'no lost / not now on clients');
});

test('tasks and people named in the note carry into the next step', () => {
  const r = readNote({
    ...base,
    workType: 'client',
    stage: 'Client',
    note: 'Frank is back. Asked me to send the claims report by Thursday. Come back next Tuesday at 11am to recount the tags with Tracy.',
    contacts: [{ id: 'c1', firstName: 'Frank', lastName: 'DiNapoli' }, { id: 'c2', firstName: 'Tracy', lastName: 'Morin' }]
  });
  assert.equal(r.next!.date, '2026-11-17');
  assert.equal(r.next!.time, '11:00');
  assert.ok(r.next!.taskIds.includes('c_keyfetch'));
  assert.deepEqual(r.next!.contactIds, ['c2']);
  assert.equal(r.actionPoints[0].title, 'Send claims report to Ocean State Honda');
  assert.equal(r.actionPoints[0].dueDate, '2026-11-12');
});
