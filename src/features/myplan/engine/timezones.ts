// US time zones and daylight saving. Times in a plan are wall-clock times
// on a calendar date, so the browser's clock already handles the rep's own
// daylight-saving changes. This module handles the *difference* between the
// rep's time and a dealership's time on a given date (e.g. Arizona never
// changes its clocks, so its gap to Denver is 1 hour in summer, 0 in winter).

export type IanaZone = string;

const STATE_ZONE: Record<string, IanaZone> = {
  AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles',
  CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York',
  GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
  IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
  MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
  MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
  NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago',
  OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
  VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York', WI: 'America/Chicago',
  WY: 'America/Denver'
};

/** Cities that sit in a different zone from the rest of their state. */
const CITY_ZONE: Record<string, IanaZone> = {
  'el paso,TX': 'America/Denver',
  'pensacola,FL': 'America/Chicago',
  'gary,IN': 'America/Chicago',
  'evansville,IN': 'America/Chicago'
};

export function zoneFor(state?: string, city?: string): IanaZone {
  const s = (state ?? '').toUpperCase();
  const c = `${(city ?? '').toLowerCase()},${s}`;
  return CITY_ZONE[c] ?? STATE_ZONE[s] ?? 'America/Chicago';
}

/** Rep's working time zone from their region (editable later per person). */
export function zoneForRegion(region?: string): IanaZone {
  switch (region) {
    case 'Northeast':
    case 'Southeast':
      return 'America/New_York';
    case 'West':
      return 'America/Los_Angeles';
    default:
      return 'America/Chicago';
  }
}

/** UTC offset in minutes for a zone at noon on a calendar date (handles DST). */
export function utcOffsetMinutes(zone: IanaZone, isoDate: string): number {
  const at = new Date(`${isoDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  return Math.round((local - at.getTime()) / 60000);
}

/** Minutes to ADD to the rep's time to get the dealership's local time. */
export function zoneDiffMinutes(repZone: IanaZone, dealerZone: IanaZone, isoDate: string): number {
  return utcOffsetMinutes(dealerZone, isoDate) - utcOffsetMinutes(repZone, isoDate);
}

/** True when the clocks change between the day before and this date in the zone. */
export function isClockChangeDay(zone: IanaZone, isoDate: string): 'forward' | 'back' | null {
  const [y, m, d] = isoDate.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  // US clocks change at 2 AM, so by noon the new offset is in force.
  const before = utcOffsetMinutes(zone, prev);
  const today = utcOffsetMinutes(zone, isoDate);
  if (today > before) return 'forward';
  if (today < before) return 'back';
  return null;
}

export const ZONE_SHORT: Record<string, string> = {
  'America/New_York': 'Eastern',
  'America/Detroit': 'Eastern',
  'America/Indiana/Indianapolis': 'Eastern',
  'America/Chicago': 'Central',
  'America/Denver': 'Mountain',
  'America/Boise': 'Mountain',
  'America/Phoenix': 'Arizona',
  'America/Los_Angeles': 'Pacific',
  'America/Anchorage': 'Alaska',
  'Pacific/Honolulu': 'Hawaii'
};
