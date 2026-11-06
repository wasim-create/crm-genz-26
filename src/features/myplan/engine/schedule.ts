// The scheduling engine. GOLDEN RULE: code calculates, AI advises.
// Everything here is deterministic and unit-tested: times, travel, the
// leave-by time, the live-contact window, reordering, slot suggestions,
// send times and the past-slot edit window.

import { EngineSettings, LatLng, PlanSlot } from '../types';
import { distanceBand, estimateDriveMinutes, milesBetween, UNKNOWN_DRIVE_MIN } from './geo';
import { isLive, isMessage } from './tasks';
import { dayOfWeek, format12h, toHHMM, toMin } from './time';

export interface LayoutContext {
  home: LatLng;
  settings: EngineSettings;
}

export interface SlotTiming {
  start: number;
  end: number;
  /** Drive + parking before this slot (0 for remote items). */
  travelBefore: number;
  driveMiles: number;
}

export type LayoutRow =
  | { kind: 'slot'; slotId: string; start: number; end: number }
  | { kind: 'travel'; toSlotId: string; minutes: number; miles: number; fromHome: boolean }
  | { kind: 'lunch'; start: number; end: number }
  | { kind: 'home'; minutes: number; miles: number; at: number };

export type WarningCode =
  | 'outside_live'
  | 'late_for_fixed'
  | 'morning_missed'
  | 'long_day'
  | 'too_much'
  | 'out_of_town';

export interface DayWarning {
  code: WarningCode;
  slotId?: string;
  message: string;
}

export type Fullness = 'empty' | 'light' | 'good' | 'full' | 'too_much';

export interface DayLayout {
  rows: LayoutRow[];
  timings: Record<string, SlotTiming>;
  /** Ids of time-taking slots in order (visits, calls, Meets, blocks). */
  sequence: string[];
  /** Email / text slots with their send time, sorted by time. */
  messages: { slotId: string; sendTime: number }[];
  hasInPerson: boolean;
  leaveBy?: number;
  homeAt?: number;
  finish?: number;
  driveMin: number;
  workMin: number;
  fullness: Fullness;
  warnings: DayWarning[];
}

const LUNCH_EARLIEST = 12 * 60;
const LUNCH_LATEST = 14 * 60;
const LUNCH_MIN = 30;
const AFTERNOON_START = 13 * 60;
const MORNING_END = 12 * 60;

/** Slots that count for a day's timeline (not in the basket, not skipped). */
export const isScheduled = (s: PlanSlot): boolean => s.status !== 'basket' && s.status !== 'skipped' && !!s.date;

const takesTime = (s: PlanSlot): boolean => !isMessage(s.how);

const byOrder = (a: PlanSlot, b: PlanSlot) => a.orderIndex - b.orderIndex || a.createdAt.localeCompare(b.createdAt);

/** Lay out one day's slots: real start/end times, travel rows, lunch, leave-by, warnings. */
export function layoutDay(daySlots: PlanSlot[], ctx: LayoutContext): DayLayout {
  const s = ctx.settings;
  const liveStart = toMin(s.liveStart);
  const liveEnd = toMin(s.liveEnd);
  const scheduled = daySlots.filter(isScheduled);
  const sequence = scheduled.filter(takesTime).sort(byOrder);
  const messageSlots = scheduled.filter(x => !takesTime(x));

  const rows: LayoutRow[] = [];
  const timings: Record<string, SlotTiming> = {};
  const warnings: DayWarning[] = [];

  let cursor = toMin(s.dayStart);
  let location: LatLng = ctx.home;
  let lunchTaken = !s.lunch;
  let driveMin = 0;
  let workMin = 0;
  let leaveBy: number | undefined;
  let homeAt: number | undefined;

  const lastInPersonIdx = sequence.map(x => x.how === 'in_person' && x.target.kind !== 'block').lastIndexOf(true);

  sequence.forEach((slot, i) => {
    const isVisit = slot.how === 'in_person' && slot.target.kind !== 'block';
    const live = isLive(slot.how) && slot.target.kind !== 'block';

    // Lunch: taken before the next item once the day has passed noon.
    if (!lunchTaken && i > 0 && cursor >= LUNCH_EARLIEST && cursor <= LUNCH_LATEST) {
      rows.push({ kind: 'lunch', start: cursor, end: cursor + LUNCH_MIN });
      cursor += LUNCH_MIN;
      lunchTaken = true;
    }

    // Travel (visits only): drive from the previous visit or from home, plus parking.
    let travel = 0;
    let miles = 0;
    if (isVisit) {
      const fromHome = location === ctx.home;
      if (slot.target.coords) {
        miles = milesBetween(location, slot.target.coords);
        travel = estimateDriveMinutes(miles) + s.parkingMin;
      } else {
        travel = UNKNOWN_DRIVE_MIN + s.parkingMin;
      }
      rows.push({ kind: 'travel', toSlotId: slot.id, minutes: travel, miles, fromHome });
    }

    // Earliest the rep can physically be there…
    const reachable = cursor + travel;
    // …and earliest the engine would *suggest* (live contact waits for 10 AM).
    let earliest = reachable;
    if (live) earliest = Math.max(earliest, liveStart);
    if (slot.timeMode === 'afternoon') earliest = Math.max(earliest, AFTERNOON_START);

    let start = earliest;
    const pinned = (slot.locked || slot.timeMode === 'exact') && slot.fixedTime;
    if (pinned) {
      // A time the rep chose is respected (even outside 10–4, with a gentle
      // note below); we only complain if they can't physically make it.
      const fixed = toMin(slot.fixedTime);
      if (reachable > fixed + 2) {
        const late = reachable - fixed;
        warnings.push({
          code: 'late_for_fixed',
          slotId: slot.id,
          message: `You can't reach ${slot.target.name} by ${format12h(fixed)} — about ${late} min late.`
        });
        start = slot.locked ? fixed : reachable;
      } else {
        start = fixed;
      }
    }
    const end = start + slot.durationMin;

    if (live && start < liveStart) {
      warnings.push({
        code: 'outside_live',
        slotId: slot.id,
        message: `${slot.target.name} is at ${format12h(start)}. Dealerships are usually busy before 10 AM.`
      });
    } else if (live && end > liveEnd) {
      warnings.push({
        code: 'outside_live',
        slotId: slot.id,
        message: `${slot.target.name} ends at ${format12h(end)}. Dealerships are usually busy after 4 PM.`
      });
    }
    if (slot.timeMode === 'morning' && start >= MORNING_END) {
      warnings.push({
        code: 'morning_missed',
        slotId: slot.id,
        message: `${slot.target.name} was planned for the morning but now starts at ${format12h(start)}.`
      });
    }
    if (isVisit && slot.target.coords && distanceBand(milesBetween(ctx.home, slot.target.coords), s) === 'out_of_town') {
      warnings.push({
        code: 'out_of_town',
        slotId: slot.id,
        message: `${slot.target.name} is ${Math.round(milesBetween(ctx.home, slot.target.coords))} miles from home. Make it a trip day with other stops nearby?`
      });
    }

    if (isVisit && leaveBy === undefined) {
      // Leave with a safety margin — but never before the previous item
      // (e.g. a team call from home) has finished.
      leaveBy = Math.max(start - travel - s.safetyMarginMin, cursor);
    }

    rows.push({ kind: 'slot', slotId: slot.id, start, end });
    timings[slot.id] = { start, end, travelBefore: travel, driveMiles: miles };
    driveMin += travel;
    workMin += slot.durationMin;
    cursor = end;

    if (isVisit) location = slot.target.coords ?? location;

    // Drive home straight after the last visit of the day.
    if (i === lastInPersonIdx) {
      const homeMiles = milesBetween(location, ctx.home);
      const homeDrive = estimateDriveMinutes(homeMiles);
      cursor += homeDrive;
      homeAt = cursor;
      driveMin += homeDrive;
      rows.push({ kind: 'home', minutes: homeDrive, miles: homeMiles, at: cursor });
      location = ctx.home;
    }
  });

  const messages = messageSlots
    .map(m => ({ slotId: m.id, sendTime: toMin(m.sendTime ?? '10:30') }))
    .sort((a, b) => a.sendTime - b.sendTime);
  workMin += messageSlots.reduce((sum, m) => sum + m.durationMin, 0);

  const finish = sequence.length > 0 ? cursor : undefined;
  const preferredFinish = toMin(s.preferredFinish);
  if (finish !== undefined && finish > preferredFinish + 15 && sequence.length > 0) {
    warnings.push({
      code: 'long_day',
      slotId: sequence[sequence.length - 1].id,
      message: `Long day: you'd finish around ${format12h(finish)}.`
    });
  }

  const available = preferredFinish - toMin(s.dayStart);
  const used = workMin + driveMin;
  let fullness: Fullness = 'empty';
  if (scheduled.length > 0) {
    const ratio = used / available;
    fullness = ratio < 0.35 ? 'light' : ratio < 0.75 ? 'good' : ratio <= 1 ? 'full' : 'too_much';
  }
  if (fullness === 'too_much') {
    warnings.push({ code: 'too_much', message: 'This day has more than you can realistically do. Move something to another day?' });
  }

  return {
    rows,
    timings,
    sequence: sequence.map(x => x.id),
    messages,
    hasInPerson: lastInPersonIdx >= 0,
    leaveBy,
    homeAt,
    finish,
    driveMin,
    workMin,
    fullness,
    warnings
  };
}

/**
 * Move a slot to a new position in the day's sequence. All other slots keep
 * their relative order and every slot gets a fresh orderIndex, so times are
 * always recalculated from the new order (this is what makes the ▲/▼ arrows
 * reliable). A moved slot that had an exact time becomes "anytime", unless
 * it is locked; locked slots never move.
 */
export function reorderDay(daySlots: PlanSlot[], slotId: string, toIndex: number): PlanSlot[] {
  const sequence = daySlots.filter(isScheduled).filter(takesTime).sort(byOrder);
  const from = sequence.findIndex(x => x.id === slotId);
  if (from < 0) return daySlots;
  const moving = sequence[from];
  if (moving.locked) return daySlots;
  const target = Math.max(0, Math.min(sequence.length - 1, toIndex));
  if (target === from) return daySlots;

  const next = [...sequence];
  next.splice(from, 1);
  next.splice(target, 0, moving);

  const updated = new Map<string, PlanSlot>();
  next.forEach((x, i) => {
    let slot: PlanSlot = { ...x, orderIndex: i };
    if (x.id === slotId && x.timeMode === 'exact') {
      slot = { ...slot, timeMode: 'flow', fixedTime: undefined };
    }
    updated.set(x.id, slot);
  });
  return daySlots.map(x => updated.get(x.id) ?? x);
}

export function moveByArrow(daySlots: PlanSlot[], slotId: string, direction: 'up' | 'down'): PlanSlot[] {
  const sequence = daySlots.filter(isScheduled).filter(takesTime).sort(byOrder);
  const idx = sequence.findIndex(x => x.id === slotId);
  if (idx < 0) return daySlots;
  return reorderDay(daySlots, slotId, direction === 'up' ? idx - 1 : idx + 1);
}

/** Give a day's time-taking slots clean 0..n orderIndexes. */
export function normalizeOrder(daySlots: PlanSlot[]): PlanSlot[] {
  const sequence = daySlots.filter(isScheduled).filter(takesTime).sort(byOrder);
  const idx = new Map(sequence.map((x, i) => [x.id, i]));
  return daySlots.map(x => (idx.has(x.id) ? { ...x, orderIndex: idx.get(x.id)! } : x));
}

/** Insert a slot at a position in the day; returns the day's slots with fresh orderIndexes. */
export function insertAt(daySlots: PlanSlot[], slot: PlanSlot, index: number): PlanSlot[] {
  const sequence = daySlots.filter(isScheduled).filter(takesTime).sort(byOrder);
  const others = daySlots.filter(x => !sequence.includes(x));
  const next = [...sequence];
  next.splice(Math.max(0, Math.min(next.length, index)), 0, slot);
  return [...others, ...next.map((x, i) => ({ ...x, orderIndex: i }))];
}

export interface PlacementSuggestion {
  index: number;
  start: number;
  label: string;
  reason: string;
  fits: boolean;
  addedDriveMin: number;
}

/**
 * Best 2–3 places to fit a new time-taking slot into a day. Tries every
 * position, lays the day out with the slot there, and prefers positions
 * that add the least driving and create no new warnings.
 */
export function suggestPlacements(
  daySlots: PlanSlot[],
  candidate: PlanSlot,
  ctx: LayoutContext,
  max = 3
): PlacementSuggestion[] {
  const base = layoutDay(daySlots, ctx);
  const baseWarnings = new Set(base.warnings.map(w => `${w.code}:${w.slotId ?? ''}`));
  const n = base.sequence.length;
  const options: (PlacementSuggestion & { score: number })[] = [];

  for (let pos = 0; pos <= n; pos++) {
    const trial = insertAt(daySlots, { ...candidate, timeMode: 'flow', fixedTime: undefined, locked: false }, pos);
    const layout = layoutDay(trial, ctx);
    const timing = layout.timings[candidate.id];
    if (!timing) continue;
    const newWarnings = layout.warnings.filter(w => !baseWarnings.has(`${w.code}:${w.slotId ?? ''}`));
    const addedDrive = layout.driveMin - base.driveMin;
    const fits = newWarnings.length === 0;
    const prevId = layout.sequence[pos - 1];
    const prev = prevId ? daySlots.find(x => x.id === prevId) : undefined;
    let reason: string;
    if (!fits) {
      reason = newWarnings[0].message;
    } else if (!prev) {
      reason = candidate.how === 'in_person' && layout.leaveBy !== undefined
        ? `First stop of the day — leave home by ${format12h(layout.leaveBy)}`
        : 'First thing in your day';
    } else if (candidate.how === 'in_person' && prev.how === 'in_person') {
      reason = `Right after ${prev.target.name} — ${Math.max(0, timing.travelBefore - ctx.settings.parkingMin)} min drive`;
    } else {
      reason = `After ${prev.target.name}`;
    }
    const score = addedDrive + (fits ? 0 : 1000 * newWarnings.length) + (timing.start - 600) / 30;
    options.push({
      index: pos,
      start: timing.start,
      label: format12h(timing.start),
      reason,
      fits,
      addedDriveMin: addedDrive,
      score
    });
  }

  // Only offer times that work; fall back to the least-bad ones (with the
  // reason they don't fit) when nothing on the day works.
  const anyFits = options.some(o => o.fits);
  const seen = new Set<number>();
  return options
    .filter(o => !anyFits || o.fits)
    .sort((a, b) => Number(b.fits) - Number(a.fits) || a.score - b.score)
    .filter(o => (seen.has(o.start) ? false : (seen.add(o.start), true)))
    .slice(0, max)
    .map(({ score, ...rest }) => rest);
}

/** Position in the sequence for a slot the rep wants at a specific time. */
export function indexForTime(daySlots: PlanSlot[], ctx: LayoutContext, time: string): number {
  const layout = layoutDay(daySlots, ctx);
  const t = toMin(time);
  const idx = layout.sequence.findIndex(id => layout.timings[id].start > t);
  return idx < 0 ? layout.sequence.length : idx;
}

// ---------- Emails and texts ----------

/**
 * Recommended send time (editable defaults): email Tue–Thu ~10:15 AM,
 * Monday afternoon (Monday mornings are busy), Friday 10:15 AM;
 * texts ~11:00 AM.
 */
export function suggestSendTime(how: 'email' | 'text', date: string): string {
  const dow = dayOfWeek(date);
  if (how === 'text') return '11:00';
  if (dow === 1) return '14:00';
  return '10:15';
}

/** Each email/text in a batch gets its own send time, a few minutes apart. */
export function staggerSendTimes(how: 'email' | 'text', first: string, count: number): string[] {
  const step = how === 'email' ? 5 : 3;
  const windowEnd = how === 'email' ? 11 * 60 + 30 : 15 * 60 + 30;
  const times: string[] = [];
  let t = toMin(first);
  for (let i = 0; i < count; i++) {
    if (how === 'email' && t > windowEnd && t < 14 * 60) t = 14 * 60;
    times.push(toHHMM(t));
    t += step;
  }
  return times;
}

/** Gentle advice when a send time is outside the recommended window, else null. */
export function sendTimeAdvice(how: 'email' | 'text', date: string, time: string): string | null {
  const t = toMin(time);
  const dow = dayOfWeek(date);
  if (dow === 0 || dow === 6) return 'Weekend messages often wait until Monday. A weekday usually gets a faster reply.';
  if (how === 'email') {
    if (dow === 1 && t < 12 * 60) return 'Monday mornings are busy at dealerships. Monday afternoon or Tue–Thu works better.';
    const good = (t >= 10 * 60 && t <= 11 * 60 + 30) || (t >= 14 * 60 && t <= 15 * 60);
    return good ? null : 'Emails get the best replies around 10–11:30 AM or 2–3 PM.';
  }
  return t >= 10 * 60 + 30 && t <= 15 * 60 + 30 ? null : 'Texts are best sent between 10:30 AM and 3:30 PM.';
}

// ---------- Editing past slots ----------

export const EDIT_WINDOW_HOURS = 24;

/** Within 24h of a slot being done, the rep can still correct outcomes, contacts, notes and action points. */
export function pastEditWindow(slot: Pick<PlanSlot, 'completedAt' | 'date'>, now: Date): { open: boolean; closesAt?: Date } {
  const base = slot.completedAt
    ? new Date(slot.completedAt)
    : slot.date
      ? new Date(`${slot.date}T23:59:00`)
      : undefined;
  if (!base) return { open: true };
  const closesAt = new Date(base.getTime() + EDIT_WINDOW_HOURS * 3600 * 1000);
  return { open: now.getTime() < closesAt.getTime(), closesAt };
}
