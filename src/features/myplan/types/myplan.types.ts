// Canonical data types for My Plan feature module

export type WorkType = 'prospect' | 'signup_onboarding' | 'client';

export type ActivityType = 'in_person' | 'phone' | 'meet' | 'email' | 'text';

export type DistanceBand = 'home' | 'edge' | 'out_of_town';

export type TimeType = 'exact' | 'morning' | 'afternoon' | 'anytime';

export type PlanSlotStatus = 'planned' | 'in_progress' | 'done' | 'skipped' | 'not_scheduled';

export type PlanSlotSource = 
  | 'manual' 
  | 'ai' 
  | 'manager_priority' 
  | 'assist' 
  | 'calendar' 
  | 'repeat';

export interface PlanSlot {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD in local dealership timezone
  timeType: TimeType;
  startTime: string; // HH:MM
  durationMin: number;
  travelBeforeMin: number;
  orderIndex: number;
  
  workType: WorkType;
  activityType: ActivityType;
  purpose: string;
  
  dealershipId: string;
  dealershipName: string;
  dealershipCity: string;
  dealershipState: string;
  
  contactId?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  
  distanceBand: DistanceBand;
  distanceMiles: number;
  
  tripId?: string;
  sendAt?: string; // for scheduled email / text queue
  message?: string; // body draft
  locked?: boolean; // locked appointment / Manager Assist
  source: PlanSlotSource;
  managerPriorityFrom?: string; // e.g. "Jason Scott"
  batchId?: string; // optional visual display grouping only
  
  status: PlanSlotStatus;
  actualStart?: string;
  actualEnd?: string;
  outcome?: string;
  topupQty?: number; // strictly quantity, no dollars
  notes?: string;
  pointsAwarded?: number;
  
  createdAt: string;
  updatedAt: string;
}

export interface DaySettings {
  homeRadiusThreshold: number; // default 60
  edgeRadiusThreshold: number; // default 69
  outOfTownThreshold: number; // default 70
  safetyMarginMin: number; // default 10
  parkingBufferMin: number; // default 10
  liveWindowStart: string; // default "10:00"
  liveWindowEnd: string; // default "16:00"
  requireTripApproval: boolean; // default false
  biggerText?: boolean;
}

export interface Trip {
  id: string;
  userId: string;
  tripName: string;
  date: string;
  stops: Array<{
    dealershipId: string;
    dealershipName: string;
    city: string;
    milesFromHome: number;
  }>;
  totalMiles: number;
  estHours: number;
  status: 'planned' | 'pending_approval' | 'approved';
}

export interface SendQueueItem {
  id: string;
  userId: string;
  slotId: string;
  dealershipId: string;
  dealershipName: string;
  type: 'email' | 'sms';
  recipient: string;
  recipientName: string;
  subject?: string;
  body: string;
  sendAt: string;
  status: 'queued' | 'sent' | 'cancelled';
}

export interface SlotSuggestion {
  time: string; // HH:MM
  label: string; // e.g. "10:30 AM"
  reason: string; // e.g. "Right after Lone Star Ford, 12 min drive"
  driveTimeMin: number;
  fitsComfortably: boolean;
}

export interface DayRecalculationResult {
  updatedSlots: PlanSlot[];
  leaveByTime: string; // HH:MM
  leaveByTimeFormatted: string; // e.g. "9:15 AM"
  finishTime: string; // HH:MM
  finishTimeFormatted: string; // e.g. "5:30 PM"
  totalDriveMin: number;
  totalDriveMiles: number;
  ruleViolations: Array<{
    slotId: string;
    dealershipName: string;
    rule: 'past_4pm' | 'before_10am' | 'tight_drive';
    message: string;
  }>;
  summaryMessage: string;
}
