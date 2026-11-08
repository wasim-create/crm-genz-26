// Task catalog per dealership stage, stage → work type mapping, and
// duration rules. Plain data + pure functions so it is easy to edit later
// (e.g. from a Settings sheet).

import { HowType, PlanSlot, SlotTask, WorkType } from '../types';

export type OutcomeKind = 'simple' | 'interest' | 'upsell' | 'keyfetch' | 'signed';

export interface TaskDef {
  id: string;
  label: string;
  workType: WorkType;
  /** Minutes for an in-person visit. Remote methods scale this down. */
  minutes: number;
  /** Rep chooses products for this task. */
  products?: 'all' | 'not_owned' | 'interested_or_all';
  /** Only offered when the client has Keyfetch. */
  keyfetchOnly?: boolean;
  outcome: OutcomeKind;
  /** Short helper text shown under the checkbox. */
  hint?: string;
}

export const TASKS: TaskDef[] = [
  // Prospect / scouting
  { id: 'p_intro', label: 'First visit / introduction', workType: 'prospect', minutes: 45, outcome: 'simple', hint: 'Meet them, walk the lot, find the decision maker' },
  { id: 'p_followup', label: 'Follow-up', workType: 'prospect', minutes: 30, outcome: 'simple' },
  { id: 'p_pitch', label: 'Product pitch', workType: 'prospect', minutes: 20, products: 'interested_or_all', outcome: 'interest', hint: 'Choose which products to pitch' },
  { id: 'p_dm', label: 'Decision-maker meeting', workType: 'prospect', minutes: 45, outcome: 'simple' },
  { id: 'p_assist', label: 'Manager Assist meeting', workType: 'prospect', minutes: 45, outcome: 'simple', hint: 'Your manager joins to help close' },
  { id: 'p_interest', label: 'Record product interest', workType: 'prospect', minutes: 10, products: 'all', outcome: 'interest' },

  // Sign-up & onboarding
  { id: 's_contract', label: 'Contract signing', workType: 'signup', minutes: 45, products: 'interested_or_all', outcome: 'signed', hint: 'Choose the products they are signing' },
  { id: 's_confirm', label: 'Confirm products signed', workType: 'signup', minutes: 15, products: 'interested_or_all', outcome: 'signed' },
  { id: 's_training', label: 'Onboarding training', workType: 'signup', minutes: 60, outcome: 'simple' },
  { id: 's_setup', label: 'Setup check', workType: 'signup', minutes: 30, outcome: 'simple' },
  { id: 's_handover', label: 'Handover to servicing', workType: 'signup', minutes: 20, outcome: 'simple' },

  // Client servicing
  { id: 'c_keyfetch', label: 'Keyfetch inventory check', workType: 'client', minutes: 20, keyfetchOnly: true, outcome: 'keyfetch', hint: 'Check stock and note how many they need' },
  { id: 'c_upsell', label: 'Upsell', workType: 'client', minutes: 20, products: 'not_owned', outcome: 'upsell', hint: 'Choose products they don’t have yet' },
  { id: 'c_promo', label: 'Promotions / sales follow-up', workType: 'client', minutes: 15, outcome: 'simple' },
  { id: 'c_checkin', label: 'Check-in', workType: 'client', minutes: 20, outcome: 'simple' },
  { id: 'c_issue', label: 'Fix an issue', workType: 'client', minutes: 30, outcome: 'simple' },

  // Dealer group
  { id: 'g_meeting', label: 'Group meeting', workType: 'group', minutes: 60, outcome: 'simple' },
  { id: 'g_pitch', label: 'Group-wide pitch', workType: 'group', minutes: 30, products: 'all', outcome: 'interest', hint: 'Choose products and the rooftops it covers' },
  { id: 'g_expand', label: 'Expansion to sister rooftops', workType: 'group', minutes: 30, outcome: 'simple' }
];

export const TASK_BY_ID: Record<string, TaskDef> = Object.fromEntries(TASKS.map(t => [t.id, t]));

export const tasksForWorkType = (workType: WorkType, hasKeyfetch: boolean): TaskDef[] =>
  TASKS.filter(t => t.workType === workType && (!t.keyfetchOnly || hasKeyfetch));

/** CRM pipeline stage → My Plan work type (tab). */
export function workTypeForStage(stage: string): WorkType | null {
  switch (stage) {
    case 'Pool':
    case 'Claimed':
    case 'Visit Planned':
    case 'Visited':
    case 'Follow-up':
    case 'In Progress':
    case 'HOT':
    case 'Negotiation':
    case 'Not Now':
      return 'prospect';
    case 'Contract':
    case 'Won':
    case 'Signed':
    case 'Onboarding':
      return 'signup';
    case 'Client':
      return 'client';
    default:
      return null; // Lost / Disqualified are not planned
  }
}

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  prospect: 'Prospect',
  signup: 'Sign-up & Onboarding',
  client: 'Client',
  group: 'Dealer group',
  block: 'Other'
};

export const HOW_LABEL: Record<HowType, string> = {
  in_person: 'In-person visit',
  phone: 'Phone call',
  meet: 'Google Meet',
  email: 'Email',
  text: 'Text message'
};

export const HOW_SHORT: Record<HowType, string> = {
  in_person: 'Visit',
  phone: 'Call',
  meet: 'Meet',
  email: 'Email',
  text: 'Text'
};

/** Live = person-to-person, belongs in the 10 AM – 4 PM window. */
export const isLive = (how: HowType): boolean => how === 'in_person' || how === 'phone' || how === 'meet';

/** Emails and texts don't occupy time in the day's sequence. */
export const isMessage = (how: HowType): boolean => how === 'email' || how === 'text';

/** Sensible default tasks for a dealership in a given stage. */
export function defaultTaskIds(stage: string, workType: WorkType, hasKeyfetch: boolean): string[] {
  if (workType === 'group') return ['g_meeting'];
  if (workType === 'client') return hasKeyfetch ? ['c_keyfetch', 'c_checkin'] : ['c_checkin'];
  if (workType === 'signup') {
    if (stage === 'Contract' || stage === 'Won') return ['s_contract'];
    if (stage === 'Signed') return ['s_training'];
    return ['s_setup'];
  }
  if (stage === 'Pool' || stage === 'Claimed') return ['p_intro'];
  if (stage === 'HOT' || stage === 'Negotiation') return ['p_dm'];
  return ['p_followup'];
}

/** Most sensible contact method for the stage and tasks. */
export function defaultHow(stage: string, taskIds: string[]): HowType {
  if (taskIds.some(t => ['p_intro', 's_contract', 's_training', 'c_keyfetch', 'g_meeting', 'p_dm', 'p_assist'].includes(t))) return 'in_person';
  if (stage === 'Client' && taskIds.every(t => t === 'c_checkin' || t === 'c_promo')) return 'phone';
  return 'in_person';
}

const DURATION_RULES: Record<HowType, { factor: number; min: number; max: number }> = {
  in_person: { factor: 1, min: 20, max: 90 },
  meet: { factor: 0.6, min: 20, max: 60 },
  phone: { factor: 0.4, min: 10, max: 30 },
  email: { factor: 0, min: 5, max: 5 },
  text: { factor: 0, min: 2, max: 2 }
};

/**
 * Slot duration = sum of task minutes, scaled for the contact method and
 * capped. Several tasks on one visit overlap a little, so extra tasks
 * after the first count at 60%.
 */
export function durationFor(how: HowType, tasks: Pick<SlotTask, 'taskId'>[]): number {
  const rule = DURATION_RULES[how];
  if (rule.factor === 0) return rule.min;
  const minutes = tasks
    .map(t => TASK_BY_ID[t.taskId]?.minutes ?? 20)
    .sort((a, b) => b - a)
    .reduce((sum, m, i) => sum + (i === 0 ? m : m * 0.6), 0);
  const scaled = Math.round((minutes * rule.factor) / 5) * 5;
  return Math.max(rule.min, Math.min(rule.max, scaled || rule.min));
}

export const slotTitle = (slot: Pick<PlanSlot, 'how' | 'target'>): string =>
  slot.target.kind === 'block' ? slot.target.name : `${HOW_SHORT[slot.how]} — ${slot.target.name}`;
