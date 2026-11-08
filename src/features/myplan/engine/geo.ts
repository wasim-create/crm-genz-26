// Distances, distance bands and drive-time estimates.
// Deterministic: no AI, no network. Google Maps drive times can replace
// `estimateDriveMinutes` later without changing callers.

import { DistanceBand, EngineSettings, LatLng } from '../types';

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  dayStart: '08:30',
  preferredFinish: '17:30',
  lunch: true,
  liveStart: '10:00',
  liveEnd: '16:00',
  homeBandMiles: 60,
  edgeBandMiles: 69,
  parkingMin: 10,
  safetyMarginMin: 10
};

/** Straight-line (great-circle) distance in statute miles, 1 decimal. */
export function milesBetween(a: LatLng, b: LatLng): number {
  if (a.lat === b.lat && a.lng === b.lng) return 0;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 10) / 10;
}

/**
 * 🟢 home region (≤ 60 mi), 🟡 edge (60–69 mi), 🔴 out of town (70+ mi).
 * Always measured straight-line from the rep's HOME.
 */
export function distanceBand(
  milesFromHome: number,
  settings: Pick<EngineSettings, 'homeBandMiles' | 'edgeBandMiles'> = DEFAULT_ENGINE_SETTINGS
): DistanceBand {
  if (milesFromHome <= settings.homeBandMiles) return 'home';
  if (milesFromHome <= settings.edgeBandMiles) return 'edge';
  return 'out_of_town';
}

export const BAND_LABEL: Record<DistanceBand, string> = {
  home: 'Home region',
  edge: 'Edge of region',
  out_of_town: 'Out of town'
};

/**
 * Drive time estimate in minutes (no parking):
 * straight-line × 1.3 road factor, at 30 mph for short metro hops
 * (≤ 20 mi straight-line) and 50 mph for longer drives, rounded up to 5 min.
 */
export function estimateDriveMinutes(straightLineMiles: number): number {
  if (straightLineMiles <= 0.2) return 0;
  const roadMiles = straightLineMiles * 1.3;
  const mph = straightLineMiles <= 20 ? 30 : 50;
  const raw = (roadMiles / mph) * 60;
  return Math.max(5, Math.ceil(raw / 5) * 5);
}

export const roadMiles = (straightLineMiles: number): number =>
  Math.round(straightLineMiles * 1.3);

/** Fallback when a target has no coordinates. */
export const UNKNOWN_DRIVE_MIN = 20;
