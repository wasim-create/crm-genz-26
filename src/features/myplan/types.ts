// My Plan — shared types.
// One slot = one contact with ONE target (a dealership, a dealer group, or a
// non-dealership block such as a team meeting). A slot can hold several tasks.

export type WorkType = 'prospect' | 'signup' | 'client' | 'group' | 'block';

export type HowType = 'in_person' | 'phone' | 'meet' | 'email' | 'text';

/** flow = "anytime": the engine places it after the previous item. */
export type TimeMode = 'flow' | 'exact' | 'morning' | 'afternoon';

export type SlotStatus = 'basket' | 'planned' | 'in_progress' | 'done' | 'skipped';

export type SlotSource = 'manual' | 'manager_priority' | 'assist' | 'calendar' | 'suggestion' | 'seed';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SlotTarget {
  kind: 'dealership' | 'group' | 'block';
  id: string;
  name: string;
  city?: string;
  state?: string;
  coords?: LatLng;
  address?: string;
  /** IANA time zone of the dealership (e.g. America/Phoenix). */
  timeZone?: string;
  /** For group targets: the rooftops this conversation covers. */
  rooftopIds?: string[];
}

export type InterestLevel = 'High' | 'Medium' | 'Low' | 'None';
export type UpsellResult = 'Pitched' | 'Interested' | 'Won' | 'Lost';
export type SimpleResult = 'done' | 'follow_up' | 'not_now' | 'issue';

export type TaskOutcome =
  | { kind: 'simple'; result: SimpleResult }
  | { kind: 'interest'; levels: Record<string, InterestLevel> }
  | { kind: 'upsell'; results: Record<string, UpsellResult> }
  | { kind: 'keyfetch'; needsRefill: boolean; quantity?: number }
  | { kind: 'signed'; productIds: string[] };

export interface SlotTask {
  taskId: string;
  productIds?: string[];
  outcome?: TaskOutcome;
}

export interface EditLogEntry {
  at: string;
  byUserId: string;
  byName: string;
  field: string;
  from: string;
  to: string;
  reason?: string;
}

export interface PlanSlot {
  id: string;
  userId: string;
  /** YYYY-MM-DD. Undefined while the slot is in the plan-later basket. */
  date?: string;
  orderIndex: number;
  status: SlotStatus;

  how: HowType;
  workType: WorkType;
  target: SlotTarget;
  tasks: SlotTask[];

  contactIds: string[];
  contactNames: string[];

  timeMode: TimeMode;
  /** HH:MM — used when timeMode is 'exact' (and for locked slots). */
  fixedTime?: string;
  durationMin: number;
  durationOverridden?: boolean;
  locked?: boolean;
  /** Time held in place by the system after a check-in, until the rep re-plans. */
  autoPinned?: boolean;

  /** Email / text: when it should go out (HH:MM). */
  sendTime?: string;
  message?: string;
  batchId?: string;

  notes?: string;
  basketNote?: string;
  source: SlotSource;
  managerPriorityFrom?: string;
  assistManagerName?: string;

  leftAt?: string;
  checkInAt?: string;
  completedAt?: string;
  spokeWithContactIds?: string[];
  spokeWithNames?: string[];
  outcomeNote?: string;
  pointsAwarded?: number;
  skippedReason?: string;
  corrections?: { at: string; byName: string; note: string }[];
  editLog?: EditLogEntry[];

  createdAt: string;
  updatedAt: string;
}

export interface ActionPoint {
  id: string;
  userId: string;
  title: string;
  dealershipId?: string;
  dealershipName?: string;
  slotId?: string;
  dueDate?: string;
  done: boolean;
  doneAt?: string;
  source: 'manual' | 'task' | 'suggestion';
  googleTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderSettings {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  time: string;
  lastShownWeek?: string;
  /** Demo: show the reminder straight away. */
  forceShow?: boolean;
}

export interface LunchSettings {
  enabled: boolean;
  /** Preferred start, HH:MM */
  time: string;
  durationMin: number;
  /** Flexible = the engine fits it around visits within ±1 hour of the preferred time. */
  flexible: boolean;
}

export interface MyPlanSettings {
  dayStart: string;
  preferredFinish: string;
  lunch: boolean;
  lunchTime: string;
  lunchDurationMin: number;
  lunchFlexible: boolean;
  biggerText: boolean;
  reminder: ReminderSettings;
  reminderAsked: boolean;
  walkthroughDone: boolean;
  aiSuggestions: boolean;
}

export interface EngineSettings {
  dayStart: string;
  preferredFinish: string;
  lunch: boolean;
  lunchTime?: string;
  lunchDurationMin?: number;
  lunchFlexible?: boolean;
  liveStart: string;
  liveEnd: string;
  homeBandMiles: number;
  edgeBandMiles: number;
  parkingMin: number;
  safetyMarginMin: number;
}

export type DistanceBand = 'home' | 'edge' | 'out_of_town';
