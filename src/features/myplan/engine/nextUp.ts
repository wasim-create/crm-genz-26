// What "Next up" shows on today's plan, and what's "Still to log".
// Pure so it can be tested; the day view only draws the result.

import type { PlanSlot } from '../types';

export interface NextUp<T extends Pick<PlanSlot, 'id' | 'status'>> {
  /** Happening now (checked in), else the first planned item that isn't over yet. */
  next?: T;
  /** Planned items whose time has passed and that haven't been logged. */
  missed: T[];
}

/**
 * @param sequence today's visits, calls and meetings in plan order
 * @param endOf    when each item finishes, in minutes after midnight
 * @param nowMin   the time now, in minutes after midnight
 */
export function pickNextUp<T extends Pick<PlanSlot, 'id' | 'status'>>(sequence: T[], endOf: (id: string) => number | undefined, nowMin: number): NextUp<T> {
  const over = (s: T) => (endOf(s.id) ?? 24 * 60) <= nowMin;
  const next = sequence.find(s => s.status === 'in_progress') ?? sequence.find(s => s.status === 'planned' && !over(s));
  const missed = sequence.filter(s => s.status === 'planned' && over(s));
  return { next, missed };
}

/**
 * Emails and texts whose send time has passed but that aren't marked as sent.
 * They belong in "Still to log", not in Next up.
 */
export function overdueMessages<T extends Pick<PlanSlot, 'id' | 'status'>>(messages: T[], sendTimeOf: (id: string) => number | undefined, nowMin: number): T[] {
  return messages.filter(m => m.status === 'planned' && (sendTimeOf(m.id) ?? 24 * 60) <= nowMin);
}

/** The next email or text still to go out (for Next up when nothing else is left). */
export function nextMessage<T extends Pick<PlanSlot, 'id' | 'status'>>(messages: T[], sendTimeOf: (id: string) => number | undefined, nowMin: number): T | undefined {
  return messages.find(m => m.status === 'planned' && (sendTimeOf(m.id) ?? 24 * 60) > nowMin);
}
