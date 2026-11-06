// Helpers shared by every "add a dealership" screen: building a complete
// record, estimating its map position, spotting duplicates.

import { Dealership, TimeZone, User } from '../types/crm';
import { zoneFor } from '../features/myplan/engine/timezones';

let seq = 0;
export const newRecordId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS',
  'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
  'WI', 'WY'
];

export function makeDealership(
  p: Partial<Dealership> & Pick<Dealership, 'dealershipName' | 'city' | 'state' | 'zipCode' | 'coordinates'>,
  owner?: User
): Dealership {
  const now = new Date().toISOString();
  return {
    id: newRecordId('deal'),
    groupId: null,
    dealershipType: 'Standalone',
    rooftopCount: 1,
    franchiseType: 'Independent',
    franchiseBrands: [],
    phone: '',
    address: '',
    timeZone: zoneFor(p.state, p.city) as TimeZone,
    usedCarsOnLot: 0,
    inventoryHistory: [],
    fiSystem: '',
    stage: 'Claimed',
    heatLevel: 'Cold',
    source: 'Manual Search',
    assignedRepId: owner?.id ?? null,
    originRepId: owner?.id ?? null,
    claimedAt: owner ? now : null,
    lastTouchpointDate: null,
    relationshipTemperature: { score: 50, trend: 'steady', sparkline: [50], intentPhrases: [], hesitationPhrases: [], ghostingRisk: 'low' },
    productInterests: [],
    signedProducts: [],
    topups: [],
    upsells: [],
    createdAt: now,
    updatedAt: now,
    ...p
  };
}

/**
 * Estimate a map position from ZIP / city / state using dealerships we
 * already know (demo). The test version can swap this for Google Geocoding.
 */
export function approximateCoords(
  zip: string,
  city: string,
  state: string,
  known: Pick<Dealership, 'zipCode' | 'city' | 'state' | 'coordinates'>[],
  fallback?: { lat: number; lng: number }
): { coords: { lat: number; lng: number }; approximate: boolean } | null {
  const z = zip.trim();
  const c = city.trim().toLowerCase();
  const st = state.trim().toUpperCase();
  const byZip = known.find(d => d.zipCode === z);
  if (byZip) return { coords: byZip.coordinates, approximate: true };
  const byCity = known.find(d => d.city.toLowerCase() === c && (!st || d.state === st));
  if (byCity) return { coords: byCity.coordinates, approximate: true };
  const byZip3 = z.length >= 3 ? known.find(d => d.zipCode?.slice(0, 3) === z.slice(0, 3)) : undefined;
  if (byZip3) return { coords: byZip3.coordinates, approximate: true };
  const byState = known.filter(d => d.state === st);
  if (byState.length) {
    return {
      coords: {
        lat: byState.reduce((s, d) => s + d.coordinates.lat, 0) / byState.length,
        lng: byState.reduce((s, d) => s + d.coordinates.lng, 0) / byState.length
      },
      approximate: true
    };
  }
  return fallback ? { coords: fallback, approximate: true } : null;
}

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const digits = (s?: string) => (s ?? '').replace(/\D/g, '').slice(-10);
const domain = (s?: string) =>
  (s ?? '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

/** Existing dealerships that look like the same business. */
export function findDuplicateDealerships(
  form: { dealershipName: string; zipCode: string; phone?: string; website?: string },
  existing: Dealership[]
): Dealership[] {
  const n = norm(form.dealershipName);
  const p = digits(form.phone);
  const w = domain(form.website);
  return existing.filter(d => {
    if (d.isPlaceholder) return false;
    if (n && norm(d.dealershipName) === n && (!form.zipCode || d.zipCode === form.zipCode.trim())) return true;
    if (p.length === 10 && digits(d.phone) === p) return true;
    if (w && d.website && domain(d.website) === w) return true;
    return false;
  });
}
