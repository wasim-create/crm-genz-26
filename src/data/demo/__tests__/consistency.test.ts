// Consistency checks for the demo data. The demo is rebuilt for several
// different "todays" so it stays coherent whenever someone opens it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { USERS, INITIAL_GAME_RULES } from '../../seedData';
import { buildDemoData, LEVELS, levelFor } from '../story';
import { buildSeed } from '../../../features/myplan/data/seed';
import { milesBetween } from '../../../features/myplan/engine/geo';
import type { PipelineStage } from '../../../types/crm';

const DATES = [
  '2026-11-08T15:00:00Z', // Sunday
  '2026-11-09T14:00:00Z', // Monday
  '2026-11-11T18:00:00Z', // Wednesday
  '2026-11-27T16:00:00Z', // Friday, month end coming
  '2026-12-31T15:00:00Z', // year end
  '2027-03-08T15:00:00Z', // day after clocks go forward
  '2027-06-15T15:00:00Z'
];

const STAFF_SURNAMES = USERS.map(u => u.lastName);

for (const iso of DATES) {
  const now = new Date(iso);
  const D = buildDemoData(USERS, INITIAL_GAME_RULES, now);
  const nowISO = now.toISOString();
  const dealer = new Map(D.dealerships.map(d => [d.id, d]));
  const label = `[${iso.slice(0, 10)}]`;

  test(`${label} activities point at real dealerships, people and contacts`, () => {
    for (const a of D.activities) {
      const d = dealer.get(a.dealershipId);
      assert.ok(d, `activity ${a.id} dealership exists`);
      assert.equal(a.dealershipName, d!.dealershipName);
      assert.ok(USERS.some(u => u.id === a.userId && `${u.firstName} ${u.lastName}` === a.userName), `user ${a.userName}`);
      if (a.contactId) {
        const c = D.contacts.find(x => x.id === a.contactId);
        assert.ok(c && c.dealershipId === a.dealershipId, `contact ${a.contactName} belongs to ${d!.dealershipName}`);
        assert.equal(a.contactName, `${c!.firstName} ${c!.lastName}`);
      }
      if (a.completedAt) {
        assert.ok(a.completedAt < nowISO, `${a.id} is in the past`);
        const day = new Date(`${a.plannedDate}T12:00:00Z`).getUTCDay();
        assert.ok(day !== 0 && day !== 6, `${a.id} not on a weekend`);
      }
    }
  });

  test(`${label} the rookie has nothing before his start date`, () => {
    const hire = D.userHireDates.u_carlos;
    assert.ok(D.activities.filter(a => a.userId === 'u_carlos').every(a => (a.plannedDate ?? '') >= hire));
  });

  test(`${label} claimed dealerships are inside the rep's 60-mile territory (except assigned far accounts)`, () => {
    for (const d of D.dealerships.filter(x => x.assignedRepId)) {
      const rep = USERS.find(u => u.id === d.assignedRepId)!;
      const miles = milesBetween(rep.homeCoords, d.coordinates);
      if (d.source === 'Assigned' && !d.ownershipTransfers?.length) continue;
      assert.ok(miles <= 60, `${d.dealershipName} is ${miles.toFixed(0)} mi from ${rep.firstName}`);
    }
  });

  test(`${label} derived fields match the history`, () => {
    for (const d of D.dealerships) {
      const acts = D.activities.filter(a => a.dealershipId === d.id && a.status === 'completed' && a.activityType !== 'System Note');
      const latest = acts.map(a => a.completedAt!).sort().pop() ?? null;
      assert.equal(d.lastTouchpointDate ?? null, latest, `${d.dealershipName} last touch`);
      assert.deepEqual(d.topups.map(t => t.id).sort(), D.topups.filter(t => t.dealershipId === d.id).map(t => t.id).sort());
      if (d.topups.length) assert.ok(d.signedProducts.includes('prod_3'), `${d.dealershipName} has Keyfetch`);
      if (d.signedProducts.length) assert.ok(['Signed', 'Onboarding', 'Client'].includes(d.stage), `${d.dealershipName} signed products only after signing`);
      if (d.stage === 'Pool') assert.equal(d.assignedRepId, null);
      if (!['Pool'].includes(d.stage) && !d.isPlaceholder) assert.ok(D.contacts.some(c => c.dealershipId === d.id && c.isDecisionMaker), `${d.dealershipName} has a decision maker`);
      if (d.stage === 'Lost') assert.ok(d.lostReason);
      if (d.stage === 'Not Now') assert.ok(d.nurtureFollowUpDate);
      if (d.stage === 'Disqualified') assert.ok(d.disqualifiedReason);
    }
  });

  test(`${label} Ceramic Pro never appears before its launch`, () => {
    const launch = D.products.find(p => p.id === 'prod_10')!.dateAdded;
    for (const a of D.activities.filter(x => x.productsDiscussed.includes('Ceramic Pro'))) assert.ok((a.plannedDate ?? '') >= launch, `${a.dealershipName} ${a.plannedDate}`);
    for (const d of D.dealerships) for (const i of d.productInterests.filter(x => x.productId === 'prod_10')) assert.ok(i.recordedDate.slice(0, 10) >= launch);
  });

  test(`${label} assists, incentives and priorities agree with the dealerships`, () => {
    for (const a of D.assists) {
      const d = dealer.get(a.dealershipId)!;
      const rep = USERS.find(u => u.id === a.originRepId)!;
      assert.equal(a.dealershipName, d.dealershipName);
      assert.equal(d.assignedRepId, rep.id);
      assert.equal(a.assignedManagerId, rep.managerId, `${a.dealershipName}: assist goes to the rep's own manager`);
      assert.ok(a.requestDate.slice(0, 10) <= a.proposedDate);
      const open = ['Pending', 'Accepted', 'Reschedule Proposed'].includes(a.status);
      assert.equal(!!d.hasActiveAssist, open, `${d.dealershipName} assist flag`);
      if (a.status === 'Completed') assert.ok(a.completedAt! < nowISO);
      if (open) assert.ok(a.proposedDate >= nowISO.slice(0, 10), `${d.dealershipName} open assist is upcoming`);
      assert.ok(D.contacts.some(c => c.dealershipId === d.id && `${c.firstName} ${c.lastName}` === a.decisionMakerName), 'decision maker is a real contact');
    }
    for (const i of D.incentives) {
      const d = dealer.get(i.dealershipId)!;
      assert.equal(i.originRepId, d.originRepId);
      const dates = i.trail.map(t => t.date);
      assert.deepEqual(dates, [...dates].sort(), `${i.dealershipName} trail is in order`);
      if (i.paidAt) assert.ok(i.approvedAt! <= i.paidAt);
      if (i.approvedAt) assert.ok(i.verifiedAt! <= i.approvedAt);
      if (i.state !== 'Rejected') assert.ok(i.amount && i.amount > 0);
    }
    for (const p of D.priorities) if (p.linkedDealershipId) assert.equal(p.linkedDealershipName, dealer.get(p.linkedDealershipId)?.dealershipName);
    for (const l of D.ledger) if (l.dealershipId) assert.equal(l.dealershipName, dealer.get(l.dealershipId)?.dealershipName);
    for (const w of D.workspace) if (w.dealershipId) assert.equal(w.dealershipName, dealer.get(w.dealershipId)?.dealershipName);
  });

  test(`${label} points, levels and ranks come from the ledger`, () => {
    for (const [uid, g] of Object.entries(D.gamification)) {
      const sum = D.ledger.filter(l => l.userId === uid).reduce((s, l) => s + l.pointsAwarded, 0);
      assert.equal(g.points, sum, `${uid} points`);
      assert.equal(g.level, levelFor(sum).level);
      assert.ok(g.level < LEVELS.length || sum >= 5000);
    }
    const reps = USERS.filter(u => u.role.endsWith('_rep'));
    const ranks = reps.map(r => D.gamification[r.id].weeklyRank).sort();
    assert.deepEqual(ranks, reps.map((_, i) => i + 1));
  });

  test(`${label} contacts are believable and unique`, () => {
    const names = D.contacts.map(c => `${c.firstName} ${c.lastName}`);
    assert.equal(new Set(names).size, names.length, 'no duplicate contact names');
    for (const c of D.contacts) {
      assert.ok(!STAFF_SURNAMES.includes(c.lastName), `${c.firstName} ${c.lastName} doesn't share a staff surname`);
      assert.match(c.phone, /^\(\d{3}\) 555-01\d\d$/);
    }
    for (const d of D.dealerships) assert.match(d.phone, /^\(\d{3}\) 555-01\d\d$/);
  });

  test(`${label} the demo shows every feature`, () => {
    const stages = new Set(D.dealerships.map(d => d.stage));
    const want: PipelineStage[] = ['Pool', 'Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding', 'Client', 'Lost', 'Not Now', 'Disqualified'];
    want.forEach(s => assert.ok(stages.has(s), `stage ${s}`));
    ['Pending', 'Accepted', 'Reschedule Proposed', 'Declined', 'Completed'].forEach(s => assert.ok(D.assists.some(a => a.status === s), `assist ${s}`));
    ['Eligible', 'Pending verification', 'Verified', 'Approved', 'Paid', 'Rejected', 'Disputed'].forEach(s => assert.ok(D.incentives.some(i => i.state === s), `incentive ${s}`));
    ['pending', 'accepted', 'scheduled', 'completed', 'declined'].forEach(s => assert.ok(D.priorities.some(p => p.status === s), `priority ${s}`));
    assert.ok(D.dealerships.some(d => d.ownershipTransfers?.length), 'ownership transfer');
    assert.ok(D.dealerships.some(d => d.isPlaceholder), 'placeholder rooftop');
    assert.ok(D.dealerships.some(d => d.referral?.internalName) && D.dealerships.some(d => d.referral?.externalName), 'internal and external referrals');
    assert.ok(D.dealerships.some(d => d.discoveredVia === 'Radar'), 'Radar find');
    assert.ok(D.dealerships.some(d => d.onboardingTasks?.length), 'onboarding checklist');
    assert.ok(D.workspace.some(w => !w.isMatched) && D.workspace.some(w => w.isMatched), 'matched and unmatched Workspace items');
    assert.ok(D.activities.some(a => a.isGoodWindow === false), 'a visit outside 10–4');
    assert.ok(D.activities.some(a => a.status === 'cancelled'), 'a cancelled visit');
    assert.ok(D.activities.some(a => a.voiceNotesTranscript), 'a voice note');
    assert.ok(D.dealerships.some(d => d.stage === 'Client' && (d.clientHealthScore ?? 100) < 70), 'an at-risk client');
    assert.ok(D.incentives.some(i => i.conflicts?.length) && D.incentives.some(i => i.amountAuditTrail?.length), 'incentive conflicts and amount change');
  });

  test(`${label} My Plan matches the CRM and has no clashes`, () => {
    const today = D.today;
    const seed = buildSeed({ users: USERS, dealerships: D.dealerships, contacts: D.contacts, groups: D.groups, catalog: D.products, today, activities: D.activities, assists: D.assists, priorities: D.priorities, workspace: D.workspace });
    for (const s of seed.slots.filter(x => x.status === 'done' && x.target.kind === 'dealership' && x.source !== 'assist')) {
      assert.ok(D.activities.some(a => a.dealershipId === s.target.id && a.plannedDate === s.date && a.userId === s.userId), 'history slot is a CRM activity');
    }
    const byUserDay = new Map<string, typeof seed.slots>();
    seed.slots.filter(s => s.date && s.date >= today && s.status === 'planned').forEach(s => {
      const k = `${s.userId}|${s.date}`;
      byUserDay.set(k, [...(byUserDay.get(k) ?? []), s]);
    });
    byUserDay.forEach((list, k) => {
      const live = list.filter(s => s.how !== 'email' && s.how !== 'text' && s.target.kind === 'dealership');
      const ids = live.map(s => s.target.id);
      assert.equal(new Set(ids).size, ids.length, `${k}: no dealership twice on one day`);
      const exact = list.filter(s => s.timeMode === 'exact' && s.fixedTime && s.how !== 'email' && s.how !== 'text').map(s => Number(s.fixedTime!.slice(0, 2)) * 60 + Number(s.fixedTime!.slice(3)));
      exact.sort((a, b) => a - b).forEach((t, i) => i && assert.ok(t - exact[i - 1] >= 45, `${k}: booked times at least 45 min apart`));
    });
  });
}
