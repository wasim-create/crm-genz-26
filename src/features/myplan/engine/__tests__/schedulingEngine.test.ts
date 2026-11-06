import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineMiles,
  calculateDistanceMiles,
  getDistanceBand,
  estimateDriveTimeMinutes,
  calculateLeaveByTime,
  isWithinLiveContactWindow,
  findBestSlots,
  findNearbyDealerships,
  recalculateDaySchedule,
  createEmailBatchSlots,
  createCallListSlots,
  DEFAULT_DAY_SETTINGS
} from '../schedulingEngine';
import { PlanSlot } from '../../types/myplan.types';

test('Haversine distance calculates statute miles accurately', () => {
  // Addison (32.961, -96.837) to Plano West (33.090, -96.750) is ~10.2 miles
  const miles = calculateHaversineMiles(32.961, -96.837, 33.090, -96.750);
  assert.ok(miles > 9 && miles < 12, `Expected ~10 miles, got ${miles}`);
});

test('Distance Bands: 0-60 mi is Home, 60-69 mi is Edge, 70+ is Out of Town', () => {
  assert.equal(getDistanceBand(42), 'home');
  assert.equal(getDistanceBand(60), 'home');
  assert.equal(getDistanceBand(64), 'edge');
  assert.equal(getDistanceBand(69), 'edge');
  assert.equal(getDistanceBand(70), 'out_of_town');
  assert.equal(getDistanceBand(110), 'out_of_town');
});

test('Drive time estimate uses 1.3 road factor and rounds up to 5 min', () => {
  // 15 miles * 1.3 = 19.5 road miles. At 30mph metro = 39 min -> rounded up to 40 min
  const drive = estimateDriveTimeMinutes(15, true);
  assert.equal(drive, 40);
  // Zero miles returns 0
  assert.equal(estimateDriveTimeMinutes(0), 0);
});

test('Leave-By Time calculation: First Appt - Drive - 10m parking - 10m safety', () => {
  // 10:30 AM arrival, 35 min drive, 10 min parking, 10 min safety buffer
  // Total deduction: 35 + 10 + 10 = 55 minutes -> Leave at 9:35 AM
  const res = calculateLeaveByTime('10:30', 35, 10, 10);
  assert.equal(res.leaveByTime, '09:35');
  assert.equal(res.leaveByFormatted, '9:35 AM');
  assert.equal(res.totalBufferMin, 55);
});

test('Live Contact Window: 10:00 AM - 4:00 PM', () => {
  assert.equal(isWithinLiveContactWindow('10:00'), true);
  assert.equal(isWithinLiveContactWindow('13:30'), true);
  assert.equal(isWithinLiveContactWindow('16:00'), true);
  assert.equal(isWithinLiveContactWindow('08:30'), false);
  assert.equal(isWithinLiveContactWindow('16:15'), false);
});

test('Nearby Dealerships clusters prospects within 15 miles', () => {
  const anchor = { id: 'd1', coordinates: { lat: 33.05, lng: -96.75 } };
  const others = [
    { id: 'd2', coordinates: { lat: 33.10, lng: -96.77 } }, // ~4 miles
    { id: 'd3', coordinates: { lat: 33.12, lng: -96.70 } }, // ~6 miles
    { id: 'd4', coordinates: { lat: 32.20, lng: -95.10 } }  // ~100 miles
  ];
  const nearby = findNearbyDealerships(anchor, others, 15);
  assert.equal(nearby.length, 2);
  assert.equal(nearby[0].id, 'd2');
  assert.equal(nearby[1].id, 'd3');
});

test('Locked slot keeps its start time and unlocked slots flow around it', () => {
  const slots: PlanSlot[] = [
    {
      id: 's1',
      userId: 'u1',
      date: '2026-11-10',
      timeType: 'exact',
      startTime: '10:00',
      durationMin: 45,
      travelBeforeMin: 20,
      orderIndex: 0,
      workType: 'prospect',
      activityType: 'in_person',
      purpose: 'First visit',
      dealershipId: 'd1',
      dealershipName: 'Visit 1',
      dealershipCity: 'Plano',
      dealershipState: 'TX',
      distanceBand: 'home',
      distanceMiles: 15,
      source: 'manual',
      status: 'planned',
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 's2_locked',
      userId: 'u1',
      date: '2026-11-10',
      timeType: 'exact',
      startTime: '11:30', // LOCKED
      durationMin: 45,
      travelBeforeMin: 15,
      orderIndex: 1,
      workType: 'prospect',
      activityType: 'meet',
      purpose: 'Manager Assist with VP Jason Scott',
      dealershipId: 'd2',
      dealershipName: 'Locked Meeting',
      dealershipCity: 'Plano',
      dealershipState: 'TX',
      distanceBand: 'home',
      distanceMiles: 10,
      locked: true,
      source: 'assist',
      status: 'planned',
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 's3',
      userId: 'u1',
      date: '2026-11-10',
      timeType: 'exact',
      startTime: '14:00',
      durationMin: 30,
      travelBeforeMin: 15,
      orderIndex: 2,
      workType: 'client',
      activityType: 'in_person',
      purpose: 'Client check-in',
      dealershipId: 'd3',
      dealershipName: 'Visit 3',
      dealershipCity: 'Plano',
      dealershipState: 'TX',
      distanceBand: 'home',
      distanceMiles: 12,
      source: 'manual',
      status: 'planned',
      createdAt: '',
      updatedAt: ''
    }
  ];

  const recalc = recalculateDaySchedule(slots, { lat: 32.96, lng: -96.83 });
  const locked = recalc.updatedSlots.find(s => s.id === 's2_locked');
  assert.equal(locked?.startTime, '11:30', 'Locked meeting must preserve 11:30 AM start');
  const third = recalc.updatedSlots.find(s => s.id === 's3');
  // Starts after 11:30 + 45m (12:15) + drive time
  assert.ok(third?.startTime! >= '12:15', 'Subsequent slot must start after locked meeting finishes');
});

test('Overrun pushes slot past 4 PM and triggers rule violation warning', () => {
  const slots: PlanSlot[] = [
    {
      id: 's1',
      userId: 'u1',
      date: '2026-11-10',
      timeType: 'exact',
      startTime: '14:30',
      durationMin: 90, // Extended overrun
      travelBeforeMin: 20,
      orderIndex: 0,
      workType: 'prospect',
      activityType: 'in_person',
      purpose: 'Long demo',
      dealershipId: 'd1',
      dealershipName: 'Extended Stop',
      dealershipCity: 'Dallas',
      dealershipState: 'TX',
      distanceBand: 'home',
      distanceMiles: 15,
      source: 'manual',
      status: 'planned',
      createdAt: '',
      updatedAt: ''
    },
    {
      id: 's2',
      userId: 'u1',
      date: '2026-11-10',
      timeType: 'exact',
      startTime: '15:45',
      durationMin: 20,
      travelBeforeMin: 15,
      orderIndex: 1,
      workType: 'prospect',
      activityType: 'phone',
      purpose: 'Follow-up call',
      dealershipId: 'd2',
      dealershipName: 'Follow-up Call',
      dealershipCity: 'Dallas',
      dealershipState: 'TX',
      distanceBand: 'home',
      distanceMiles: 10,
      source: 'manual',
      status: 'planned',
      createdAt: '',
      updatedAt: ''
    }
  ];

  const recalc = recalculateDaySchedule(slots, { lat: 32.96, lng: -96.83 });
  assert.ok(recalc.ruleViolations.length > 0, 'Should flag rule violation when pushed past 4:00 PM');
  assert.equal(recalc.ruleViolations[0].rule, 'past_4pm');
});

test('Scenario 4: Batch of 8 emails creates 8 SEPARATE slots with staggered send times', () => {
  const dealers = Array.from({ length: 8 }, (_, i) => ({
    id: `dealer_${i + 1}`,
    name: `Dealership ${i + 1}`,
    city: 'Plano',
    state: 'TX',
    distanceMiles: 15 + i * 2,
    band: 'home' as const
  }));

  const slots = createEmailBatchSlots(dealers, 'user_1', '2026-11-10', 'Hi there, quick follow up!', 10, 15);
  assert.equal(slots.length, 8, 'Must create exactly 8 separate slots');
  assert.equal(slots[0].startTime, '10:15');
  assert.equal(slots[1].startTime, '10:25');
  assert.equal(slots[7].startTime, '11:25');
  assert.ok(slots[0].sendAt?.includes('10:15'));
  assert.equal(slots[0].id !== slots[1].id, true);
  // Each slot can have its message edited individually
  slots[0].message = 'Custom message for dealer 1';
  assert.notEqual(slots[0].message, slots[1].message);
});

test('Scenario 5: Call list of 6 clients creates 6 separate back-to-back call slots', () => {
  const clients = Array.from({ length: 6 }, (_, i) => ({
    id: `client_${i + 1}`,
    name: `Client Store ${i + 1}`,
    city: 'Frisco',
    state: 'TX',
    distanceMiles: 12,
    band: 'home' as const,
    workType: 'client' as const
  }));

  const callSlots = createCallListSlots(clients, 'user_carlos', '2026-11-10', 10, 30);
  assert.equal(callSlots.length, 6, 'Must create 6 individual call slots');
  assert.equal(callSlots[0].startTime, '10:30');
  assert.equal(callSlots[1].startTime, '10:45');
  assert.equal(callSlots[2].startTime, '11:00');
  assert.equal(callSlots[5].startTime, '11:45');
  // Moving the 4th call does not mutate the rest
  const fourth = callSlots[3];
  fourth.date = '2026-11-11';
  assert.equal(callSlots[2].date, '2026-11-10');
  assert.equal(callSlots[3].date, '2026-11-11');
});

