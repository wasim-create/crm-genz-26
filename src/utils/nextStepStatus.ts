// One answer to "what happens next with this dealership?", used by every
// screen (My Plan cards, Bench, Pipeline, the dealership record, Executive
// Desk). Sources, in order: a planned My Plan slot (or the basket), an open
// Manager Assist, a dated next action on the CRM history, then what the rep
// said when they chose not to plan one.

import type { Activity, Dealership, ManagerAssist } from '../types/crm';

export interface PlannedRef {
  targetId: string;
  rooftopIds?: string[];
  date?: string;
  time?: string;
  status: string;
  label: string;
}

export type NextStepState =
  | { kind: 'planned'; label: string; date?: string; time?: string; source: 'plan' | 'basket' | 'assist' | 'crm' }
  | { kind: 'waiting'; since: string; overdue: boolean }
  | { kind: 'nurture'; date: string }
  | { kind: 'none_needed' }
  | { kind: 'missing'; lastTouch?: string | null }
  | { kind: 'not_applicable' };

const NEEDS_NEXT = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding'];

const businessDaysBetween = (fromISO: string, toISO: string) => {
  let n = 0;
  const d = new Date(`${fromISO.slice(0, 10)}T12:00:00`);
  const end = new Date(`${toISO.slice(0, 10)}T12:00:00`);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return n;
};

export function nextStepFor(d: Dealership, activities: Activity[], planned: PlannedRef[], assists: ManagerAssist[], today: string): NextStepState {
  if (d.isPlaceholder) return { kind: 'not_applicable' };
  if (d.stage === 'Not Now') return d.nurtureFollowUpDate ? { kind: 'nurture', date: d.nurtureFollowUpDate } : { kind: 'missing', lastTouch: d.lastTouchpointDate };
  // Clients: show what's planned, but never flag a missing next step.
  const isClient = d.stage === 'Client';
  if (!NEEDS_NEXT.includes(d.stage) && !isClient) return { kind: 'not_applicable' };

  const mine = planned.filter(p => p.targetId === d.id || p.rooftopIds?.includes(d.id));
  const upcoming = mine.filter(p => p.status === 'planned' && p.date && p.date >= today).sort((a, b) => (a.date! + (a.time ?? '')).localeCompare(b.date! + (b.time ?? '')))[0];
  if (upcoming) return { kind: 'planned', label: upcoming.label, date: upcoming.date, time: upcoming.time, source: 'plan' };
  const basket = mine.find(p => p.status === 'basket');
  if (basket) return { kind: 'planned', label: basket.label, source: 'basket' };

  const assist = assists.find(a => a.dealershipId === d.id && ['Pending', 'Accepted', 'Reschedule Proposed'].includes(a.status));
  if (assist) {
    const date = assist.status === 'Reschedule Proposed' && assist.rescheduledDate ? assist.rescheduledDate : assist.proposedDate;
    if (date >= today) return { kind: 'planned', label: `Manager Assist with ${assist.assignedManagerName.split(' ')[0]}`, date, time: assist.proposedTime, source: 'assist' };
  }

  const acts = activities.filter(a => a.dealershipId === d.id && a.status === 'completed').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));
  const booked = acts.find(a => a.nextAction && a.nextActionDate && a.nextActionDate >= today);
  if (booked) return { kind: 'planned', label: booked.nextAction!, date: booked.nextActionDate, time: booked.nextActionTime, source: 'crm' };
  if (isClient) return { kind: 'not_applicable' };

  const last = acts[0];
  if (last?.tags?.includes('next_skipped_none')) return { kind: 'none_needed' };
  if (last?.tags?.includes('next_skipped_not_now') && last.nextActionDate) return { kind: 'nurture', date: last.nextActionDate };
  if (last?.tags?.includes('next_skipped_waiting')) {
    const since = last.completedAt ?? today;
    return { kind: 'waiting', since, overdue: businessDaysBetween(since, today) > 5 };
  }
  return { kind: 'missing', lastTouch: d.lastTouchpointDate };
}

/** Needs attention: no next step at all, or waiting on them for over a week. */
export const needsNextStep = (s: NextStepState) => s.kind === 'missing' || (s.kind === 'waiting' && s.overdue);

export function nextStepText(s: NextStepState): string {
  const day = (iso?: string) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');
  const time = (t?: string) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  switch (s.kind) {
    case 'planned':
      return s.source === 'basket' ? `${s.label} (plan later)` : `${s.label} · ${day(s.date)}${time(s.time)}`;
    case 'waiting':
      return `Waiting on them since ${day(s.since)}${s.overdue ? ' — check in' : ''}`;
    case 'nurture':
      return `Follow up ${day(s.date)}`;
    case 'none_needed':
      return 'No further action';
    case 'missing':
      return s.lastTouch ? `No next step · last contact ${day(s.lastTouch)}` : 'No next step';
    default:
      return '';
  }
}

export function computeNextSteps(dealerships: Dealership[], activities: Activity[], planned: PlannedRef[], assists: ManagerAssist[], today: string): Map<string, NextStepState> {
  const byDealer = new Map<string, Activity[]>();
  activities.forEach(a => byDealer.set(a.dealershipId, [...(byDealer.get(a.dealershipId) ?? []), a]));
  return new Map(dealerships.map(d => [d.id, nextStepFor(d, byDealer.get(d.id) ?? [], planned, assists, today)]));
}
