export type WorkType = 'new_prospect' | 'client_care';

export type ContactMethod = 'in_person' | 'phone' | 'text' | 'email' | 'meet';

export type PlanActivityType = 
  | 'in_person' 
  | 'phone' 
  | 'meet' 
  | 'email' 
  | 'text' 
  | 'call_session' 
  | 'prep' 
  | 'admin'
  | 'In-Person Visit'
  | 'Phone Call'
  | 'Google Meet'
  | 'Email'
  | 'SMS';

export type DistanceBand = 'home' | 'edge' | 'out_of_town';

export type TimeType = 'exact' | 'morning' | 'afternoon' | 'anytime';

export type PlanItemStatus = 
  | 'planned' 
  | 'in_progress' 
  | 'done' 
  | 'skipped' 
  | 'moved' 
  | 'not_scheduled';

export type PlanItemSource = 
  | 'manual' 
  | 'ai' 
  | 'manager_priority' 
  | 'assist' 
  | 'repeat' 
  | 'template' 
  | 'calendar'
  | 'trip';

export interface PlanItemOutcome {
  result: string; // e.g. "Interested", "Hot", "Top-up done", "Issue to fix"
  notes?: string;
  keyfetchQuantity?: number;
  nextStepDate?: string;
  nextStepAction?: string;
  pointsEarned?: number;
}

export interface PlanItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  timeType: TimeType;
  startTime?: string; // HH:mm (e.g. "10:00")
  endTime?: string;
  estimatedDurationMin: number;
  travelBeforeMin: number; // calculated travel time + parking/walk-in
  travelDistanceMiles: number;
  workType: WorkType;
  method: ContactMethod;
  activityType?: PlanActivityType;
  dealershipId: string;
  dealershipName: string;
  dealershipIds?: string[]; // for multi-dealer call sessions, email batches, text queues
  contactId?: string;
  contactName?: string;
  contactIds?: string[];
  purpose: string;
  status: PlanItemStatus;
  locked: boolean;
  source: PlanItemSource;
  distanceBand?: DistanceBand;
  distanceMiles?: number;
  tripId?: string;
  sendAt?: string; // scheduled send time for email / text
  prepSlot?: {
    startTime: string;
    durationMin: number;
  };
  leaveByTime?: string; // calculated: first appointment - drive - parking - safety margin
  isLiveContact?: boolean; // true for in_person, phone, meet
  managerBadge?: {
    managerName: string;
    priorityLevel: 'Normal' | 'High' | 'Urgent';
    priorityId?: string;
    reason?: string;
  };
  assistId?: string;
  repeatRuleId?: string;
  notes?: string;
  actualStart?: string;
  actualEnd?: string;
  outcome?: PlanItemOutcome;
  activityId?: string;
  createdBy: string;
  updatedAt: string;
  version: number;
}

export interface DaySettings {
  userId: string;
  startAddress: string;
  startCoords: { lat: number; lng: number };
  endAddress: string;
  endCoords: { lat: number; lng: number };
  dayStartTime: string; // "08:30"
  dayFinishTime: string; // "17:30"
  hasLunchBreak: boolean;
  lunchStartTime: string; // "12:00"
  lunchDurationMin: number; // 30
  defaultVisitBufferMin: number; // 10
  focus: 'prospects' | 'clients' | 'mix';
  simpleMode: boolean; // default true for new reps
  largeText: boolean; // default false
  // Section 1 & 5 Distance & Timing additions:
  homeRadiusThreshold?: number; // default 60 mi
  edgeRadiusThreshold?: number; // default 69 mi
  outOfTownThreshold?: number; // default 70 mi
  requireTripApproval?: boolean; // default false
  safetyMarginMin?: number; // default 10 min
  lastPlanningScope?: 'today' | 'tomorrow' | 'week' | 'choose_days';
  workingDays?: number[]; // [1,2,3,4,5] (Mon-Fri)
}

export interface Trip {
  id: string;
  userId: string;
  name?: string;
  tripName?: string;
  area?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  anchorDealershipId?: string;
  anchorDealershipName?: string;
  dealershipIds?: string[];
  stops?: {
    dealershipId: string;
    dealershipName: string;
    city: string;
    state: string;
    distanceMiles?: number;
  }[];
  totalMiles?: number;
  status: 'planned' | 'pending_approval' | 'approved' | 'completed';
  roundTripMiles?: number;
  roundTripDriveHours?: number;
  notes?: string;
  createdAt?: string;
}

export interface SendQueueItem {
  id: string;
  userId?: string;
  planItemId?: string;
  dealershipId: string;
  dealershipName: string;
  contactId?: string;
  contactName?: string;
  channel?: 'email' | 'text';
  type?: 'Email' | 'SMS' | 'email' | 'text';
  recipient?: string;
  recipientAddress?: string; // email or phone
  subject?: string;
  body: string;
  sendAt?: string;
  scheduledFor?: string; // ISO or YYYY-MM-DD HH:mm
  status: 'queued' | 'ready' | 'sent' | 'cancelled';
  sentAt?: string;
  createdAt?: string;
  error?: string;
}

export interface RepeatRule {
  id: string;
  userId: string;
  dealershipId: string;
  dealershipName: string;
  method: ContactMethod;
  workType: WorkType;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: number; // 1=Mon, 2=Tue, etc.
  intervalWeeks?: number;
  description: string;
  active: boolean;
}

export interface DayTemplate {
  id: string;
  userId: string;
  name: string;
  description: string;
  workTypeFocus: 'prospects' | 'clients' | 'mix';
  itemsTemplate: {
    workType: WorkType;
    method: ContactMethod;
    purpose: string;
    preferredTimeType: TimeType;
    estimatedDurationMin: number;
  }[];
}

export interface SlotSuggestion {
  id: string;
  time: string; // "10:30"
  date: string; // "2026-11-05"
  startTime?: string;
  endTime?: string;
  reason?: string;
  displayText: string; // "Tue 10:30 AM – right after Smith Motors, 12 min drive"
  isRecommended: boolean;
  driveMinFromPrevious: number;
  previousStopName?: string;
  gapMinutesAvailable: number;
  confidenceReason: string;
}

export interface FeasibilityReport {
  score: 'light' | 'good' | 'full' | 'too_much';
  label: string; // "Light", "Good", "Full", "Too Much"
  color: string;
  totalContactMin: number;
  totalDriveMin: number;
  totalDistanceMiles: number;
  leaveByTime?: string; // "09:20 AM"
  estimatedFinishTime: string; // "17:40"
  isOverCapacity: boolean;
  outsideGoodWindowCount: number;
  tripCount?: number;
  bandBreakdown?: {
    homeCount: number;
    edgeCount: number;
    outOfTownCount: number;
  };
  warnings: {
    id: string;
    severity: 'info' | 'warning' | 'alert';
    message: string;
    fixAction?: string;
    fixLabel?: string;
    targetItemId?: string;
  }[];
}
