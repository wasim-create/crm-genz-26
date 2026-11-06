import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineMiles,
  getDistanceBand,
  estimateTravelTime,
  calculateLeaveByTime,
  isInsideLiveContactWindow,
  getDefaultDurationMinutes,
  getRecommendedSendTimes,
  findBestSlots,
  findNearbyDealerships
} from '../services/schedulingEngine';
import { DaySettings, PlanItem } from '../types/planner';
import { Dealership } from '../types/crm';

test('Distance Bands: 0-60 mi is Home, 60-69 mi is Edge, 70+ is Out of Town', () => {
  assert.equal(getDistanceBand(22), 'home', '22 miles should be Home Region');
  assert.equal(getDistanceBand(59.5), 'home', '59.5 miles should be Home Region');
  assert.equal(getDistanceBand(60.0), 'home', '60.0 miles should be Home Region');
  assert.equal(getDistanceBand(65), 'edge', '65 miles should be Edge (60-69 mi)');
  assert.equal(getDistanceBand(69.0), 'edge', '69.0 miles should be Edge (60-69 mi)');
  assert.equal(getDistanceBand(70.0), 'out_of_town', '70.0 miles should be Out of Town (70+ mi)');
  assert.equal(getDistanceBand(110), 'out_of_town', '110 miles should be Out of Town (Trip)');
});

test('Drive time estimate with 1.3 road factor and 5-min rounding', () => {
  // 30 miles straight line -> 39 miles road -> ~78 min drive at 30mph -> rounds up to 80 min
  const travel = estimateTravelTime(32.7767, -96.7970, 32.7555, -97.3308, true);
  assert.ok(travel.driveMin >= 60, 'Drive min should account for metro 30mph');
  assert.equal(travel.driveMin % 5, 0, 'Drive min must round up to the next 5 minutes');
  assert.equal(travel.totalTravelMin, travel.driveMin + 10, 'Total travel includes 10 min parking buffer');
});

test('Leave-By Time calculation (Scenario 1)', () => {
  // First appointment at 10:00 AM, ~20 min drive from home, 10 min parking buffer, 10 min safety margin
  // 10:00 AM - (20 + 10 + 10 = 40 min) => 9:20 AM
  const home = { lat: 42.3588, lng: -71.0638 }; // Boston
  const smithMotors = { lat: 42.2520, lng: -71.0020 }; // Quincy (~8.5 road miles => 20m drive)
  const leaveBy = calculateLeaveByTime('10:00', home, smithMotors, true, 10);
  assert.ok(leaveBy.leaveByTimeStr.startsWith('09:'), `Expected leave by around 9:20 AM, got ${leaveBy.leaveByTimeStr}`);
  assert.equal(leaveBy.leaveByTime12h.includes('AM'), true);
});

test('Live Contact Window: 10:00 AM - 4:00 PM', () => {
  assert.equal(isInsideLiveContactWindow('10:00'), true);
  assert.equal(isInsideLiveContactWindow('12:30'), true);
  assert.equal(isInsideLiveContactWindow('16:00'), true);
  assert.equal(isInsideLiveContactWindow('08:30'), false, '8:30 AM is outside live window');
  assert.equal(isInsideLiveContactWindow('16:15'), false, '4:15 PM is outside live window');
});

test('Call session duration formula: count * 12 min + 5 min setup (Scenario 4)', () => {
  // 6 clients: (6 * 12) + 5 = 77 minutes
  const duration = getDefaultDurationMinutes('phone', '', 6);
  assert.equal(duration, 77, '6 client call session should be exactly 77 minutes');
});

test('Email batch duration formula: 5 min setup + 3 min per dealership (Scenario 3)', () => {
  // 8 dealerships: 5 + (8 * 3) = 29 minutes
  const duration = getDefaultDurationMinutes('email', '', 8);
  assert.equal(duration, 29, '8 dealership email batch should be 29 minutes');
});

test('Recommended Send Times for Email and Text', () => {
  // Tuesday is day 2
  const emailTiming = getRecommendedSendTimes('email', 2);
  assert.equal(emailTiming.recommendedSlot, '10:15', 'Tuesday email send slot should be 10:15 AM');
  assert.equal(emailTiming.prepSlot, '08:30', 'Prep slot should be 8:30 AM outside live window');

  const textTiming = getRecommendedSendTimes('text', 3);
  assert.equal(textTiming.recommendedSlot, '11:00', 'Wednesday text slot should be 11:00 AM');
});

test('Nearby Dealerships grouping within 15 miles for Trips (Scenario 2)', () => {
  const rockford = { lat: 42.2711, lng: -89.0940 };
  const allDealers: any[] = [
    { id: 'd_rockford', coordinates: { lat: 42.2711, lng: -89.0940 } },
    { id: 'd_belvidere', coordinates: { lat: 42.2619, lng: -88.8448 } }, // ~12 mi away
    { id: 'd_lovespark', coordinates: { lat: 42.3178, lng: -89.0551 } }, // ~4 mi away
    { id: 'd_chicago', coordinates: { lat: 41.8781, lng: -87.6298 } } // ~75 mi away
  ];

  const nearby = findNearbyDealerships(rockford.lat, rockford.lng, allDealers, ['d_rockford'], 15);
  assert.equal(nearby.length, 2, 'Should find Belvidere and Loves Park within 15 miles');
  assert.equal(nearby[0].id, 'd_lovespark');
  assert.equal(nearby[1].id, 'd_belvidere');
});

test('Slot Suggestions provides 2-3 realistic slots inside 10-4 window (Scenario 1 & 6)', () => {
  const dummySettings: DaySettings = {
    userId: 'u_kelley',
    startAddress: 'Boston, MA',
    startCoords: { lat: 42.3588, lng: -71.0638 },
    endAddress: 'Boston, MA',
    endCoords: { lat: 42.3588, lng: -71.0638 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'mix',
    simpleMode: false,
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    workingDays: [1, 2, 3, 4, 5]
  };

  const map = new Map<string, Dealership>();
  const slots = findBestSlots('in_person', 45, { lat: 42.2520, lng: -71.0020 }, 'Smith Motors', [], dummySettings, map);

  assert.ok(slots.length >= 2, 'Should return at least 2 slot suggestions');
  assert.equal(slots[0].time, '10:00', 'First slot should anchor to 10:00 AM Golden Window start');
  assert.ok(isInsideLiveContactWindow(slots[0].time));
  assert.ok(isInsideLiveContactWindow(slots[1].time));
});
