export type UserRole = 
  | 'new_rep' 
  | 'veteran_rep' 
  | 'team_lead' 
  | 'manager' 
  | 'finance' 
  | 'executive' 
  | 'owner';

export type USRegion = 'Northeast' | 'Midwest' | 'Southeast' | 'West' | 'Texas / South Central';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  region: USRegion;
  managerId: string | null;
  homeZipCode: string;
  homeCoords: { lat: number; lng: number };
  phone: string;
  avatarUrl?: string;
  hireDate: string;
  isRookie?: boolean;
}

export type PipelineStage = 
  | 'Pool'
  | 'Claimed'
  | 'Visit Planned'
  | 'Visited'
  | 'Follow-up'
  | 'In Progress'
  | 'HOT'
  | 'Negotiation'
  | 'Contract'
  | 'Won'
  | 'Signed'
  | 'Onboarding'
  | 'Client'
  | 'Lost'
  | 'Not Now'
  | 'Disqualified';

export type LeadSource = 'Pool' | 'Assigned' | 'Manual Search';
export type DealershipType = 'Standalone' | 'Dealer Group';
export type FranchiseType = 'Franchise' | 'Independent';
export type HeatLevel = 'Cold' | 'Warm' | 'Hot';
export type TimeZone = 'America/New_York' | 'America/Chicago' | 'America/Denver' | 'America/Los_Angeles';

export interface UsedCarInventoryHistory {
  date: string;
  count: number;
  monthlySales?: number;
  recordedBy: string;
}

export interface DealershipProductInterest {
  productId: string;
  productName: string;
  interestLevel: 'Low' | 'Medium' | 'High';
  recordedDate: string;
  recordedByUserId: string;
  recordedByUserName: string;
}

export interface InventoryTopup {
  id: string;
  dealershipId: string;
  productId: string;
  date: string;
  quantity: number; // QUANTITY ONLY, NO PRICING OR DOLLAR TOTALS
  handledByUserId: string;
  handledByName: string;
  notes?: string;
}

export type UpsellStage = 'Identified' | 'Pitched' | 'Interested' | 'Won' | 'Lost';

export interface UpsellOpportunity {
  id: string;
  dealershipId: string;
  productId: string;
  productName: string;
  stage: UpsellStage;
  ownerId: string;
  ownerName: string;
  nextStep: string;
  createdAt: string;
  wonDate?: string;
  wonByUserId?: string;
}

export interface OnboardingTask {
  id: string;
  title: string;
  ownerUserId: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string;
}

export interface RelationshipTemperature {
  score: number; // 0 - 100
  trend: 'rising' | 'steady' | 'cooling';
  sparkline: number[];
  intentPhrases: string[];
  hesitationPhrases: string[];
  ghostingRisk: 'low' | 'medium' | 'high';
}

export interface OwnershipTransfer {
  id: string;
  dealershipId: string;
  fromRepId: string;
  toRepId: string;
  transferredByManagerId: string;
  transferredByManagerName: string;
  reason: string;
  timestamp: string;
}

export interface Dealership {
  id: string;
  dealershipName: string;
  groupId?: string | null;
  groupName?: string;
  dealershipType: DealershipType;
  rooftopCount: number;
  franchiseType: FranchiseType;
  franchiseBrands: string[];
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: { lat: number; lng: number };
  timeZone: TimeZone;
  usedCarsOnLot: number;
  monthlyUsedSales?: number;
  inventoryHistory: UsedCarInventoryHistory[];
  fiSystem: string;
  fiSource?: string;
  fiCapturedDate?: string;
  stage: PipelineStage;
  heatLevel: HeatLevel;
  source: LeadSource;
  assignedRepId: string | null;
  originRepId: string | null;
  claimedAt?: string | null;
  lastTouchpointDate?: string | null;
  lostReason?: string;
  nurtureFollowUpDate?: string;
  disqualifiedReason?: string;
  hasActiveAssist?: boolean;
  activeAssistId?: string;
  closedBy?: string;
  signedBy?: string;
  closedWithAssistFrom?: string;
  ownershipTransfers?: OwnershipTransfer[];
  relationshipTemperature: RelationshipTemperature;
  productInterests: DealershipProductInterest[];
  signedProducts: string[]; // Product IDs signed
  topups: InventoryTopup[]; // Keyfetch topups (quantity only)
  upsells: UpsellOpportunity[];
  onboardingTasks?: OnboardingTask[];
  clientHealthScore?: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

export interface DealerGroup {
  id: string;
  name: string;
  hqAddress: string;
  hqCity: string;
  hqState: string;
  hqZip: string;
  mainDecisionMaker: string;
  mainPhone: string;
  notes: string;
  groupAccountOwnerId?: string | null;
}

export interface Contact {
  id: string;
  dealershipId: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  email: string;
  isDecisionMaker: boolean;
  notes?: string;
  linkedInUrl?: string;
}

export interface Activity {
  id: string;
  dealershipId: string;
  dealershipName: string;
  userId: string;
  userName: string;
  contactId?: string;
  contactName?: string;
  activityType: 'In-Person Visit' | 'Phone Call' | 'Email' | 'Google Meet' | 'Chat' | 'System Note' | 'Keyfetch Top-up';
  communicationType: 'In-Person' | 'Virtual' | 'Phone' | 'Email' | 'System';
  status: 'pending' | 'completed' | 'cancelled';
  plannedDate?: string; // YYYY-MM-DD
  plannedTime?: string; // HH:mm
  completedAt?: string; // ISO
  isGoodWindow?: boolean; // 10:00 AM - 4:00 PM local time
  notes: string;
  voiceNotesTranscript?: string;
  productsDiscussed: string[];
  interestLevel?: 'Low' | 'Medium' | 'High';
  nextAction?: string;
  nextActionDate?: string;
  checkInLocation?: { lat: number; lng: number; verified: boolean };
  isLocked?: boolean; // Manual stop locking in Planner
  pointsEarned?: number;
}

export type AssistType = 
  | 'join_call' 
  | 'in_person_visit' 
  | 'google_meet' 
  | 'terms_approval' 
  | 'strategy_session' 
  | 'contract_signing_support';

export interface ManagerAssist {
  id: string;
  dealershipId: string;
  dealershipName: string;
  originRepId: string;
  originRepName: string;
  assignedManagerId: string;
  assignedManagerName: string;
  assistType: AssistType;
  proposedTime: string; // HH:mm (respects 10 AM - 4 PM for visits)
  proposedDate: string; // YYYY-MM-DD
  requestDate: string;
  decisionMakerName: string;
  decisionMakerTitle: string;
  objections: string;
  productsOfInterest: string[];
  aiBriefing: string; // Decision maker, objections, products of interest, history - NO PRICING OR MONEY
  status: 'Pending' | 'Accepted' | 'Reschedule Proposed' | 'Declined' | 'Completed';
  managerNotes?: string;
  rescheduledDate?: string;
  rescheduledTime?: string;
  completedAt?: string;
  outcomeNotes?: string;
}

export type IncentiveState = 'Eligible' | 'Pending verification' | 'Verified' | 'Approved' | 'Paid' | 'Rejected' | 'Disputed';

export interface IntroductionTrailStep {
  step: string;
  date: string;
  actor: string;
  details: string;
  isGoodWindow?: boolean;
}

export interface IntroductionIncentive {
  id: string;
  dealershipId: string;
  dealershipName: string;
  originRepId: string;
  originRepName: string;
  closedByUserId: string;
  closedByUserName: string;
  signedByUserId: string;
  signedByUserName: string;
  assistInvolved: boolean;
  assistManagerId?: string;
  assistManagerName?: string;
  triggerEvent: string; // e.g. "introduction qualified", "deal signed", "onboarding complete"
  state: IncentiveState;
  amount?: number; // STRICT EXCEPTION: Only populated/returned for owning rep, managers, owners, and finance Donna Clark
  calculatedRule?: string;
  financeComments?: string;
  verifiedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  paymentReference?: string; // external payment reference
  reviewDate?: string;
  reviewedBy?: string; // Donna Clark
  trail: IntroductionTrailStep[];
  conflicts?: string[];
  amountAuditTrail?: {
    changedBy: string;
    changedAt: string;
    oldAmount: number;
    newAmount: number;
  }[];
}

export interface ProductCatalogItem {
  id: string;
  name: string;
  category?: string;
  description: string;
  isActive: boolean;
  requiresInventoryTopups: boolean; // ON for Keyfetch only by default
  isNewLaunch?: boolean; // Highlighted to reps (e.g., Ceramic Pro)
  dateAdded: string;
  addedBy: string;
}

export interface GamificationBadge {
  id: string;
  name: string;
  category: 'Scouting' | 'Visits' | 'Relationships' | 'Closing' | 'Servicing' | 'Upselling' | 'Teamwork';
  description: string;
  icon: string;
  currentProgress: number;
  targetProgress: number;
  unlocked: boolean;
  earnedDate?: string;
}

export interface PointsLedgerEntry {
  id: string;
  userId: string;
  dealershipId?: string;
  dealershipName?: string;
  actionType: string;
  description: string;
  pointsAwarded: number;
  ruleVersion: string;
  timestamp: string;
}

export interface GameRule {
  id: string;
  actionType: string;
  label: string;
  category: 'Scouting' | 'Visits' | 'Communication' | 'Assists' | 'Closing' | 'Servicing' | 'Priorities' | 'Upselling';
  basePoints: number;
  dailyCap?: number;
  enabled: boolean;
  applicableRoles: UserRole[];
}

export interface ProductBonus {
  id: string;
  productId: string;
  productName: string;
  bonusPoints: number;
  multiplier?: number; // e.g. 2 for 2x
  actionTypes: ('interest_recorded' | 'signed' | 'upsell_won')[];
  startDate: string;
  endDate: string;
  targetType: 'all' | 'region' | 'team' | 'rep';
  targetValue?: string;
  isActive: boolean;
}

export interface ManagerPriority {
  id: string;
  managerId: string;
  managerName: string;
  targetType: 'rep' | 'region' | 'team';
  targetId: string; // repId or region name or 'team'
  title: string;
  reason: string;
  priorityLevel: 'Normal' | 'High' | 'Urgent';
  dueDate: string;
  linkedDealershipId?: string;
  linkedDealershipName?: string;
  linkedProductId?: string;
  linkedProductName?: string;
  bonusPoints?: number;
  status: 'pending' | 'accepted' | 'scheduled' | 'completed' | 'declined';
  declineReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GamificationProfile {
  userId: string;
  points: number;
  pointsToday: number;
  dailyTarget: number;
  streakDays: number;
  bestStreak: number;
  level: number;
  levelTitle: string;
  pointsToNextLevel: number;
  levelProgressPercent: number;
  badges: GamificationBadge[];
  weeklyRank: number;
  monthlyRank: number;
  activeMultiplier?: { label: string; multiplier: number };
  personalBests: {
    maxVisitsDay: number;
    maxWinsMonth: number;
    longestStreak: number;
  };
}

export interface WorkspaceItem {
  id: string;
  service: 'Gmail' | 'Calendar' | 'Meet' | 'Chat' | 'Drive';
  dealershipId?: string;
  dealershipName?: string;
  userId: string;
  date: string;
  subjectOrTitle: string;
  summary: string;
  deepLink?: string;
  actionItems?: string[];
  isMatched: boolean;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  dealershipId: string;
  dealershipName: string;
  action: string;
  details: string;
}
