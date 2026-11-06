import {
  User,
  Dealership,
  DealerGroup,
  Contact,
  Activity,
  ManagerAssist,
  IntroductionIncentive,
  ProductCatalogItem,
  GamificationProfile,
  WorkspaceItem,
  AuditLogRecord,
  InventoryTopup,
  GameRule,
  ProductBonus,
  ManagerPriority,
  PointsLedgerEntry,
  RelationshipTemperature
} from '../types/crm';
import { getTimeZoneFromZip } from '../utils/territory';

export const USERS: User[] = [
  {
    id: 'u_kelley',
    firstName: 'Kelley',
    lastName: 'Koliopulos',
    email: 'kelley.koliopulos@example.com',
    role: 'veteran_rep',
    region: 'Northeast',
    managerId: 'u_jason',
    homeZipCode: '02108',
    homeCoords: { lat: 42.3588, lng: -71.0638 },
    phone: '(617) 555-0142',
    hireDate: '2023-03-15',
    isRookie: false
  },
  {
    id: 'u_kevin',
    firstName: 'Kevin',
    lastName: 'Houk',
    email: 'kevin.houk@example.com',
    role: 'veteran_rep',
    region: 'Midwest',
    managerId: 'u_jason',
    homeZipCode: '60601',
    homeCoords: { lat: 41.8853, lng: -87.6219 },
    phone: '(312) 555-0188',
    hireDate: '2022-09-01',
    isRookie: false
  },
  {
    id: 'u_toddb',
    firstName: 'Todd',
    lastName: 'Bilius',
    email: 'todd.bilius@example.com',
    role: 'veteran_rep',
    region: 'Southeast',
    managerId: 'u_jose',
    homeZipCode: '30301',
    homeCoords: { lat: 33.7537, lng: -84.3863 },
    phone: '(404) 555-0193',
    hireDate: '2021-11-10',
    isRookie: false
  },
  {
    id: 'u_toddk',
    firstName: 'Todd',
    lastName: 'Kelly',
    email: 'todd.kelly@example.com',
    role: 'veteran_rep',
    region: 'West',
    managerId: 'u_michael',
    homeZipCode: '90210',
    homeCoords: { lat: 34.0901, lng: -118.4065 },
    phone: '(310) 555-0177',
    hireDate: '2023-01-20',
    isRookie: false
  },
  {
    id: 'u_carlos',
    firstName: 'Carlos',
    lastName: 'Martinez',
    email: 'carlos.martinez@example.com',
    role: 'new_rep',
    region: 'Texas / South Central',
    managerId: 'u_jose',
    homeZipCode: '75201',
    homeCoords: { lat: 32.7876, lng: -96.7996 },
    phone: '(214) 555-0134',
    hireDate: '2026-08-15',
    isRookie: true
  },
  {
    id: 'u_jason',
    firstName: 'Jason',
    lastName: 'Scott',
    email: 'jason.scott@example.com',
    role: 'manager',
    region: 'Northeast',
    managerId: 'u_john',
    homeZipCode: '07001',
    homeCoords: { lat: 40.5843, lng: -74.2796 },
    phone: '(973) 555-0165',
    hireDate: '2020-04-01'
  },
  {
    id: 'u_jose',
    firstName: 'Jose',
    lastName: 'Matos',
    email: 'jose.matos@example.com',
    role: 'manager',
    region: 'Southeast',
    managerId: 'u_john',
    homeZipCode: '33101',
    homeCoords: { lat: 25.7617, lng: -80.1918 },
    phone: '(305) 555-0128',
    hireDate: '2021-02-15'
  },
  {
    id: 'u_michael',
    firstName: 'Michael',
    lastName: 'Sena',
    email: 'michael.sena@example.com',
    role: 'manager',
    region: 'West',
    managerId: 'u_john',
    homeZipCode: '94102',
    homeCoords: { lat: 37.7749, lng: -122.4194 },
    phone: '(415) 555-0199',
    hireDate: '2019-08-10'
  },
  {
    id: 'u_john',
    firstName: 'John',
    lastName: 'Katsikas',
    email: 'john.katsikas@example.com',
    role: 'executive',
    region: 'Northeast',
    managerId: 'u_david',
    homeZipCode: '02110',
    homeCoords: { lat: 42.3557, lng: -71.0505 },
    phone: '(617) 555-0111',
    hireDate: '2018-01-01'
  },
  {
    id: 'u_david',
    firstName: 'David',
    lastName: 'Sterling',
    email: 'david.sterling@example.com',
    role: 'owner',
    region: 'Northeast',
    managerId: null,
    homeZipCode: '02108',
    homeCoords: { lat: 42.3588, lng: -71.0638 },
    phone: '(617) 555-0100',
    hireDate: '2016-01-01'
  },
  {
    id: 'u_donna',
    firstName: 'Donna',
    lastName: 'Clark',
    email: 'donna.clark@example.com',
    role: 'finance',
    region: 'Midwest',
    managerId: null,
    homeZipCode: '48201',
    homeCoords: { lat: 42.3487, lng: -83.0641 },
    phone: '(313) 555-0149',
    hireDate: '2019-05-20'
  }
];

// Exactly 10 default products from Section 2 (NO price fields)
export const PRODUCT_CATALOG: ProductCatalogItem[] = [
  {
    id: 'prod_1',
    name: 'Vehicle Service Contract (Extended Warranty)',
    category: 'Warranty & Protection',
    description: 'Comprehensive mechanical breakdown coverage for pre-owned inventory with rapid claims processing.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-01-15',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_2',
    name: 'Certified Limited Warranty',
    category: 'Warranty & Protection',
    description: 'Dealership-branded powertrain and certified warranty program to boost pre-owned customer confidence.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-01-15',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_3',
    name: 'Keyfetch',
    category: 'Hardware & Lot Tracking',
    description: 'Smart key tracking hardware, fobs and real-time lot inventory management.',
    isActive: true,
    requiresInventoryTopups: true, // ON for Keyfetch ONLY by default
    isNewLaunch: false,
    dateAdded: '2023-01-15',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_4',
    name: 'GAP',
    category: 'F&I Ancillary',
    description: 'Guaranteed Asset Protection for consumer auto financing and total loss protection.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-02-01',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_5',
    name: 'Tire & Wheel Protection',
    category: 'F&I Ancillary',
    description: 'Road hazard tire, wheel, and cosmetic alloy rim repair coverage.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-02-01',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_6',
    name: 'Maintenance',
    category: 'Service Dept',
    description: 'Pre-paid complimentary oil, filter, tire rotation, and scheduled service packages.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-03-01',
    addedBy: 'David Sterling'
  },
  {
    id: 'prod_7',
    name: 'GPS + AI + Vehicle History Plug-in',
    category: 'Telematics & Digital',
    description: 'OBD-II real-time lot tracking, low-battery alerts, and instant vehicle history insight.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2023-06-10',
    addedBy: 'Jason Scott'
  },
  {
    id: 'prod_8',
    name: 'ChargeClub (No Capex)',
    category: 'EV Infrastructure',
    description: 'Zero capital expenditure turnkey EV fast chargers and dealership customer charging network.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2024-01-10',
    addedBy: 'Jason Scott'
  },
  {
    id: 'prod_9',
    name: 'EV Solutions',
    category: 'EV Infrastructure',
    description: 'High-voltage technician toolkits, battery health diagnostics, and EV service readiness certifications.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: false,
    dateAdded: '2024-04-15',
    addedBy: 'Jason Scott'
  },
  {
    id: 'prod_10',
    name: 'Ceramic Pro',
    category: 'Appearance & Protection',
    description: 'Next-generation ceramic nano-coating and interior protective sealant.',
    isActive: true,
    requiresInventoryTopups: false,
    isNewLaunch: true, // NEW launch badge
    dateAdded: '2026-10-01',
    addedBy: 'David Sterling'
  }
];

export const FI_SYSTEMS_LIST: string[] = [
  'RouteOne',
  'DealerTrack',
  'CDK Global',
  'Reynolds & Reynolds',
  'DOWC Retro Structure',
  'Automate DMS',
  'Other'
];

export const DEALER_GROUPS: DealerGroup[] = [
  {
    id: 'grp_holman',
    name: 'Holman Automotive Group',
    hqAddress: '740 US-130',
    hqCity: 'Cinnaminson',
    hqState: 'NJ',
    hqZip: '08077',
    mainDecisionMaker: 'Don Ferguson (VP Dealership Operations)',
    mainPhone: '(856) 555-0120',
    notes: 'Major retail dealership enterprise across NJ, PA, and New England.',
    groupAccountOwnerId: 'u_jason'
  },
  {
    id: 'grp_alm',
    name: 'ALM Automotive Group',
    hqAddress: '2544 Barrett Lakes Blvd',
    hqCity: 'Kennesaw',
    hqState: 'GA',
    hqZip: '30144',
    mainDecisionMaker: 'Marcus Vance (Regional Director)',
    mainPhone: '(770) 555-0422',
    notes: '8 high-volume pre-owned supercenters across metro Atlanta and the Carolinas.',
    groupAccountOwnerId: 'u_toddb'
  },
  {
    id: 'grp_baywatch',
    name: 'Baywatch Automotive Partners',
    hqAddress: '1000 Wilshire Blvd',
    hqCity: 'Los Angeles',
    hqState: 'CA',
    hqZip: '90017',
    mainDecisionMaker: 'Elena Rostova (Chief Operating Officer)',
    mainPhone: '(213) 555-0399',
    notes: 'West coast dealership syndicate targeting 12 rooftops across California and Arizona.',
    groupAccountOwnerId: 'u_michael'
  },
  {
    id: 'grp_lonestar',
    name: 'Lone Star Premier Auto Group',
    hqAddress: '1500 North Stemmons Fwy',
    hqCity: 'Dallas',
    hqState: 'TX',
    hqZip: '75207',
    mainDecisionMaker: 'Travis Hollister (General Manager)',
    mainPhone: '(214) 555-0890',
    notes: '9 rooftops covering DFW, Austin, and Houston corridors.',
    groupAccountOwnerId: 'u_jose'
  },
  {
    id: 'grp_heritage',
    name: 'Midwest Heritage Dealerships',
    hqAddress: '800 N Michigan Ave',
    hqCity: 'Chicago',
    hqState: 'IL',
    hqZip: '60611',
    mainDecisionMaker: 'Robert Klein (Managing Partner)',
    mainPhone: '(312) 555-0922',
    notes: 'Family-operated 6 store network across Chicagoland and southern Wisconsin.',
    groupAccountOwnerId: 'u_kevin'
  }
];

export const INITIAL_TOPUPS: InventoryTopup[] = [
  { id: 'top_1', dealershipId: 'deal_1', productId: 'prod_3', date: '2026-08-15', quantity: 250, handledByUserId: 'u_kelley', handledByName: 'Kelley Koliopulos', notes: 'Quarterly lot refill' },
  { id: 'top_2', dealershipId: 'deal_1', productId: 'prod_3', date: '2026-10-10', quantity: 300, handledByUserId: 'u_kelley', handledByName: 'Kelley Koliopulos', notes: 'Fall promotion restock' },
  { id: 'top_3', dealershipId: 'deal_2', productId: 'prod_3', date: '2026-09-05', quantity: 200, handledByUserId: 'u_kelley', handledByName: 'Kelley Koliopulos', notes: 'Regular restock' },
  { id: 'top_4', dealershipId: 'deal_17', productId: 'prod_3', date: '2026-07-20', quantity: 400, handledByUserId: 'u_kevin', handledByName: 'Kevin Houk', notes: 'Large summer order' },
  { id: 'top_5', dealershipId: 'deal_17', productId: 'prod_3', date: '2026-09-22', quantity: 450, handledByUserId: 'u_kevin', handledByName: 'Kevin Houk', notes: 'Replenishment' },
  { id: 'top_6', dealershipId: 'deal_32', productId: 'prod_3', date: '2026-08-01', quantity: 350, handledByUserId: 'u_toddb', handledByName: 'Todd Bilius', notes: 'Bi-monthly shipment' },
  { id: 'top_7', dealershipId: 'deal_32', productId: 'prod_3', date: '2026-10-02', quantity: 350, handledByUserId: 'u_toddb', handledByName: 'Todd Bilius', notes: 'Repeat shipment' },
  { id: 'top_8', dealershipId: 'deal_47', productId: 'prod_3', date: '2026-09-14', quantity: 500, handledByUserId: 'u_toddk', handledByName: 'Todd Kelly', notes: 'Fleet order' }
];

export const INITIAL_ASSISTS: ManagerAssist[] = [
  {
    id: 'ast_1',
    dealershipId: 'deal_2',
    dealershipName: 'Quincy Toyota Center',
    originRepId: 'u_kelley',
    originRepName: 'Kelley Koliopulos',
    assignedManagerId: 'u_jason',
    assignedManagerName: 'Jason Scott',
    assistType: 'terms_approval',
    proposedDate: '2026-10-23',
    proposedTime: '11:00',
    requestDate: '2026-10-20T15:00:00Z',
    decisionMakerName: 'Alice Jones',
    decisionMakerTitle: 'Dealer Principal',
    objections: 'Wants confirmation on claims turnaround speed (<24 hours).',
    productsOfInterest: ['Vehicle Service Contract (Extended Warranty)'],
    aiBriefing: 'Dealership has steady 45 used car sales/mo. Current F&I system is RouteOne. Alice Jones values local rep responsiveness above all.',
    status: 'Completed',
    completedAt: '2026-10-23T11:45:00Z',
    outcomeNotes: 'Jason joined Google Meet with Alice Jones. Confirmed <24hr claims SLA. Dealership moved to Contract stage.'
  },
  {
    id: 'ast_2',
    dealershipId: 'deal_19',
    dealershipName: 'Midwest Heritage Ford of Schaumburg',
    originRepId: 'u_kevin',
    originRepName: 'Kevin Houk',
    assignedManagerId: 'u_jason',
    assignedManagerName: 'Jason Scott',
    assistType: 'strategy_session',
    proposedDate: '2026-10-22',
    proposedTime: '11:00',
    requestDate: '2026-10-22T09:00:00Z',
    decisionMakerName: 'Robert Klein',
    decisionMakerTitle: 'Managing Partner',
    objections: 'Multi-store training logistics across 3 regions.',
    productsOfInterest: ['Keyfetch', 'GPS + AI + Vehicle History Plug-in'],
    aiBriefing: 'High-potential dealer group account. Won status on store 1 will trigger automatic sister store rollouts.',
    status: 'Accepted',
    managerNotes: 'Confirmed strategy call with Robert Klein. Presenting centralized onboarding plan.'
  },
  {
    id: 'ast_3',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    originRepId: 'u_toddb',
    originRepName: 'Todd Bilius',
    assignedManagerId: 'u_jose',
    assignedManagerName: 'Jose Matos',
    assistType: 'contract_signing_support',
    proposedDate: '2026-10-29',
    proposedTime: '14:00',
    requestDate: '2026-10-28T16:00:00Z',
    decisionMakerName: 'Marcus Vance',
    decisionMakerTitle: 'Regional Director',
    objections: 'None remaining. Needs executive signing authority.',
    productsOfInterest: ['Vehicle Service Contract (Extended Warranty)', 'Ceramic Pro'],
    aiBriefing: 'High volume pre-owned lot with 175 cars. Ready for final contract signature.',
    status: 'Completed',
    completedAt: '2026-10-29T15:00:00Z',
    outcomeNotes: 'Joint meeting completed. Marcus Vance executed agreement. Deal signed and onboarding initiated.'
  },
  {
    id: 'ast_4',
    dealershipId: 'deal_7',
    dealershipName: 'Nashua Jeep Center',
    originRepId: 'u_kelley',
    originRepName: 'Kelley Koliopulos',
    assignedManagerId: 'u_jason',
    assignedManagerName: 'Jason Scott',
    assistType: 'join_call',
    proposedDate: '2026-11-03',
    proposedTime: '14:30',
    requestDate: '2026-11-02T09:30:00Z',
    decisionMakerName: 'Thomas Anderson',
    decisionMakerTitle: 'General Manager',
    objections: 'Comparing Certified Limited Warranty terms against current administrator.',
    productsOfInterest: ['Certified Limited Warranty'],
    aiBriefing: 'GM is receptive to our fast claims turnaround. Needs reassurance regarding dealer reserve retro pooling.',
    status: 'Pending'
  }
];

export const INITIAL_INCENTIVES: IntroductionIncentive[] = [
  {
    id: 'inc_1',
    dealershipId: 'deal_2',
    dealershipName: 'Quincy Toyota Center',
    originRepId: 'u_kelley',
    originRepName: 'Kelley Koliopulos',
    closedByUserId: 'u_kelley',
    closedByUserName: 'Kelley Koliopulos',
    signedByUserId: 'u_kelley',
    signedByUserName: 'Kelley Koliopulos',
    assistInvolved: true,
    assistManagerId: 'u_jason',
    assistManagerName: 'Jason Scott',
    triggerEvent: 'Introduction Qualified & Discovery Completed',
    state: 'Verified',
    amount: 300.00,
    calculatedRule: 'Standard introduction bounty (85 used cars)',
    financeComments: 'Meeting verified with Dealer Principal Alice Jones. Rep conducted thorough scouting.',
    verifiedAt: '2026-10-23T10:00:00Z',
    reviewDate: '2026-10-23',
    reviewedBy: 'Donna Clark',
    trail: [
      { step: 'Claimed from Pool', date: '2026-10-12', actor: 'Kelley Koliopulos', details: 'Claimed within 60-mile radius (14.2 miles from home)' },
      { step: 'Scouting Visit (10 AM-4 PM)', date: '2026-10-15', actor: 'Kelley Koliopulos', details: 'Met GSM, counted 85 pre-owned vehicles on lot', isGoodWindow: true },
      { step: 'Product Interest Recorded', date: '2026-10-15', actor: 'Kelley Koliopulos', details: 'Vehicle Service Contract (High), Keyfetch (Medium)' },
      { step: 'Manager Assist Requested', date: '2026-10-20', actor: 'Kelley Koliopulos', details: 'Requested Jason Scott for Terms Review with Dealer Principal' },
      { step: 'Manager Assist Completed', date: '2026-10-23', actor: 'Jason Scott & Kelley Koliopulos', details: 'Joint Google Meet. Claims SLA confirmed' }
    ]
  },
  {
    id: 'inc_2',
    dealershipId: 'deal_1',
    dealershipName: 'Holman Ford of Boston',
    originRepId: 'u_kelley',
    originRepName: 'Kelley Koliopulos',
    closedByUserId: 'u_kelley',
    closedByUserName: 'Kelley Koliopulos',
    signedByUserId: 'u_kelley',
    signedByUserName: 'Kelley Koliopulos',
    assistInvolved: false, // SOLO DEAL! No assist needed
    triggerEvent: 'Deal Signed & Products Contracted',
    state: 'Approved',
    amount: 450.00,
    calculatedRule: 'Solo Deal Close: Keyfetch + VSC Signed',
    financeComments: 'Solo introduction and close by Kelley. Deal signed and active.',
    verifiedAt: '2026-10-25T14:00:00Z',
    approvedAt: '2026-10-26T09:30:00Z',
    reviewDate: '2026-10-26',
    reviewedBy: 'Donna Clark',
    trail: [
      { step: 'Claimed from Pool', date: '2026-08-01', actor: 'Kelley Koliopulos', details: 'Assigned during territory launch' },
      { step: 'Initial Discovery Visit', date: '2026-08-05', actor: 'Kelley Koliopulos', details: 'In-person meeting with General Manager Bob Smith', isGoodWindow: true },
      { step: 'Product Interest Logged', date: '2026-08-05', actor: 'Kelley Koliopulos', details: 'Keyfetch (High), Vehicle Service Contract (High)' },
      { step: 'Contract Signed (Solo Close)', date: '2026-08-15', actor: 'Kelley Koliopulos', details: 'Signed by GM Don Ferguson without manager assist' },
      { step: 'Onboarding Completed', date: '2026-08-20', actor: 'Kelley Koliopulos', details: 'Initial Keyfetch hardware delivered and operational' }
    ]
  },
  {
    id: 'inc_3',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    originRepId: 'u_toddb',
    originRepName: 'Todd Bilius',
    closedByUserId: 'u_toddb',
    closedByUserName: 'Todd Bilius',
    signedByUserId: 'u_toddb',
    signedByUserName: 'Todd Bilius',
    assistInvolved: true,
    assistManagerId: 'u_jose',
    assistManagerName: 'Jose Matos',
    triggerEvent: 'Contract Signed & Onboarding Active',
    state: 'Paid',
    amount: 525.00,
    calculatedRule: 'High Volume Tier (175 cars) • Multi-Product: VSC + Ceramic Pro',
    financeComments: 'Direct deposit executed via payroll ref #ACH-889102.',
    verifiedAt: '2026-10-30T11:00:00Z',
    approvedAt: '2026-10-30T16:00:00Z',
    paidAt: '2026-11-01T08:00:00Z',
    paymentReference: 'ACH-889102',
    reviewDate: '2026-10-30',
    reviewedBy: 'Donna Clark',
    trail: [
      { step: 'Assigned Source', date: '2026-10-18', actor: 'Todd Bilius', details: 'Assigned from Southeast regional expansion' },
      { step: 'Discovery Lot Visit', date: '2026-10-22', actor: 'Todd Bilius', details: 'Inspected 175-vehicle lot inside Golden Window', isGoodWindow: true },
      { step: 'Product Interest Logged', date: '2026-10-22', actor: 'Todd Bilius', details: 'VSC (High), Ceramic Pro (High)' },
      { step: 'Manager Assist Requested', date: '2026-10-28', actor: 'Todd Bilius', details: 'Requested Jose Matos for signing support with Marcus Vance' },
      { step: 'Joint Closing Completed', date: '2026-10-29', actor: 'Jose Matos & Todd Bilius', details: 'Agreement signed. Attribution locked to Todd Bilius' },
      { step: 'Payment Disbursed', date: '2026-11-01', actor: 'Donna Clark', details: 'ACH Reference: ACH-889102' }
    ]
  },
  {
    id: 'inc_4',
    dealershipId: 'deal_19',
    dealershipName: 'Midwest Heritage Ford of Schaumburg',
    originRepId: 'u_kevin',
    originRepName: 'Kevin Houk',
    closedByUserId: 'u_kevin',
    closedByUserName: 'Kevin Houk',
    signedByUserId: 'u_kevin',
    signedByUserName: 'Kevin Houk',
    assistInvolved: true,
    assistManagerId: 'u_jason',
    assistManagerName: 'Jason Scott',
    triggerEvent: 'Introduction Qualified',
    state: 'Pending verification',
    amount: 400.00,
    calculatedRule: 'Dealer Group Multi-Store Account',
    financeComments: 'Awaiting Robert Klein sign-off.',
    trail: [
      { step: 'Claimed from Pool', date: '2026-10-10', actor: 'Kevin Houk', details: 'Identified 6-store dealer group lead' },
      { step: 'On-site Lot Assessment', date: '2026-10-16', actor: 'Kevin Houk', details: 'Met with Managing Partner Robert Klein', isGoodWindow: true },
      { step: 'Product Interest Logged', date: '2026-10-16', actor: 'Kevin Houk', details: 'Keyfetch (High), GPS + AI Plug-in (High)' },
      { step: 'Manager Assist Requested', date: '2026-10-22', actor: 'Kevin Houk', details: 'Requested Jason Scott for multi-store rollout strategy' }
    ]
  }
];

export const INITIAL_GAME_RULES: GameRule[] = [
  { id: 'gr_claim', actionType: 'claim_prospect', label: 'Claim a Prospect from Pool', category: 'Scouting', basePoints: 15, dailyCap: 60, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_profile', actionType: 'complete_profile', label: 'Complete Dealership Profile', category: 'Scouting', basePoints: 20, dailyCap: 80, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_interest', actionType: 'record_product_interest', label: 'Record Product Interest (Scouting)', category: 'Scouting', basePoints: 20, dailyCap: 100, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_visit_good', actionType: 'visit_good_window', label: 'Field Visit (10 AM–4 PM Golden Window)', category: 'Visits', basePoints: 40, dailyCap: 240, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_visit_bad', actionType: 'visit_bad_window', label: 'Field Visit (Outside Window)', category: 'Visits', basePoints: 15, dailyCap: 60, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_call', actionType: 'phone_call', label: 'Completed Quality Phone Call', category: 'Communication', basePoints: 10, dailyCap: 100, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead', 'manager'] },
  { id: 'gr_email', actionType: 'email_outreach', label: 'Targeted Prospect Email', category: 'Communication', basePoints: 5, dailyCap: 50, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_meet', actionType: 'google_meet', label: 'Google Meet Video Demo', category: 'Communication', basePoints: 30, dailyCap: 120, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead', 'manager'] },
  { id: 'gr_followup', actionType: 'on_time_followup', label: 'On-Time Follow-up Completed', category: 'Communication', basePoints: 15, dailyCap: 60, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_assist_req', actionType: 'request_assist', label: 'Request Manager Assist with Brief', category: 'Assists', basePoints: 25, dailyCap: 75, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_assist_att', actionType: 'attend_assist', label: 'Manager Accept & Attend Assist', category: 'Assists', basePoints: 35, dailyCap: 140, enabled: true, applicableRoles: ['manager', 'owner'] },
  { id: 'gr_signed_prod', actionType: 'product_signed', label: 'Per Product Signed at Sign-up', category: 'Closing', basePoints: 50, dailyCap: 300, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_deal_won', actionType: 'deal_won', label: 'Deal Won / Client Signed', category: 'Closing', basePoints: 100, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead', 'manager'] },
  { id: 'gr_upsell_won', actionType: 'upsell_won', label: 'Upsell Won on Active Client', category: 'Upselling', basePoints: 75, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead', 'manager'] },
  { id: 'gr_topup', actionType: 'keyfetch_topup', label: 'Keyfetch Top-up Logged', category: 'Servicing', basePoints: 30, dailyCap: 150, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] },
  { id: 'gr_priority', actionType: 'complete_priority', label: 'Complete Manager Priority On-Time', category: 'Priorities', basePoints: 50, dailyCap: 150, enabled: true, applicableRoles: ['new_rep', 'veteran_rep', 'team_lead'] }
];

export const INITIAL_PRODUCT_BONUSES: ProductBonus[] = [
  {
    id: 'pb_1',
    productId: 'prod_10',
    productName: 'Ceramic Pro',
    bonusPoints: 150,
    actionTypes: ['upsell_won', 'signed'],
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    targetType: 'all',
    isActive: true
  },
  {
    id: 'pb_2',
    productId: 'prod_4',
    productName: 'GAP',
    bonusPoints: 0,
    multiplier: 2, // 2x
    actionTypes: ['signed'],
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    targetType: 'all',
    isActive: true
  },
  {
    id: 'pb_3',
    productId: 'prod_9',
    productName: 'EV Solutions',
    bonusPoints: 50,
    actionTypes: ['interest_recorded'],
    startDate: '2026-10-15',
    endDate: '2026-11-30',
    targetType: 'region',
    targetValue: 'Texas / South Central',
    isActive: true
  }
];

export const INITIAL_MANAGER_PRIORITIES: ManagerPriority[] = [
  {
    id: 'mp_1',
    managerId: 'u_jason',
    managerName: 'Jason Scott',
    targetType: 'rep',
    targetId: 'u_kelley',
    title: 'Drop in on Worcester Subaru Center before 2 PM',
    reason: 'GSM Tom Clark specifically asked for sample contract terms today. Huge expansion opportunity.',
    priorityLevel: 'Urgent',
    dueDate: '2026-11-02',
    linkedDealershipId: 'deal_6',
    linkedDealershipName: 'Worcester Subaru Center',
    linkedProductId: 'prod_1',
    linkedProductName: 'Vehicle Service Contract (Extended Warranty)',
    bonusPoints: 50,
    status: 'scheduled',
    createdAt: '2026-11-02T08:00:00Z'
  },
  {
    id: 'mp_2',
    managerId: 'u_jason',
    managerName: 'Jason Scott',
    targetType: 'rep',
    targetId: 'u_kevin',
    title: 'Follow-up on Heritage Ford multi-store rollout',
    reason: 'Robert Klein requested confirmation on F&I training dates.',
    priorityLevel: 'High',
    dueDate: '2026-11-03',
    linkedDealershipId: 'deal_19',
    linkedDealershipName: 'Midwest Heritage Ford of Schaumburg',
    bonusPoints: 40,
    status: 'accepted',
    createdAt: '2026-11-01T10:00:00Z'
  },
  {
    id: 'mp_3',
    managerId: 'u_jose',
    managerName: 'Jose Matos',
    targetType: 'region',
    targetId: 'Texas / South Central',
    title: 'Pitch Ceramic Pro to top 5 pre-owned lots',
    reason: 'New launch bonus is active (+150 pts per win). Dealers are looking for high-margin add-ons.',
    priorityLevel: 'Normal',
    dueDate: '2026-11-06',
    linkedProductId: 'prod_10',
    linkedProductName: 'Ceramic Pro',
    bonusPoints: 60,
    status: 'pending',
    createdAt: '2026-11-01T09:00:00Z'
  }
];

export const INITIAL_POINTS_LEDGER: PointsLedgerEntry[] = [
  { id: 'ple_1', userId: 'u_kelley', dealershipId: 'deal_6', dealershipName: 'Worcester Subaru Center', actionType: 'visit_good_window', description: 'Field visit completed in 10 AM-4 PM Golden Window', pointsAwarded: 40, ruleVersion: 'v2.0', timestamp: '2026-11-02T11:15:00Z' },
  { id: 'ple_2', userId: 'u_kelley', dealershipId: 'deal_6', dealershipName: 'Worcester Subaru Center', actionType: 'record_product_interest', description: 'Product interest recorded (VSC & Keyfetch)', pointsAwarded: 20, ruleVersion: 'v2.0', timestamp: '2026-11-02T11:20:00Z' },
  { id: 'ple_3', userId: 'u_kelley', dealershipId: 'deal_1', dealershipName: 'Holman Ford of Boston', actionType: 'keyfetch_topup', description: 'Logged Keyfetch top-up (300 units)', pointsAwarded: 30, ruleVersion: 'v2.0', timestamp: '2026-10-28T15:00:00Z' },
  { id: 'ple_4', userId: 'u_kelley', dealershipId: 'deal_2', dealershipName: 'Quincy Toyota Center', actionType: 'request_assist', description: 'Requested manager assist with complete brief', pointsAwarded: 25, ruleVersion: 'v2.0', timestamp: '2026-10-20T15:00:00Z' },
  { id: 'ple_5', userId: 'u_kevin', dealershipId: 'deal_17', dealershipName: 'Highland Park Lexus', actionType: 'deal_won', description: 'Won deal & signed contract', pointsAwarded: 100, ruleVersion: 'v2.0', timestamp: '2026-10-25T14:00:00Z' },
  { id: 'ple_6', userId: 'u_kevin', dealershipId: 'deal_17', dealershipName: 'Highland Park Lexus', actionType: 'product_signed', description: 'Ceramic Pro signed (+150 launch bonus)', pointsAwarded: 200, ruleVersion: 'v2.0', timestamp: '2026-10-25T14:05:00Z' },
  { id: 'ple_7', userId: 'u_toddb', dealershipId: 'deal_34', dealershipName: 'ALM Hyundai Supercenter', actionType: 'deal_won', description: 'Won deal with manager assist', pointsAwarded: 100, ruleVersion: 'v2.0', timestamp: '2026-10-29T15:00:00Z' },
  { id: 'ple_8', userId: 'u_toddb', dealershipId: 'deal_32', dealershipName: 'Nalley Honda of Rome', actionType: 'keyfetch_topup', description: 'Logged Keyfetch top-up (350 units)', pointsAwarded: 30, ruleVersion: 'v2.0', timestamp: '2026-10-02T14:30:00Z' },
  { id: 'ple_9', userId: 'u_carlos', dealershipId: 'deal_61', dealershipName: 'Park Cities Ford Dallas', actionType: 'claim_prospect', description: 'Claimed prospect from pool', pointsAwarded: 15, ruleVersion: 'v2.0', timestamp: '2026-11-01T09:30:00Z' },
  { id: 'ple_10', userId: 'u_carlos', dealershipId: 'deal_61', dealershipName: 'Park Cities Ford Dallas', actionType: 'visit_good_window', description: 'Discovery lot visit in Golden Window', pointsAwarded: 40, ruleVersion: 'v2.0', timestamp: '2026-11-01T14:00:00Z' }
];

export const INITIAL_GAMIFICATION: Record<string, GamificationProfile> = {
  u_kelley: {
    userId: 'u_kelley',
    points: 1420,
    pointsToday: 60,
    dailyTarget: 100,
    streakDays: 8,
    bestStreak: 12,
    level: 4,
    levelTitle: 'Closer',
    pointsToNextLevel: 580,
    levelProgressPercent: 71,
    weeklyRank: 2,
    monthlyRank: 2,
    activeMultiplier: { label: '🔥 2x GAP Active', multiplier: 2 },
    badges: [
      { id: 'b_scout', name: 'Territory Hawk', category: 'Scouting', description: 'Scouted 25+ qualified dealerships', icon: '🦅', currentProgress: 28, targetProgress: 25, unlocked: true, earnedDate: '2026-09-15' },
      { id: 'b_goodtime', name: 'Golden Window Master', category: 'Visits', description: '10 consecutive visits within 10 AM-4 PM', icon: '⏱️', currentProgress: 10, targetProgress: 10, unlocked: true, earnedDate: '2026-10-01' },
      { id: 'b_ceramic', name: 'Ceramic Pro Pioneer', category: 'Upselling', description: 'First 3 Ceramic Pro upsells closed', icon: '✨', currentProgress: 1, targetProgress: 3, unlocked: false }
    ],
    personalBests: { maxVisitsDay: 6, maxWinsMonth: 4, longestStreak: 12 }
  },
  u_kevin: {
    userId: 'u_kevin',
    points: 1850,
    pointsToday: 95,
    dailyTarget: 100,
    streakDays: 14,
    bestStreak: 18,
    level: 5,
    levelTitle: 'Territory Boss',
    pointsToNextLevel: 150,
    levelProgressPercent: 92,
    weeklyRank: 1,
    monthlyRank: 1,
    activeMultiplier: { label: '🔥 +150 Ceramic Pro', multiplier: 1.5 },
    badges: [
      { id: 'b_closer', name: 'The Closer', category: 'Closing', description: 'Converted 5 assists into won contracts', icon: '🎯', currentProgress: 6, targetProgress: 5, unlocked: true, earnedDate: '2026-08-20' },
      { id: 'b_group', name: 'Empire Builder', category: 'Teamwork', description: 'Signed a complete multi-rooftop dealer group', icon: '🏛️', currentProgress: 2, targetProgress: 2, unlocked: true, earnedDate: '2026-10-18' }
    ],
    personalBests: { maxVisitsDay: 5, maxWinsMonth: 7, longestStreak: 18 }
  },
  u_toddb: {
    userId: 'u_toddb',
    points: 1390,
    pointsToday: 40,
    dailyTarget: 100,
    streakDays: 6,
    bestStreak: 10,
    level: 4,
    levelTitle: 'Closer',
    pointsToNextLevel: 610,
    levelProgressPercent: 68,
    weeklyRank: 3,
    monthlyRank: 3,
    badges: [
      { id: 'b_restock', name: 'Key Master', category: 'Servicing', description: 'Topped up 1,000+ Keyfetch units on active clients', icon: '🔑', currentProgress: 1200, targetProgress: 1000, unlocked: true, earnedDate: '2026-09-30' },
      { id: 'b_retention', name: 'Shield of Trust', category: 'Relationships', description: 'Maintained 90%+ client health score across portfolio', icon: '🛡️', currentProgress: 94, targetProgress: 90, unlocked: true, earnedDate: '2026-10-15' }
    ],
    personalBests: { maxVisitsDay: 5, maxWinsMonth: 5, longestStreak: 10 }
  },
  u_toddk: {
    userId: 'u_toddk',
    points: 980,
    pointsToday: 20,
    dailyTarget: 100,
    streakDays: 2,
    bestStreak: 5,
    level: 3,
    levelTitle: 'Lot Legend',
    pointsToNextLevel: 220,
    levelProgressPercent: 81,
    weeklyRank: 4,
    monthlyRank: 4,
    badges: [
      { id: 'b_nightowl', name: 'Road Warrior', category: 'Visits', description: 'Completed 50 in-person field stops', icon: '🚗', currentProgress: 52, targetProgress: 50, unlocked: true, earnedDate: '2026-09-10' }
    ],
    personalBests: { maxVisitsDay: 4, maxWinsMonth: 3, longestStreak: 5 }
  },
  u_carlos: {
    userId: 'u_carlos',
    points: 620,
    pointsToday: 55,
    dailyTarget: 80,
    streakDays: 4,
    bestStreak: 4,
    level: 2,
    levelTitle: 'Road Warrior',
    pointsToNextLevel: 180,
    levelProgressPercent: 62,
    weeklyRank: 5,
    monthlyRank: 5,
    badges: [
      { id: 'b_rookie', name: 'First Strike', category: 'Scouting', description: 'Completed first successful discovery visit & CRM log', icon: '⭐', currentProgress: 1, targetProgress: 1, unlocked: true, earnedDate: '2026-09-02' }
    ],
    personalBests: { maxVisitsDay: 3, maxWinsMonth: 2, longestStreak: 4 }
  }
};

interface DealershipTemplate {
  name: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  type: 'Standalone' | 'Dealer Group';
  groupId?: string;
  rooftopCount: number;
  franchiseType: 'Franchise' | 'Independent';
  brands: string[];
  cars: number;
  fi: string;
  stage: Dealership['stage'];
  heat: 'Cold' | 'Warm' | 'Hot';
  source: 'Pool' | 'Assigned' | 'Manual Search';
  repId: string | null;
  originRepId: string | null;
  hasAssist?: boolean;
  assistId?: string;
  daysAgoTouch?: number;
  daysAgoCreated: number;
}

function buildInitialDealerships(): Dealership[] {
  const templates: DealershipTemplate[] = [];

  // 1. Northeast (around Kelley Koliopulos 02108 Boston MA & Jason NJ)
  const neCities = [
    { city: 'Boston', state: 'MA', zip: '02115', lat: 42.342, lng: -71.101 },
    { city: 'Quincy', state: 'MA', zip: '02169', lat: 42.252, lng: -71.002 },
    { city: 'Waltham', state: 'MA', zip: '02451', lat: 42.376, lng: -71.235 },
    { city: 'Framingham', state: 'MA', zip: '01701', lat: 42.279, lng: -71.416 },
    { city: 'Norwood', state: 'MA', zip: '02062', lat: 42.195, lng: -71.196 },
    { city: 'Worcester', state: 'MA', zip: '01608', lat: 42.262, lng: -71.802 },
    { city: 'Nashua', state: 'NH', zip: '03060', lat: 42.765, lng: -71.467 },
    { city: 'Providence', state: 'RI', zip: '02903', lat: 41.824, lng: -71.412 },
    { city: 'Peabody', state: 'MA', zip: '01960', lat: 42.527, lng: -70.928 },
    { city: 'Braintree', state: 'MA', zip: '02184', lat: 42.204, lng: -71.002 },
    { city: 'Hartford', state: 'CT', zip: '06103', lat: 41.765, lng: -72.673 },
    { city: 'Newark', state: 'NJ', zip: '07102', lat: 40.735, lng: -74.172 },
    { city: 'Cherry Hill', state: 'NJ', zip: '08002', lat: 39.934, lng: -75.029 },
    { city: 'Mt Laurel', state: 'NJ', zip: '08054', lat: 39.934, lng: -74.891 },
    { city: 'Paramus', state: 'NJ', zip: '07652', lat: 40.944, lng: -74.072 },
    { city: 'Albany', state: 'NY', zip: '12207', lat: 42.652, lng: -73.756 }
  ];

  const neBrands = ['Ford', 'Toyota', 'Honda', 'Subaru', 'Chevrolet', 'Hyundai', 'Jeep', 'BMW'];

  neCities.forEach((c, idx) => {
    const isGroup = idx % 3 === 0;
    const cars = 35 + (idx * 17) % 220;
    const brand = neBrands[idx % neBrands.length];
    const isClient = idx < 5;
    const isHot = idx >= 5 && idx < 8;
    const hasAssist = idx === 1 || idx === 6;
    const isPool = idx >= 14;

    templates.push({
      name: isGroup ? `Holman ${brand} of ${c.city}` : `${c.city} ${brand} Center`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      lat: c.lat,
      lng: c.lng,
      type: isGroup ? 'Dealer Group' : 'Standalone',
      groupId: isGroup ? 'grp_holman' : undefined,
      rooftopCount: isGroup ? 11 : 1,
      franchiseType: idx % 4 === 1 ? 'Independent' : 'Franchise',
      brands: [brand],
      cars: cars,
      fi: FI_SYSTEMS_LIST[idx % FI_SYSTEMS_LIST.length],
      stage: isClient ? 'Client' : isHot ? 'HOT' : hasAssist ? 'Negotiation' : isPool ? 'Pool' : idx % 2 === 0 ? 'In Progress' : 'Visited',
      heat: isHot ? 'Hot' : isClient ? 'Warm' : idx % 3 === 0 ? 'Cold' : 'Warm',
      source: isPool ? 'Pool' : idx % 5 === 0 ? 'Assigned' : 'Manual Search',
      repId: isPool ? null : 'u_kelley',
      originRepId: isPool ? null : 'u_kelley',
      hasAssist: hasAssist,
      assistId: idx === 1 ? 'ast_1' : idx === 6 ? 'ast_4' : undefined,
      daysAgoTouch: isPool ? undefined : (idx * 3) % 40,
      daysAgoCreated: 40 + idx * 5
    });
  });

  // 2. Midwest (around Kevin Houk 60601 Chicago IL & Jason)
  const mwCities = [
    { city: 'Chicago', state: 'IL', zip: '60616', lat: 41.844, lng: -87.632 },
    { city: 'Naperville', state: 'IL', zip: '60540', lat: 41.750, lng: -88.153 },
    { city: 'Schaumburg', state: 'IL', zip: '60173', lat: 42.033, lng: -88.083 },
    { city: 'Orland Park', state: 'IL', zip: '60462', lat: 41.597, lng: -87.854 },
    { city: 'Aurora', state: 'IL', zip: '60505', lat: 41.760, lng: -88.320 },
    { city: 'Elgin', state: 'IL', zip: '60120', lat: 42.035, lng: -88.282 },
    { city: 'Waukegan', state: 'IL', zip: '60085', lat: 42.363, lng: -87.844 },
    { city: 'Joliet', state: 'IL', zip: '60435', lat: 41.525, lng: -88.081 },
    { city: 'Gary', state: 'IN', zip: '46402', lat: 41.593, lng: -87.346 },
    { city: 'Kenosha', state: 'WI', zip: '53140', lat: 42.584, lng: -87.821 },
    { city: 'Milwaukee', state: 'WI', zip: '53202', lat: 43.038, lng: -87.906 },
    { city: 'Rockford', state: 'IL', zip: '61101', lat: 42.271, lng: -89.093 },
    { city: 'South Bend', state: 'IN', zip: '46601', lat: 41.676, lng: -86.251 },
    { city: 'Detroit', state: 'MI', zip: '48226', lat: 42.331, lng: -83.045 },
    { city: 'Grand Rapids', state: 'MI', zip: '49503', lat: 42.963, lng: -85.668 }
  ];

  mwCities.forEach((c, idx) => {
    const isGroup = idx % 2 === 0;
    const cars = 50 + (idx * 23) % 250;
    const brand = neBrands[(idx + 2) % neBrands.length];
    const isClient = idx < 6;
    const isHot = idx === 6 || idx === 7;
    const hasAssist = idx === 2; // Schaumburg
    const isPool = idx >= 13;

    templates.push({
      name: isGroup ? `Midwest Heritage ${brand} of ${c.city}` : `Great Lakes ${brand} ${c.city}`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      lat: c.lat,
      lng: c.lng,
      type: isGroup ? 'Dealer Group' : 'Standalone',
      groupId: isGroup ? 'grp_heritage' : undefined,
      rooftopCount: isGroup ? 6 : 1,
      franchiseType: 'Franchise',
      brands: [brand],
      cars: cars,
      fi: FI_SYSTEMS_LIST[idx % FI_SYSTEMS_LIST.length],
      stage: isClient ? 'Client' : isHot ? 'HOT' : hasAssist ? 'Negotiation' : isPool ? 'Pool' : 'Visited',
      heat: isHot ? 'Hot' : isClient ? 'Warm' : 'Warm',
      source: isPool ? 'Pool' : 'Manual Search',
      repId: isPool ? null : 'u_kevin',
      originRepId: isPool ? null : 'u_kevin',
      hasAssist: hasAssist,
      assistId: hasAssist ? 'ast_2' : undefined,
      daysAgoTouch: isPool ? undefined : (idx * 3) % 35,
      daysAgoCreated: 50 + idx * 4
    });
  });

  // 3. Southeast (around Todd Bilius 30301 Atlanta GA & Jose)
  const seCities = [
    { city: 'Atlanta', state: 'GA', zip: '30309', lat: 33.799, lng: -84.388 },
    { city: 'Marietta', state: 'GA', zip: '30060', lat: 33.952, lng: -84.549 },
    { city: 'Alpharetta', state: 'GA', zip: '30009', lat: 34.075, lng: -84.294 },
    { city: 'Duluth', state: 'GA', zip: '30096', lat: 34.002, lng: -84.144 },
    { city: 'Kennesaw', state: 'GA', zip: '30144', lat: 34.023, lng: -84.615 },
    { city: 'Roswell', state: 'GA', zip: '30075', lat: 34.023, lng: -84.361 },
    { city: 'Decatur', state: 'GA', zip: '30030', lat: 33.774, lng: -84.296 },
    { city: 'Macon', state: 'GA', zip: '31201', lat: 32.840, lng: -83.632 },
    { city: 'Athens', state: 'GA', zip: '30601', lat: 33.951, lng: -83.357 },
    { city: 'Rome', state: 'GA', zip: '30161', lat: 34.257, lng: -85.164 },
    { city: 'Columbus', state: 'GA', zip: '31901', lat: 32.460, lng: -84.987 },
    { city: 'Chattanooga', state: 'TN', zip: '37402', lat: 35.045, lng: -85.309 },
    { city: 'Greenville', state: 'SC', zip: '29601', lat: 34.852, lng: -82.394 },
    { city: 'Birmingham', state: 'AL', zip: '35203', lat: 33.518, lng: -86.810 },
    { city: 'Charlotte', state: 'NC', zip: '28202', lat: 35.227, lng: -80.843 }
  ];

  seCities.forEach((c, idx) => {
    const isGroup = idx % 2 === 0;
    const cars = 40 + (idx * 21) % 240;
    const brand = neBrands[(idx + 4) % neBrands.length];
    const isClient = idx < 5;
    const isHot = idx === 5 || idx === 6;
    const hasAssist = idx === 2; // Alpharetta
    const isPool = idx >= 12;

    templates.push({
      name: isGroup ? `ALM ${brand} Supercenter of ${c.city}` : `Peach State ${brand} ${c.city}`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      lat: c.lat,
      lng: c.lng,
      type: isGroup ? 'Dealer Group' : 'Standalone',
      groupId: isGroup ? 'grp_alm' : undefined,
      rooftopCount: isGroup ? 8 : 1,
      franchiseType: 'Franchise',
      brands: [brand],
      cars: cars,
      fi: FI_SYSTEMS_LIST[(idx + 1) % FI_SYSTEMS_LIST.length],
      stage: isClient ? 'Client' : isHot ? 'HOT' : hasAssist ? 'Contract' : isPool ? 'Pool' : 'Visited',
      heat: isHot ? 'Hot' : isClient ? 'Warm' : 'Warm',
      source: isPool ? 'Pool' : 'Manual Search',
      repId: isPool ? null : 'u_toddb',
      originRepId: isPool ? null : 'u_toddb',
      hasAssist: hasAssist,
      assistId: hasAssist ? 'ast_3' : undefined,
      daysAgoTouch: isPool ? undefined : (idx * 3) % 35,
      daysAgoCreated: 45 + idx * 4
    });
  });

  // 4. West (around Todd Kelly 90210 Beverly Hills CA & Michael)
  const westCities = [
    { city: 'Beverly Hills', state: 'CA', zip: '90211', lat: 34.067, lng: -118.389 },
    { city: 'Santa Monica', state: 'CA', zip: '90401', lat: 34.019, lng: -118.491 },
    { city: 'Culver City', state: 'CA', zip: '90230', lat: 34.021, lng: -118.396 },
    { city: 'Pasadena', state: 'CA', zip: '91101', lat: 34.147, lng: -118.144 },
    { city: 'Glendale', state: 'CA', zip: '91201', lat: 34.142, lng: -118.255 },
    { city: 'Long Beach', state: 'CA', zip: '90802', lat: 33.770, lng: -118.193 },
    { city: 'Torrance', state: 'CA', zip: '90501', lat: 33.835, lng: -118.340 },
    { city: 'Anaheim', state: 'CA', zip: '92801', lat: 33.836, lng: -117.914 },
    { city: 'Newport Beach', state: 'CA', zip: '92660', lat: 33.618, lng: -117.873 },
    { city: 'Irvine', state: 'CA', zip: '92618', lat: 33.684, lng: -117.826 },
    { city: 'Riverside', state: 'CA', zip: '92501', lat: 33.953, lng: -117.396 },
    { city: 'San Bernardino', state: 'CA', zip: '92401', lat: 34.108, lng: -117.289 },
    { city: 'Ventura', state: 'CA', zip: '93001', lat: 34.280, lng: -119.294 },
    { city: 'San Diego', state: 'CA', zip: '92101', lat: 32.715, lng: -117.161 },
    { city: 'Phoenix', state: 'AZ', zip: '85001', lat: 33.448, lng: -112.074 }
  ];

  westCities.forEach((c, idx) => {
    const isGroup = idx % 2 === 1;
    const cars = 60 + (idx * 27) % 300;
    const brand = neBrands[(idx + 1) % neBrands.length];
    const isClient = idx < 5;
    const isHot = idx === 5 || idx === 6;
    const isPool = idx >= 13;

    templates.push({
      name: isGroup ? `Baywatch ${brand} of ${c.city}` : `Pacific Coast ${brand} ${c.city}`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      lat: c.lat,
      lng: c.lng,
      type: isGroup ? 'Dealer Group' : 'Standalone',
      groupId: isGroup ? 'grp_baywatch' : undefined,
      rooftopCount: isGroup ? 12 : 1,
      franchiseType: 'Franchise',
      brands: [brand],
      cars: cars,
      fi: FI_SYSTEMS_LIST[idx % FI_SYSTEMS_LIST.length],
      stage: isClient ? 'Client' : isHot ? 'HOT' : isPool ? 'Pool' : 'Visited',
      heat: isHot ? 'Hot' : isClient ? 'Warm' : 'Warm',
      source: isPool ? 'Pool' : 'Manual Search',
      repId: isPool ? null : 'u_toddk',
      originRepId: isPool ? null : 'u_toddk',
      daysAgoTouch: isPool ? undefined : (idx * 3) % 30,
      daysAgoCreated: 45 + idx * 4
    });
  });

  // 5. Texas / South Central (around Carlos Martinez 75201 Dallas TX & Jose)
  const txCities = [
    { city: 'Dallas', state: 'TX', zip: '75207', lat: 32.788, lng: -96.815 },
    { city: 'Fort Worth', state: 'TX', zip: '76102', lat: 32.755, lng: -97.330 },
    { city: 'Arlington', state: 'TX', zip: '76010', lat: 32.735, lng: -97.108 },
    { city: 'Plano', state: 'TX', zip: '75024', lat: 33.019, lng: -96.698 },
    { city: 'Frisco', state: 'TX', zip: '75034', lat: 33.150, lng: -96.823 },
    { city: 'Irving', state: 'TX', zip: '75038', lat: 32.814, lng: -96.948 },
    { city: 'Carrollton', state: 'TX', zip: '75006', lat: 32.953, lng: -96.890 },
    { city: 'Grapevine', state: 'TX', zip: '76051', lat: 32.934, lng: -97.078 },
    { city: 'McKinney', state: 'TX', zip: '75069', lat: 33.197, lng: -96.615 },
    { city: 'Denton', state: 'TX', zip: '76201', lat: 33.214, lng: -97.133 },
    { city: 'Waco', state: 'TX', zip: '76701', lat: 31.549, lng: -97.146 },
    { city: 'Tyler', state: 'TX', zip: '75701', lat: 32.351, lng: -95.301 },
    { city: 'Austin', state: 'TX', zip: '78701', lat: 30.267, lng: -97.743 },
    { city: 'Houston', state: 'TX', zip: '77002', lat: 29.760, lng: -95.369 },
    { city: 'San Antonio', state: 'TX', zip: '78205', lat: 29.424, lng: -98.493 }
  ];

  txCities.forEach((c, idx) => {
    const isGroup = idx % 2 === 0;
    const cars = 55 + (idx * 29) % 270;
    const brand = neBrands[(idx + 3) % neBrands.length];
    const isClient = idx < 4;
    const isHot = idx === 4 || idx === 5;
    const isPool = idx >= 12;

    templates.push({
      name: isGroup ? `Lone Star ${brand} of ${c.city}` : `Big D ${brand} ${c.city}`,
      city: c.city,
      state: c.state,
      zip: c.zip,
      lat: c.lat,
      lng: c.lng,
      type: isGroup ? 'Dealer Group' : 'Standalone',
      groupId: isGroup ? 'grp_lonestar' : undefined,
      rooftopCount: isGroup ? 9 : 1,
      franchiseType: 'Franchise',
      brands: [brand],
      cars: cars,
      fi: FI_SYSTEMS_LIST[(idx + 3) % FI_SYSTEMS_LIST.length],
      stage: isClient ? 'Client' : isHot ? 'HOT' : isPool ? 'Pool' : idx % 2 === 0 ? 'Claimed' : 'Visit Planned',
      heat: isHot ? 'Hot' : isClient ? 'Warm' : 'Warm',
      source: isPool ? 'Pool' : idx % 3 === 0 ? 'Assigned' : 'Manual Search',
      repId: isPool ? null : 'u_carlos',
      originRepId: isPool ? null : 'u_carlos',
      daysAgoTouch: isPool ? undefined : (idx * 3) % 25,
      daysAgoCreated: 35 + idx * 3
    });
  });

  // A few dealerships in sign-up / onboarding stages per region, so every
  // My Plan tab (Prospects / Sign-up & Onboarding / Clients) has real data.
  const stageOverrides: Record<number, Dealership['stage']> = {
    8: 'Onboarding', 9: 'Signed', 24: 'Onboarding', 38: 'Onboarding',
    53: 'Won', 67: 'Onboarding', 68: 'Contract'
  };
  Object.entries(stageOverrides).forEach(([i, stage]) => {
    const t = templates[Number(i)];
    if (t && t.repId) { t.stage = stage; t.heat = 'Warm'; }
  });

  const now = new Date('2026-11-02T12:00:00Z').getTime();

  return templates.map((t, index) => {
    const id = `deal_${index + 1}`;
    const timeZone = getTimeZoneFromZip(t.zip);
    const createdDate = new Date(now - t.daysAgoCreated * 86400000).toISOString();
    const touchDate = t.daysAgoTouch ? new Date(now - t.daysAgoTouch * 86400000).toISOString() : null;
    const isClient = t.stage === 'Client';
    const hasSignedUp = isClient || t.stage === 'Onboarding' || t.stage === 'Signed';

    // Scouting product interests
    const productInterests = [
      {
        productId: 'prod_1',
        productName: 'Vehicle Service Contract (Extended Warranty)',
        interestLevel: (t.heat === 'Hot' ? 'High' : 'Medium') as 'Low' | 'Medium' | 'High',
        recordedDate: touchDate || createdDate,
        recordedByUserId: t.originRepId || 'u_kelley',
        recordedByUserName: USERS.find(u => u.id === (t.originRepId || 'u_kelley'))?.firstName || 'Kelley'
      },
      {
        productId: 'prod_3',
        productName: 'Keyfetch',
        interestLevel: 'High' as 'Low' | 'Medium' | 'High',
        recordedDate: touchDate || createdDate,
        recordedByUserId: t.originRepId || 'u_kelley',
        recordedByUserName: USERS.find(u => u.id === (t.originRepId || 'u_kelley'))?.firstName || 'Kelley'
      }
    ];

    // Signed products for client
    const signedProducts: string[] = [];
    if (hasSignedUp) {
      signedProducts.push('prod_3'); // Keyfetch
      if (index % 2 === 0) signedProducts.push('prod_1'); // VSC
      if (index % 4 === 0) signedProducts.push('prod_4'); // GAP
    }

    // Top-ups: only for Keyfetch clients
    const clientTopups = signedProducts.includes('prod_3') 
      ? INITIAL_TOPUPS.filter(tp => tp.dealershipId === id)
      : [];

    // Upsell mini-opportunities for clients on products they don't have
    const upsells = isClient ? [
      {
        id: `ups_${id}_1`,
        dealershipId: id,
        productId: 'prod_10',
        productName: 'Ceramic Pro',
        stage: (index % 3 === 0 ? 'Won' : index % 2 === 0 ? 'Pitched' : 'Identified') as any,
        ownerId: t.originRepId || 'u_kelley',
        ownerName: USERS.find(u => u.id === (t.originRepId || 'u_kelley'))?.firstName || 'Kelley',
        nextStep: 'Present sample application test kit',
        createdAt: new Date(now - 14 * 86400000).toISOString(),
        wonDate: index % 3 === 0 ? new Date(now - 5 * 86400000).toISOString() : undefined,
        wonByUserId: index % 3 === 0 ? t.originRepId || 'u_kelley' : undefined
      }
    ] : [];

    // Relationship temperature
    const baseTemp = isClient ? 85 : t.heat === 'Hot' ? 78 : t.stage === 'Visited' ? 62 : 45;
    const tempScore = Math.min(98, Math.max(25, baseTemp + (index % 15) - 7));
    const temperature: RelationshipTemperature = {
      score: tempScore,
      trend: tempScore > 75 ? 'rising' : tempScore > 50 ? 'steady' : 'cooling',
      sparkline: [tempScore - 12, tempScore - 8, tempScore - 5, tempScore - 2, tempScore],
      intentPhrases: isClient || t.heat === 'Hot' ? ['Requested contract draft', 'Interested in claims turnaround'] : ['Checking budget timeline'],
      hesitationPhrases: tempScore < 60 ? ['Has 18 months left on current contract', 'Concerned about onboarding time'] : [],
      ghostingRisk: tempScore < 50 ? 'high' : tempScore < 70 ? 'medium' : 'low'
    };

    // Inventory history (cars on lot)
    const history = [
      {
        date: new Date(now - 60 * 86400000).toISOString().split('T')[0],
        count: Math.max(20, t.cars - 15),
        monthlySales: Math.round(t.cars * 0.45),
        recordedBy: t.repId || 'u_jason'
      },
      {
        date: new Date(now - 15 * 86400000).toISOString().split('T')[0],
        count: t.cars,
        monthlySales: Math.round(t.cars * 0.52),
        recordedBy: t.repId || 'u_jason'
      }
    ];

    return {
      id,
      dealershipName: t.name,
      groupId: t.groupId || null,
      groupName: t.groupId ? DEALER_GROUPS.find(g => g.id === t.groupId)?.name : undefined,
      dealershipType: t.type,
      rooftopCount: t.rooftopCount,
      franchiseType: t.franchiseType,
      franchiseBrands: t.brands,
      phone: `(${t.zip.substring(0, 3)}) 555-${String(1000 + index).padStart(4, '0')}`,
      address: `${100 + index * 12} Auto Mall Way`,
      city: t.city,
      state: t.state,
      zipCode: t.zip,
      coordinates: { lat: t.lat, lng: t.lng },
      timeZone: timeZone,
      usedCarsOnLot: t.cars,
      monthlyUsedSales: Math.round(t.cars * 0.5),
      inventoryHistory: history,
      fiSystem: t.fi,
      fiSource: 'Scout Visit',
      fiCapturedDate: touchDate || createdDate,
      stage: t.stage,
      heatLevel: t.heat,
      source: t.source,
      assignedRepId: t.repId, // Rep keeps ownership!
      originRepId: t.originRepId,
      hasActiveAssist: t.hasAssist || false,
      activeAssistId: t.assistId,
      claimedAt: t.source !== 'Pool' ? createdDate : null,
      lastTouchpointDate: touchDate,
      lostReason: t.stage === 'Lost' ? 'Competitor lock-in on 3-year agreement' : undefined,
      productInterests,
      signedProducts,
      topups: clientTopups,
      upsells,
      relationshipTemperature: temperature,
      clientHealthScore: isClient ? (t.daysAgoTouch && t.daysAgoTouch > 25 ? 68 : 94) : undefined,
      createdAt: createdDate,
      updatedAt: touchDate || createdDate
    };
  });
}

export const INITIAL_DEALERSHIPS = buildInitialDealerships();

export const INITIAL_CONTACTS: Contact[] = INITIAL_DEALERSHIPS.slice(0, 60).map((d, i) => {
  const titles = [
    'Dealer Principal / Owner',
    'General Manager (GM)',
    'General Sales Manager (GSM)',
    'F&I Director / Finance Director'
  ];
  const firstNames = ['David', 'Sarah', 'Marcus', 'Robert', 'Elena', 'James', 'Rachel', 'Thomas', 'Brian', 'Jennifer'];
  const lastNames = ['Miller', 'Vance', 'Klein', 'Rostova', 'Sterling', 'Thompson', 'Anderson', 'Hayes', 'Sullivan', 'Foster'];
  const fn = firstNames[i % firstNames.length];
  const ln = lastNames[(i + 3) % lastNames.length];

  return {
    id: `cont_${d.id}_1`,
    dealershipId: d.id,
    firstName: fn,
    lastName: ln,
    jobTitle: titles[i % titles.length],
    phone: d.phone,
    email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${d.dealershipName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    isDecisionMaker: true,
    notes: 'Primary decision-maker for lot accessories and reinsurance structuring.'
  };
});

export const INITIAL_ACTIVITIES: Activity[] = [
  {
    id: 'act_today_1',
    dealershipId: 'deal_6',
    dealershipName: 'Worcester Subaru Center',
    userId: 'u_kelley',
    userName: 'Kelley Koliopulos',
    activityType: 'In-Person Visit',
    communicationType: 'In-Person',
    status: 'pending',
    plannedDate: '2026-11-02',
    plannedTime: '10:30',
    isGoodWindow: true,
    notes: 'Q4 VSC program pitch with GSM Tom Clark.',
    productsDiscussed: ['Vehicle Service Contract (Extended Warranty)', 'Keyfetch'],
    interestLevel: 'High',
    isLocked: true // Pinned by rep
  },
  {
    id: 'act_today_2',
    dealershipId: 'deal_8',
    dealershipName: 'Peabody BMW Center',
    userId: 'u_kelley',
    userName: 'Kelley Koliopulos',
    activityType: 'In-Person Visit',
    communicationType: 'In-Person',
    status: 'pending',
    plannedDate: '2026-11-02',
    plannedTime: '13:15',
    isGoodWindow: true,
    notes: 'Walk-in lot review and key tag restocking count.',
    productsDiscussed: ['Keyfetch'],
    interestLevel: 'High'
  },
  {
    id: 'act_today_3',
    dealershipId: 'deal_7',
    dealershipName: 'Nashua Jeep Center',
    userId: 'u_kelley',
    userName: 'Kelley Koliopulos',
    activityType: 'In-Person Visit',
    communicationType: 'In-Person',
    status: 'pending',
    plannedDate: '2026-11-02',
    plannedTime: '15:00',
    isGoodWindow: true,
    notes: 'Follow-up on proposal with General Manager Thomas Anderson.',
    productsDiscussed: ['Certified Limited Warranty'],
    interestLevel: 'Medium'
  },
  {
    id: 'act_past_1',
    dealershipId: 'deal_1',
    dealershipName: 'Holman Ford of Boston',
    userId: 'u_kelley',
    userName: 'Kelley Koliopulos',
    activityType: 'In-Person Visit',
    communicationType: 'In-Person',
    status: 'completed',
    completedAt: '2026-10-28T14:30:00Z',
    isGoodWindow: true,
    notes: 'Met GM Bob Smith. Reviewed Keyfetch fob durability. Placed 300 unit re-order. Discussed expanding to Ceramic Pro next month.',
    productsDiscussed: ['Keyfetch', 'Ceramic Pro'],
    interestLevel: 'High',
    nextAction: 'Email Ceramic Pro proposal and test kit',
    nextActionDate: '2026-11-04'
  },
  {
    id: 'act_badtime_1',
    dealershipId: 'deal_49',
    dealershipName: 'Pacific Coast Ford Beverly Hills',
    userId: 'u_toddk',
    userName: 'Todd Kelly',
    activityType: 'In-Person Visit',
    communicationType: 'In-Person',
    status: 'completed',
    completedAt: '2026-10-27T17:45:00Z',
    isGoodWindow: false,
    notes: 'Late evening drop-in after closing. Spoke with night lot manager.',
    productsDiscussed: ['Keyfetch'],
    interestLevel: 'Low'
  }
];

export const INITIAL_WORKSPACE_ITEMS: WorkspaceItem[] = [
  {
    id: 'ws_1',
    service: 'Gmail',
    dealershipId: 'deal_1',
    dealershipName: 'Holman Ford of Boston',
    userId: 'u_kelley',
    date: '2026-11-01T14:22:00Z',
    subjectOrTitle: 'RE: Ceramic Pro and VSC collateral shipment schedule',
    summary: 'Don Ferguson confirmed receipt of training dates and requested shipping tracking numbers for display hardware.',
    deepLink: 'https://mail.google.com/mail/u/0/#inbox/18b2c4e',
    actionItems: ['Ship display hardware to Mt. Laurel by Friday'],
    isMatched: true
  },
  {
    id: 'ws_2',
    service: 'Meet',
    dealershipId: 'deal_2',
    dealershipName: 'Quincy Toyota Center',
    userId: 'u_jason',
    date: '2026-10-23T11:00:00Z',
    subjectOrTitle: 'Executive Intro / Program Review with Alice Jones',
    summary: 'Reviewed 24-hr claims turnaround SLA. Alice agreed to sign contract pending standard DOWC retro trust language.',
    deepLink: 'https://meet.google.com/abc-defg-hij',
    actionItems: ['Send retro trust agreement addendum'],
    isMatched: true
  },
  {
    id: 'ws_3',
    service: 'Calendar',
    dealershipId: 'deal_6',
    dealershipName: 'Worcester Subaru Center',
    userId: 'u_kelley',
    date: '2026-11-02T10:30:00Z',
    subjectOrTitle: 'Onsite Product Demonstration with GSM',
    summary: 'In-person lot meeting scheduled inside good window (10:30 AM).',
    deepLink: 'https://calendar.google.com/event?eid=xyz',
    isMatched: true
  },
  {
    id: 'ws_4',
    service: 'Chat',
    dealershipId: 'deal_19',
    dealershipName: 'Midwest Heritage Ford of Schaumburg',
    userId: 'u_kevin',
    date: '2026-10-31T09:15:00Z',
    subjectOrTitle: 'Internal Chat #deals-midwest',
    summary: 'Jason and Kevin coordinated on group multi-store proposal for Robert Klein.',
    deepLink: 'https://chat.google.com/room/midwest-closers',
    isMatched: true
  },
  {
    id: 'ws_5',
    service: 'Drive',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    userId: 'u_toddb',
    date: '2026-10-29T16:45:00Z',
    subjectOrTitle: 'Signed_Vendor_Agreement_ALM_Alpharetta_2026.pdf',
    summary: 'Executed contract uploaded to Google Drive. Triggers transition to Signed & Onboarding stage.',
    deepLink: 'https://drive.google.com/file/d/1B2C3D4E5F',
    actionItems: ['Confirm onboarding checklist assigned to Todd Bilius'],
    isMatched: true
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: 'aud_1',
    timestamp: '2026-11-01T08:00:00Z',
    userId: 'u_donna',
    userName: 'Donna Clark',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    action: 'Incentive Payout Released',
    details: 'Authorized incentive payment to Todd Bilius. Reference: ACH-889102.'
  },
  {
    id: 'aud_2',
    timestamp: '2026-10-30T16:00:00Z',
    userId: 'u_jose',
    userName: 'Jose Matos',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    action: 'Deal Won & Contract Signed',
    details: 'Closed deal with Regional Director Marcus Vance. Attribution permanently locked to origin rep Todd Bilius.'
  },
  {
    id: 'aud_3',
    timestamp: '2026-10-28T16:00:00Z',
    userId: 'u_toddb',
    userName: 'Todd Bilius',
    dealershipId: 'deal_34',
    dealershipName: 'ALM Hyundai Supercenter of Alpharetta',
    action: 'Manager Assist Requested',
    details: 'Requested Jose Matos assist for contract signing support with Marcus Vance.'
  }
];
