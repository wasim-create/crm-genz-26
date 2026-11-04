import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistanceMiles,
  isWithinTerritory,
  isGoodVisitWindow,
  formatTime12h,
  formatIncentiveUSD,
  formatUSDate,
  formatUSPhone,
  calculateClientHealthScore,
  calculateSuggestedIncentive,
  getTimeZoneFromZip
} from './territory';

test('calculateDistanceMiles accurately computes distance', () => {
  // Boston (42.3601, -71.0589) to Worcester (42.2626, -71.8023) is approx 40 miles
  const dist = calculateDistanceMiles(42.3601, -71.0589, 42.2626, -71.8023);
  assert.ok(dist >= 35 && dist <= 45, `Expected ~40 miles, got ${dist}`);
});

test('isWithinTerritory respects 60-mile radius limit', () => {
  assert.equal(isWithinTerritory(45), true);
  assert.equal(isWithinTerritory(60), true);
  assert.equal(isWithinTerritory(60.1), false);
  assert.equal(isWithinTerritory(75), false);
});

test('isGoodVisitWindow flags visits correctly between 10:00 AM and 4:00 PM', () => {
  assert.equal(isGoodVisitWindow('09:30'), false, '9:30 AM is before good window');
  assert.equal(isGoodVisitWindow('10:00'), true, '10:00 AM is start of good window');
  assert.equal(isGoodVisitWindow('11:45'), true, '11:45 AM is in good window');
  assert.equal(isGoodVisitWindow('14:15'), true, '2:15 PM is in good window');
  assert.equal(isGoodVisitWindow('16:00'), true, '4:00 PM is end of good window');
  assert.equal(isGoodVisitWindow('16:01'), false, '4:01 PM is after good window');
  assert.equal(isGoodVisitWindow('17:30'), false, '5:30 PM is outside good window');
});

test('US localization formatters follow US standards', () => {
  assert.equal(formatIncentiveUSD(1234.56), '$1,234.56');
  assert.equal(formatIncentiveUSD(300), '$300.00');
  assert.equal(formatTime12h('10:30'), '10:30 AM');
  assert.equal(formatTime12h('14:15'), '2:15 PM');
  assert.equal(formatUSPhone('5551234567'), '(555) 123-4567');
  
  // Date formatting MM/DD/YYYY
  const formattedDate = formatUSDate('2026-11-02T10:00:00Z');
  assert.match(formattedDate, /^\d{2}\/\d{2}\/\d{4}$/);
});

test('getTimeZoneFromZip maps US ZIP codes to correct time zones', () => {
  assert.equal(getTimeZoneFromZip('02108'), 'America/New_York'); // Boston
  assert.equal(getTimeZoneFromZip('60601'), 'America/Chicago');  // Chicago
  assert.equal(getTimeZoneFromZip('80202'), 'America/Denver');   // Denver
  assert.equal(getTimeZoneFromZip('90210'), 'America/Los_Angeles'); // Beverly Hills
});

test('calculateClientHealthScore properly balances touch recency and topups', () => {
  const healthyScore = calculateClientHealthScore({
    daysSinceLastTouch: 7,
    hasRecentTopup: true,
    activeUpsellCount: 2,
    reportedIssues: 0
  });
  assert.ok(healthyScore >= 95, `Expected high score, got ${healthyScore}`);

  const atRiskScore = calculateClientHealthScore({
    daysSinceLastTouch: 50,
    hasRecentTopup: false,
    activeUpsellCount: 0,
    reportedIssues: 1
  });
  assert.ok(atRiskScore <= 50, `Expected at-risk score, got ${atRiskScore}`);
});

test('calculateSuggestedIncentive calculates tiered introduction bounties without hardcoded base', () => {
  const base = calculateSuggestedIncentive({
    usedCarsOnLot: 40,
    dealershipType: 'Standalone',
    rooftopCount: 1,
    productCountSigned: 1
  });
  assert.equal(base.amount, 300);

  const highTier = calculateSuggestedIncentive({
    usedCarsOnLot: 180,
    dealershipType: 'Dealer Group',
    rooftopCount: 4,
    productCountSigned: 2
  });
  // 300 + (3 * 50 = 150) + 100 (high vol) + 75 (multi-product) = 625
  assert.equal(highTier.amount, 625);
});
