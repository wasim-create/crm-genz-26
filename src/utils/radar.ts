// Open Radar — find dealerships near the rep's home ZIP or current location
// that are NOT already in the CRM.
//
// DEMO: results are generated from real nearby towns so the flow can be
// tried end to end. For the test version, replace `searchNearbyDealerships`
// with a Google Places "car_dealer" nearby search; the screens stay the same.

import { Dealership } from '../types/crm';
import { milesBetween } from '../features/myplan/engine/geo';

export interface RadarResult {
  placeId: string;
  dealershipName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  coordinates: { lat: number; lng: number };
  franchiseType: 'Franchise' | 'Independent';
  franchiseBrands: string[];
  miles: number;
  isDemo: true;
}

const BRANDS = ['Ford', 'Chevrolet', 'Toyota', 'Honda', 'Nissan', 'Hyundai', 'Kia', 'Jeep', 'Ram', 'Subaru', 'Mazda', 'GMC', 'Volkswagen', 'Buick'];
const PATTERNS = ['{brand} of {city}', '{city} {brand}', 'Northside {brand}', '{city} Auto Mall', 'Premier {brand} {city}', '{city} Pre-Owned Center', 'Lakeside {brand}', '{city} Motor Company'];
const STREETS = ['Main St', 'Commerce Dr', 'Auto Plaza Way', 'Highway 7', 'Market St', 'Industrial Blvd', 'Motorway Pkwy', 'Oak Ave'];

function seeded(n: number) {
  let x = Math.sin(n) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export async function searchNearbyDealerships(
  origin: { lat: number; lng: number },
  known: Dealership[],
  radiusMiles = 60,
  count = 10
): Promise<RadarResult[]> {
  const towns = Array.from(
    new Map(
      known
        .map(d => ({ d, m: milesBetween(origin, d.coordinates) }))
        .filter(x => x.m <= radiusMiles)
        .sort((a, b) => a.m - b.m)
        .map(x => [`${x.d.city},${x.d.state}`, x.d] as const)
    ).values()
  );
  if (towns.length === 0) return [];
  const rand = seeded(Math.round(origin.lat * 1000) + Math.round(origin.lng * 1000));
  const existing = new Set(known.map(d => norm(d.dealershipName)));
  const out: RadarResult[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 200) {
    const town = towns[Math.floor(rand() * towns.length)];
    const brand = BRANDS[Math.floor(rand() * BRANDS.length)];
    const pattern = PATTERNS[Math.floor(rand() * PATTERNS.length)];
    const name = pattern.replace('{brand}', brand).replace('{city}', town.city);
    if (existing.has(norm(name)) || out.some(o => norm(o.dealershipName) === norm(name))) continue;
    const coords = { lat: town.coordinates.lat + (rand() - 0.5) * 0.06, lng: town.coordinates.lng + (rand() - 0.5) * 0.06 };
    const independent = /Auto Mall|Pre-Owned|Motor Company/.test(pattern);
    const area = (town.phone.match(/\((\d{3})\)/) ?? [])[1] ?? '555';
    out.push({
      placeId: `radar_${norm(name)}`,
      dealershipName: name,
      address: `${100 + Math.floor(rand() * 8900)} ${STREETS[Math.floor(rand() * STREETS.length)]}`,
      city: town.city,
      state: town.state,
      zipCode: town.zipCode,
      phone: `(${area}) 555-${String(1000 + Math.floor(rand() * 8999)).slice(0, 4)}`,
      website: `www.${norm(name).slice(0, 24)}.com`,
      coordinates: coords,
      franchiseType: independent ? 'Independent' : 'Franchise',
      franchiseBrands: independent ? [] : [brand],
      miles: Math.round(milesBetween(origin, coords) * 10) / 10,
      isDemo: true
    });
  }
  await new Promise(r => setTimeout(r, 450));
  return out.sort((a, b) => a.miles - b.miles);
}

/** Current location from the device, if the user allows it. */
export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error('We couldn’t get your location. Check location permission, or search from your home ZIP.')),
      { timeout: 8000, maximumAge: 300000 }
    );
  });
}
