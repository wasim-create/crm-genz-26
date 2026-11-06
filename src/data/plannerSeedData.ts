import { PlanItem, DaySettings, RepeatRule, DayTemplate, Trip, SendQueueItem } from '../types/planner';

// Default Day Settings for each user
export const INITIAL_DAY_SETTINGS: Record<string, DaySettings> = {
  u_carlos: {
    userId: 'u_carlos',
    startAddress: 'Dallas, TX 75201',
    startCoords: { lat: 32.7876, lng: -96.7996 },
    endAddress: 'Dallas, TX 75201',
    endCoords: { lat: 32.7876, lng: -96.7996 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'mix',
    simpleMode: true, // New reps default to Simple Mode
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    lastPlanningScope: 'today',
    workingDays: [1, 2, 3, 4, 5]
  },
  u_kelley: {
    userId: 'u_kelley',
    startAddress: 'Boston, MA 02108',
    startCoords: { lat: 42.3588, lng: -71.0638 },
    endAddress: 'Boston, MA 02108',
    endCoords: { lat: 42.3588, lng: -71.0638 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:30',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'mix',
    simpleMode: false,
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    lastPlanningScope: 'tomorrow',
    workingDays: [1, 2, 3, 4, 5]
  },
  u_kevin: {
    userId: 'u_kevin',
    startAddress: 'Chicago, IL 60601',
    startCoords: { lat: 41.8853, lng: -87.6219 },
    endAddress: 'Chicago, IL 60601',
    endCoords: { lat: 41.8853, lng: -87.6219 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'prospects',
    simpleMode: false,
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    lastPlanningScope: 'week',
    workingDays: [1, 2, 3, 4, 5]
  },
  u_toddb: {
    userId: 'u_toddb',
    startAddress: 'Atlanta, GA 30301',
    startCoords: { lat: 33.7537, lng: -84.3863 },
    endAddress: 'Atlanta, GA 30301',
    endCoords: { lat: 33.7537, lng: -84.3863 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:30',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'clients',
    simpleMode: false,
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    lastPlanningScope: 'today',
    workingDays: [1, 2, 3, 4, 5]
  },
  u_jason: {
    userId: 'u_jason',
    startAddress: 'Avenel, NJ 07001',
    startCoords: { lat: 40.5843, lng: -74.2796 },
    endAddress: 'Avenel, NJ 07001',
    endCoords: { lat: 40.5843, lng: -74.2796 },
    dayStartTime: '08:30',
    dayFinishTime: '17:30',
    hasLunchBreak: true,
    lunchStartTime: '12:00',
    lunchDurationMin: 30,
    defaultVisitBufferMin: 10,
    focus: 'mix',
    simpleMode: false,
    largeText: false,
    homeRadiusThreshold: 60,
    edgeRadiusThreshold: 69,
    outOfTownThreshold: 70,
    requireTripApproval: false,
    safetyMarginMin: 10,
    lastPlanningScope: 'today',
    workingDays: [1, 2, 3, 4, 5]
  }
};

export const INITIAL_TRIPS: Trip[] = [
  {
    id: 'trip_kevin_rockford',
    userId: 'u_kevin',
    name: 'Rockford Area Expansion Trip',
    area: 'Rockford / Belvidere Corridor, IL',
    startDate: getRelativeDate(2), // Thursday
    endDate: getRelativeDate(2),
    dealershipIds: ['deal_25', 'deal_26', 'deal_27'],
    status: 'approved',
    roundTripMiles: 220,
    roundTripDriveHours: 3.8,
    notes: 'Cluster of 3 dealerships in Rockford area. Travel amortized over full day.'
  }
];

export const INITIAL_SEND_QUEUE: SendQueueItem[] = [
  {
    id: 'sq_1',
    planItemId: 'pi_toddb_email_batch',
    dealershipId: 'deal_31',
    dealershipName: 'Atlanta Luxury Motors Roswell',
    contactName: 'Marcus Bennett',
    channel: 'email',
    recipientAddress: 'mbennett@almotors.example.com',
    subject: 'Ceramic Pro Nano-Coating for Pre-Owned Frontline Units',
    body: 'Hi Marcus, following up on our lot review. We just launched Ceramic Pro with immediate dealer warranty support.',
    scheduledFor: `${getRelativeDate(1)} 10:15`,
    status: 'queued'
  },
  {
    id: 'sq_2',
    planItemId: 'pi_toddb_email_batch',
    dealershipId: 'deal_32',
    dealershipName: 'Nalley Honda of Rome',
    contactName: 'Sarah Jenkins',
    channel: 'email',
    recipientAddress: 'sjenkins@nalley.example.com',
    subject: 'Ceramic Pro Introduction',
    body: 'Hi Sarah, thought you might like to review the new Ceramic Pro collateral ahead of next month.',
    scheduledFor: `${getRelativeDate(1)} 10:15`,
    status: 'queued'
  }
];

export const INITIAL_REPEAT_RULES: RepeatRule[] = [
  {
    id: 'rr_1',
    userId: 'u_kelley',
    dealershipId: 'deal_1',
    dealershipName: 'Holman Ford of Boston',
    method: 'phone',
    workType: 'client_care',
    frequency: 'biweekly',
    dayOfWeek: 2, // Tuesday
    intervalWeeks: 2,
    description: 'Call client check-in every 2nd Tuesday',
    active: true
  },
  {
    id: 'rr_2',
    userId: 'u_toddb',
    dealershipId: 'deal_32',
    dealershipName: 'Nalley Honda of Rome',
    method: 'in_person',
    workType: 'client_care',
    frequency: 'monthly',
    intervalWeeks: 4,
    description: 'Keyfetch hardware top-up inspection every 4 weeks',
    active: true
  }
];

export const INITIAL_DAY_TEMPLATES: DayTemplate[] = [
  {
    id: 'tpl_prospecting',
    userId: 'u_carlos',
    name: 'Prospecting Blitz Day',
    description: '3 in-person prospect discovery stops with morning warm-up calls',
    workTypeFocus: 'prospects',
    itemsTemplate: [
      { workType: 'new_prospect', method: 'phone', purpose: 'Pre-call decision maker', preferredTimeType: 'morning', estimatedDurationMin: 15 },
      { workType: 'new_prospect', method: 'in_person', purpose: 'First discovery lot visit', preferredTimeType: 'morning', estimatedDurationMin: 45 },
      { workType: 'new_prospect', method: 'in_person', purpose: 'Product pitch meeting', preferredTimeType: 'afternoon', estimatedDurationMin: 45 },
      { workType: 'new_prospect', method: 'phone', purpose: 'Follow-up on proposal', preferredTimeType: 'afternoon', estimatedDurationMin: 15 }
    ]
  },
  {
    id: 'tpl_client_care',
    userId: 'u_carlos',
    name: 'Client Care & Upsell Day',
    description: 'Dedicated remote servicing day from home with zero driving',
    workTypeFocus: 'clients',
    itemsTemplate: [
      { workType: 'client_care', method: 'phone', purpose: 'Keyfetch run-rate check', preferredTimeType: 'morning', estimatedDurationMin: 15 },
      { workType: 'client_care', method: 'meet', purpose: 'Ceramic Pro upsell demo', preferredTimeType: 'morning', estimatedDurationMin: 30 },
      { workType: 'client_care', method: 'email', purpose: 'Monthly performance summary', preferredTimeType: 'afternoon', estimatedDurationMin: 10 },
      { workType: 'client_care', method: 'phone', purpose: 'Service director quarterly review', preferredTimeType: 'afternoon', estimatedDurationMin: 20 }
    ]
  }
];

// Helper to format dates relative to today:
// e.g., offsetDays(-2) gives 2 days ago, offsetDays(1) gives tomorrow
export function getRelativeDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

export function buildInitialPlanItems(): PlanItem[] {
  const items: PlanItem[] = [];

  // =========================================================================
  // 1. CARLOS MARTINEZ (New Rep, Texas / South Central) - Rich scenarios
  // =========================================================================
  
  // TODAY (relative 0) - Active Field Day
  items.push(
    {
      id: 'pi_carlos_today_1',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'exact',
      startTime: '09:00',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'new_prospect',
      method: 'phone',
      dealershipId: 'deal_65',
      dealershipName: 'Plano Lincoln Mercury',
      contactName: 'Brian Davis (Sales Mgr)',
      purpose: 'Confirm afternoon availability',
      status: 'done',
      locked: true,
      source: 'manual',
      outcome: {
        result: 'Confirmed',
        notes: 'Brian confirmed he will be on the sales floor after 1:00 PM.',
        pointsEarned: 10
      },
      activityId: 'act_c_1',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T09:15:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_today_2',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'exact',
      startTime: '10:30',
      estimatedDurationMin: 45,
      travelBeforeMin: 25,
      travelDistanceMiles: 9.4,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_61',
      dealershipName: 'Park Cities Ford Dallas',
      contactName: 'Carlos Vance (GM)',
      purpose: 'First visit & lot walk',
      status: 'in_progress',
      locked: true,
      source: 'manual',
      notes: 'Focus on F&I RouteOne integration and pre-owned inventory.',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T10:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_today_3',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'afternoon',
      startTime: '13:45',
      estimatedDurationMin: 45,
      travelBeforeMin: 28,
      travelDistanceMiles: 14.1,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_65',
      dealershipName: 'Plano Lincoln Mercury',
      contactName: 'Brian Davis (Sales Mgr)',
      purpose: 'Product pitch meeting',
      status: 'planned',
      locked: false,
      source: 'ai',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_today_4',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'afternoon',
      startTime: '15:15',
      estimatedDurationMin: 20,
      travelBeforeMin: 18,
      travelDistanceMiles: 7.2,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_62',
      dealershipName: 'Dallas Toyota Superstore',
      contactName: 'Elena Rostova (F&I Director)',
      purpose: 'Keyfetch top-up check',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_today_5',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'afternoon',
      startTime: '16:15',
      estimatedDurationMin: 10,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'text',
      dealershipId: 'deal_63',
      dealershipName: 'Fort Worth Chevrolet',
      contactName: 'Jim Hawkins (Service Mgr)',
      purpose: 'Quick check-in on warranty claims',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // TOMORROW (relative +1) - Mixed Day
  items.push(
    {
      id: 'pi_carlos_tom_1',
      userId: 'u_carlos',
      date: getRelativeDate(1),
      timeType: 'morning',
      startTime: '09:00',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'phone',
      dealershipId: 'deal_62',
      dealershipName: 'Dallas Toyota Superstore',
      purpose: 'Follow-up on Keyfetch fobs arrival',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_tom_2',
      userId: 'u_carlos',
      date: getRelativeDate(1),
      timeType: 'morning',
      startTime: '10:15',
      estimatedDurationMin: 45,
      travelBeforeMin: 22,
      travelDistanceMiles: 8.5,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_64',
      dealershipName: 'Irving Honda Center',
      contactName: 'Marcus Bennett',
      purpose: 'First visit & decision-maker intro',
      status: 'planned',
      locked: true,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_tom_3',
      userId: 'u_carlos',
      date: getRelativeDate(1),
      timeType: 'afternoon',
      startTime: '14:00',
      estimatedDurationMin: 30,
      travelBeforeMin: 25,
      travelDistanceMiles: 11.2,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_63',
      dealershipName: 'Fort Worth Chevrolet',
      purpose: 'Keyfetch top-up (200 units)',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // THURSDAY (relative +2) - Includes Manager Priority ("From Jason Scott")
  items.push(
    {
      id: 'pi_carlos_mgr_pri',
      userId: 'u_carlos',
      date: getRelativeDate(2),
      timeType: 'morning',
      startTime: '10:45',
      estimatedDurationMin: 35,
      travelBeforeMin: 20,
      travelDistanceMiles: 8.0,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_66',
      dealershipName: 'Arlington Nissan World',
      contactName: 'David Lee (Dealer Principal)',
      purpose: 'Pitch Ceramic Pro & VSC',
      status: 'planned',
      locked: true,
      source: 'manager_priority',
      managerBadge: {
        managerName: 'Jason Scott',
        priorityLevel: 'Urgent',
        reason: 'Dealer requested priority meeting on Ceramic Pro launch (+50 bonus pts)'
      },
      createdBy: 'u_jason',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_thur_2',
      userId: 'u_carlos',
      date: getRelativeDate(2),
      timeType: 'afternoon',
      startTime: '13:30',
      estimatedDurationMin: 30,
      travelBeforeMin: 22,
      travelDistanceMiles: 9.1,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_67',
      dealershipName: 'Grand Prairie CDJR',
      purpose: 'Quarterly review & Keyfetch top-up',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // WEDNESDAY NEXT WEEK (relative +7) - Client Care Only Day (Zero Driving)
  items.push(
    {
      id: 'pi_carlos_wed_1',
      userId: 'u_carlos',
      date: getRelativeDate(7),
      timeType: 'morning',
      startTime: '09:15',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'phone',
      dealershipId: 'deal_62',
      dealershipName: 'Dallas Toyota Superstore',
      purpose: 'Keyfetch replenishment phone check',
      status: 'planned',
      locked: false,
      source: 'template',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_wed_2',
      userId: 'u_carlos',
      date: getRelativeDate(7),
      timeType: 'morning',
      startTime: '10:30',
      estimatedDurationMin: 30,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'meet',
      dealershipId: 'deal_63',
      dealershipName: 'Fort Worth Chevrolet',
      purpose: 'Google Meet on warranty claim reporting',
      status: 'planned',
      locked: true,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_wed_3',
      userId: 'u_carlos',
      date: getRelativeDate(7),
      timeType: 'afternoon',
      startTime: '13:30',
      estimatedDurationMin: 10,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'email',
      dealershipId: 'deal_67',
      dealershipName: 'Grand Prairie CDJR',
      purpose: 'Send product brochures and marketing collateral',
      status: 'planned',
      locked: false,
      source: 'template',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_wed_4',
      userId: 'u_carlos',
      date: getRelativeDate(7),
      timeType: 'afternoon',
      startTime: '14:30',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'phone',
      dealershipId: 'deal_68',
      dealershipName: 'Frisco Hyundai Superstore',
      purpose: 'Check-in on pre-owned lot turn',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // OVER-FULL DAY DEMO (relative +3, Friday) - 5 in-person visits across broad distance
  items.push(
    {
      id: 'pi_carlos_full_1',
      userId: 'u_carlos',
      date: getRelativeDate(3),
      timeType: 'morning',
      startTime: '09:30',
      estimatedDurationMin: 45,
      travelBeforeMin: 30,
      travelDistanceMiles: 15.2,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_61',
      dealershipName: 'Park Cities Ford Dallas',
      purpose: 'Meeting 1',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_full_2',
      userId: 'u_carlos',
      date: getRelativeDate(3),
      timeType: 'morning',
      startTime: '11:00',
      estimatedDurationMin: 45,
      travelBeforeMin: 35,
      travelDistanceMiles: 19.5,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_64',
      dealershipName: 'Irving Honda Center',
      purpose: 'Meeting 2',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_full_3',
      userId: 'u_carlos',
      date: getRelativeDate(3),
      timeType: 'afternoon',
      startTime: '13:00',
      estimatedDurationMin: 45,
      travelBeforeMin: 35,
      travelDistanceMiles: 18.0,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_63',
      dealershipName: 'Fort Worth Chevrolet',
      purpose: 'Meeting 3',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_full_4',
      userId: 'u_carlos',
      date: getRelativeDate(3),
      timeType: 'afternoon',
      startTime: '14:45',
      estimatedDurationMin: 45,
      travelBeforeMin: 40,
      travelDistanceMiles: 23.0,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_68',
      dealershipName: 'Frisco Hyundai Superstore',
      purpose: 'Meeting 4',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_full_5',
      userId: 'u_carlos',
      date: getRelativeDate(3),
      timeType: 'afternoon',
      startTime: '16:30',
      estimatedDurationMin: 45,
      travelBeforeMin: 35,
      travelDistanceMiles: 17.5,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_67',
      dealershipName: 'Grand Prairie CDJR',
      purpose: 'Meeting 5',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // NOT SCHEDULED YET TRAY ITEMS (Carlos)
  items.push(
    {
      id: 'pi_carlos_tray_1',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'anytime',
      estimatedDurationMin: 30,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_69',
      dealershipName: 'Denton Mazda Village',
      purpose: 'Drop by introduction',
      status: 'not_scheduled',
      locked: false,
      source: 'manual',
      notes: 'Interested in Ceramic Pro launch. Rep wants to schedule this week.',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_carlos_tray_2',
      userId: 'u_carlos',
      date: getRelativeDate(0),
      timeType: 'anytime',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'client_care',
      method: 'phone',
      dealershipId: 'deal_70',
      dealershipName: 'McKinney Buick GMC',
      purpose: 'Inventory top-up check',
      status: 'not_scheduled',
      locked: false,
      source: 'manual',
      createdBy: 'u_carlos',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  // =========================================================================
  // PAST 4 WEEKS (Diary entries with outcomes and earned points)
  // =========================================================================
  for (let week = 1; week <= 4; week++) {
    const daysAgo = week * 7;
    // Monday
    items.push({
      id: `pi_past_m_${week}`,
      userId: 'u_carlos',
      date: getRelativeDate(-daysAgo),
      timeType: 'exact',
      startTime: '10:30',
      estimatedDurationMin: 45,
      travelBeforeMin: 25,
      travelDistanceMiles: 10.2,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_61',
      dealershipName: 'Park Cities Ford Dallas',
      contactName: 'Carlos Vance (GM)',
      purpose: 'Discovery lot visit',
      status: 'done',
      locked: true,
      source: 'manual',
      actualStart: '10:32',
      actualEnd: '11:18',
      outcome: {
        result: 'Hot',
        notes: 'Great conversation with Carlos Vance. Verified lot size at 140 cars. F&I system is RouteOne.',
        nextStepDate: getRelativeDate(-daysAgo + 3),
        nextStepAction: 'Bring proposal for VSC + Certified Warranty',
        pointsEarned: 40
      },
      createdBy: 'u_carlos',
      updatedAt: '2026-10-15T12:00:00Z',
      version: 1
    });

    // Wednesday
    items.push({
      id: `pi_past_w_${week}`,
      userId: 'u_carlos',
      date: getRelativeDate(-daysAgo + 2),
      timeType: 'exact',
      startTime: '14:00',
      estimatedDurationMin: 25,
      travelBeforeMin: 20,
      travelDistanceMiles: 8.4,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_62',
      dealershipName: 'Dallas Toyota Superstore',
      contactName: 'Elena Rostova',
      purpose: 'Keyfetch top-up',
      status: 'done',
      locked: false,
      source: 'manual',
      actualStart: '14:00',
      actualEnd: '14:24',
      outcome: {
        result: 'Top-up done',
        notes: 'Delivered 250 Keyfetch fobs. Checked hardware scanner.',
        keyfetchQuantity: 250,
        nextStepDate: getRelativeDate(-daysAgo + 30),
        nextStepAction: 'Monthly replenishment check',
        pointsEarned: 30
      },
      createdBy: 'u_carlos',
      updatedAt: '2026-10-17T15:00:00Z',
      version: 1
    });

    // Thursday
    items.push({
      id: `pi_past_th_${week}`,
      userId: 'u_carlos',
      date: getRelativeDate(-daysAgo + 3),
      timeType: 'exact',
      startTime: '11:00',
      estimatedDurationMin: 15,
      travelBeforeMin: 0,
      travelDistanceMiles: 0,
      workType: 'new_prospect',
      method: 'phone',
      dealershipId: 'deal_64',
      dealershipName: 'Irving Honda Center',
      contactName: 'Marcus Bennett',
      purpose: 'Follow-up call on terms',
      status: 'done',
      locked: false,
      source: 'manual',
      actualStart: '11:00',
      actualEnd: '11:14',
      outcome: {
        result: 'Interested',
        notes: 'Marcus requested electronic brochure on Ceramic Pro.',
        pointsEarned: 10
      },
      createdBy: 'u_carlos',
      updatedAt: '2026-10-18T11:30:00Z',
      version: 1
    });
  }

  // =========================================================================
  // 2. KELLEY KOLIOPULOS (Northeast, Veteran Rep)
  // =========================================================================
  items.push(
    {
      id: 'pi_kelley_1',
      userId: 'u_kelley',
      date: getRelativeDate(0),
      timeType: 'exact',
      startTime: '10:30',
      estimatedDurationMin: 45,
      travelBeforeMin: 25,
      travelDistanceMiles: 9.8,
      workType: 'new_prospect',
      method: 'in_person',
      dealershipId: 'deal_6',
      dealershipName: 'Worcester Subaru Center',
      purpose: 'Manager Priority follow-up',
      status: 'planned',
      locked: true,
      source: 'manager_priority',
      managerBadge: {
        managerName: 'Jason Scott',
        priorityLevel: 'High',
        reason: 'Client requested VSC coverage confirmation (+50 pts)'
      },
      createdBy: 'u_jason',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    },
    {
      id: 'pi_kelley_2',
      userId: 'u_kelley',
      date: getRelativeDate(0),
      timeType: 'afternoon',
      startTime: '14:00',
      estimatedDurationMin: 30,
      travelBeforeMin: 22,
      travelDistanceMiles: 8.2,
      workType: 'client_care',
      method: 'in_person',
      dealershipId: 'deal_1',
      dealershipName: 'Holman Ford of Boston',
      purpose: 'Keyfetch replenishment (300 units)',
      status: 'planned',
      locked: false,
      source: 'manual',
      createdBy: 'u_kelley',
      updatedAt: '2026-11-04T08:00:00Z',
      version: 1
    }
  );

  return items;
}

export const INITIAL_PLAN_ITEMS: PlanItem[] = buildInitialPlanItems();
