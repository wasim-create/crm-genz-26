// "Log a visit": work out which dealership the rep most likely means, so
// logging takes one tap. In order:
//   1. a dealership of theirs within a short walk of where the phone is;
//   2. the stop on today's plan that's happening now (or just finished);
//   3. the next stop on today's plan.
// Everything else is offered as a short list (nearest first when the phone
// knows where it is, otherwise most recently touched).

import type { Dealership } from '../../../types/crm';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlanStop {
  slotId: string;
  dealershipId: string;
  /** Minutes after midnight. */
  start: number;
  end: number;
  how: string;
}

export interface WhereCandidate {
  dealership: Dealership;
  slotId?: string;
  metres?: number;
  start?: number;
  why: 'nearby' | 'now' | 'next' | 'plan' | 'near' | 'recent';
}

export interface WhereAnswer {
  best?: WhereCandidate;
  plan: WhereCandidate[];
  others: WhereCandidate[];
}

/** Within this many metres counts as "you're at it". */
export const AT_DEALERSHIP_M = 300;

export function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function whereAmI(input: {
  mine: Dealership[];
  stops: PlanStop[];
  nowMin: number;
  position?: LatLng | null;
  /** Dealership ids, most recently touched first. */
  recent?: string[];
}): WhereAnswer {
  const { mine, nowMin, position } = input;
  const byId = new Map(mine.map(d => [d.id, d]));
  const stops = input.stops.filter(s => byId.has(s.dealershipId)).sort((a, b) => a.start - b.start);
  const dist = (d: Dealership) => (position && d.coordinates ? metresBetween(position, d.coordinates) : undefined);

  // 1. Standing at one of their dealerships.
  let best: WhereCandidate | undefined;
  if (position) {
    const near = mine
      .map(d => ({ d, m: dist(d) }))
      .filter(x => x.m !== undefined && x.m <= AT_DEALERSHIP_M)
      .sort((a, b) => a.m! - b.m!)[0];
    if (near) {
      const stop = stops.find(s => s.dealershipId === near.d.id);
      best = { dealership: near.d, metres: near.m, slotId: stop?.slotId, start: stop?.start, why: 'nearby' };
    }
  }

  // 2/3. The plan: the stop happening now (started up to 20 minutes from now), else the next one.
  if (!best && stops.length) {
    const started = stops.filter(s => s.start <= nowMin + 20);
    const now = started[started.length - 1];
    const pick = now ?? stops[0];
    best = { dealership: byId.get(pick.dealershipId)!, slotId: pick.slotId, start: pick.start, metres: dist(byId.get(pick.dealershipId)!), why: now ? 'now' : 'next' };
  }

  const plan = stops
    .filter(s => s.slotId !== best?.slotId)
    .map(s => ({ dealership: byId.get(s.dealershipId)!, slotId: s.slotId, start: s.start, metres: dist(byId.get(s.dealershipId)!), why: 'plan' as const }));

  const used = new Set([best?.dealership.id, ...plan.map(p => p.dealership.id)]);
  const rest = mine.filter(d => !used.has(d.id));
  let others: WhereCandidate[];
  if (position) {
    others = rest
      .map(d => ({ dealership: d, metres: dist(d), why: 'near' as const }))
      .filter(x => x.metres !== undefined)
      .sort((a, b) => a.metres! - b.metres!)
      .slice(0, 6);
  } else {
    const order = new Map((input.recent ?? []).map((id, i) => [id, i]));
    others = rest
      .filter(d => order.has(d.id))
      .sort((a, b) => order.get(a.id)! - order.get(b.id)!)
      .slice(0, 6)
      .map(d => ({ dealership: d, why: 'recent' as const }));
  }
  return { best, plan, others };
}

/** "120 m away" / "2.4 miles away". */
export function distanceText(m: number): string {
  if (m < 400) return `${Math.max(10, Math.round(m / 10) * 10)} m away`;
  const miles = m / 1609.34;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} miles away`;
}
