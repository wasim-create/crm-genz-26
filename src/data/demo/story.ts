// The demo "story engine". Every dealership in places.ts has a scenario; this
// file turns each one into a dated, realistic history (calls, visits, emails,
// Meets, assists, sign-ups, onboarding, Keyfetch top-ups, upsells) and then
// DERIVES everything else from that history, so all screens agree:
//   stage, heat, last touch, product interest, lot counts, health score,
//   relationship temperature, assists, incentives (with real trails),
//   points ledger, levels, ranks, streaks, badges, Workspace items, audit log.
//
// All dates are relative to "today", so the demo always looks current.
// Weekends are skipped (business-day offsets). Times are the dealership's
// local time; live contact (visits, calls, Meets) sits inside 10 AM – 4 PM,
// except a few deliberate examples that show the compliance warnings.

import type {
  Activity,
  AuditLogRecord,
  Contact,
  DealerGroup,
  Dealership,
  DealershipProductInterest,
  GamificationBadge,
  GamificationProfile,
  GameRule,
  IntroductionIncentive,
  IntroductionTrailStep,
  InventoryTopup,
  ManagerAssist,
  ManagerPriority,
  OnboardingTask,
  OwnershipTransfer,
  PipelineStage,
  PointsLedgerEntry,
  ProductBonus,
  ProductCatalogItem,
  RelationshipTemperature,
  TimeZone,
  UpsellOpportunity,
  User,
  WorkspaceItem
} from '../../types/crm';
import { GROUPS, PLACES, Place, Scenario } from './places';
import { buildContacts, hash } from './people';
import { addDays, isWeekend, parseISODate, toISODate } from '../../features/myplan/engine/time';
import { utcOffsetMinutes, zoneFor } from '../../features/myplan/engine/timezones';
import { milesBetween } from '../../features/myplan/engine/geo';
import { calculateClientHealthScore } from '../../utils/territory';

// ───────────────────────── calendar helpers ─────────────────────────

/** n business days from `iso` (negative = earlier). 0 returns `iso` itself. */
export function addBusinessDays(iso: string, n: number): string {
  let d = iso;
  let k = Math.abs(n);
  const step = n < 0 ? -1 : 1;
  while (k > 0) {
    d = addDays(d, step);
    if (!isWeekend(d)) k--;
  }
  return d;
}

/** ISO timestamp for a local wall-clock time in a time zone. */
export function stampAt(date: string, hhmm: string, zone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const offset = utcOffsetMinutes(zone, date); // minutes east of UTC (e.g. -300 for EST)
  return new Date(Date.UTC(y, m - 1, d, h, mi) - offset * 60000).toISOString();
}

const weekday = (iso: string) => parseISODate(iso).toLocaleDateString('en-US', { weekday: 'long' });
const shortDate = (iso: string) => parseISODate(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const pick = <T,>(list: T[], seed: number): T => list[seed % list.length];
const listText = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

// ───────────────────────── static reference data ─────────────────────────

export const LEVELS = [
  { level: 1, title: 'Rookie', min: 0 },
  { level: 2, title: 'Road Warrior', min: 500 },
  { level: 3, title: 'Lot Legend', min: 1200 },
  { level: 4, title: 'Closer', min: 2000 },
  { level: 5, title: 'Territory Boss', min: 3500 },
  { level: 6, title: 'Hall of Fame', min: 5000 }
];

export const levelFor = (points: number) => {
  const cur = [...LEVELS].reverse().find(l => points >= l.min)!;
  const next = LEVELS.find(l => l.min > points);
  const pointsToNextLevel = next ? next.min - points : 0;
  const levelProgressPercent = next ? Math.round(((points - cur.min) / (next.min - cur.min)) * 100) : 100;
  return { level: cur.level, levelTitle: cur.title, pointsToNextLevel, levelProgressPercent };
};

const PRODUCT_NAME: Record<string, string> = {
  prod_1: 'Vehicle Service Contract (Extended Warranty)',
  prod_2: 'Certified Limited Warranty',
  prod_3: 'Keyfetch',
  prod_4: 'GAP',
  prod_5: 'Tire & Wheel Protection',
  prod_6: 'Maintenance',
  prod_7: 'GPS + AI + Vehicle History Plug-in',
  prod_8: 'ChargeClub (No Capex)',
  prod_9: 'EV Solutions',
  prod_10: 'Ceramic Pro'
};
const SHORT: Record<string, string> = {
  prod_1: 'VSC',
  prod_2: 'Certified Limited Warranty',
  prod_3: 'Keyfetch',
  prod_4: 'GAP',
  prod_5: 'Tire & Wheel',
  prod_6: 'Maintenance plans',
  prod_7: 'the GPS + AI plug-in',
  prod_8: 'ChargeClub',
  prod_9: 'EV Solutions',
  prod_10: 'Ceramic Pro'
};
const names = (ids: string[]) => listText(ids.map(i => SHORT[i]));

const ASSIST_LABEL: Record<ManagerAssist['assistType'], string> = {
  join_call: 'join a call',
  in_person_visit: 'join an in-person visit',
  google_meet: 'join a Google Meet',
  terms_approval: 'terms approval',
  strategy_session: 'strategy session',
  contract_signing_support: 'contract signing support'
};

// ───────────────────────── output type ─────────────────────────

export interface DemoData {
  today: string;
  products: ProductCatalogItem[];
  productBonuses: ProductBonus[];
  groups: DealerGroup[];
  dealerships: Dealership[];
  contacts: Contact[];
  activities: Activity[];
  assists: ManagerAssist[];
  incentives: IntroductionIncentive[];
  topups: InventoryTopup[];
  priorities: ManagerPriority[];
  ledger: PointsLedgerEntry[];
  gamification: Record<string, GamificationProfile>;
  workspace: WorkspaceItem[];
  audit: AuditLogRecord[];
  userHireDates: Record<string, string>;
}

type Who = 'rep' | 'mgr' | 'prev';
type Tag =
  | 'claim'
  | 'interest'
  | 'lot'
  | 'voicemail'
  | 'assist_req'
  | 'assist_meet'
  | 'signed'
  | 'topup'
  | 'upsell_won'
  | 'refill'
  | 'issue'
  | 'cancelled'
  | 'late'
  | 'priority_done';

interface Ev {
  d: number;
  t: string;
  type: Activity['activityType'];
  by?: Who;
  to?: number;
  notes: string;
  products?: string[];
  interest?: 'Low' | 'Medium' | 'High';
  next?: string;
  nextIn?: number;
  nextTime?: string;
  tags?: Tag[];
  qty?: number;
  cars?: number;
  voice?: string;
  tasks?: string[];
  upsell?: string;
}

interface StoryCtx {
  p: Place;
  evs: Ev[];
  upsells: UpsellOpportunity[];
  signedD?: number;
  lostReason?: string;
  nurture?: string;
  disq?: string;
  isOwned: boolean;
  sourceLabel: Dealership['source'];
}

const COMM: Record<Activity['activityType'], Activity['communicationType']> = {
  'In-Person Visit': 'In-Person',
  'Phone Call': 'Phone',
  Email: 'Email',
  'Text Message': 'Phone',
  'Google Meet': 'Virtual',
  Chat: 'Virtual',
  'System Note': 'System',
  'Keyfetch Top-up': 'System'
};
const LIVE: Activity['activityType'][] = ['In-Person Visit', 'Phone Call', 'Google Meet'];

const STAGE: Record<Scenario, PipelineStage> = {
  pool: 'Pool',
  pool_radar: 'Pool',
  claimed: 'Claimed',
  visit_planned: 'Visit Planned',
  visited: 'Visited',
  follow_up: 'Follow-up',
  in_progress: 'In Progress',
  hot: 'HOT',
  negotiation: 'Negotiation',
  contract: 'Contract',
  won: 'Won',
  signed: 'Signed',
  onboarding: 'Onboarding',
  client: 'Client',
  client_risk: 'Client',
  client_far: 'Client',
  lost: 'Lost',
  not_now: 'Not Now',
  disqualified: 'Disqualified',
  placeholder: 'Claimed'
};

// ───────────────────────── assist / incentive specs ─────────────────────────

interface AssistSpec {
  key: string;
  status: ManagerAssist['status'];
  type: ManagerAssist['assistType'];
  requestD: number;
  proposedD: number;
  time: string;
  managerNotes?: string;
  outcome?: string;
  reschedule?: [number, string];
}

const ASSISTS: AssistSpec[] = [
  { key: 'ne_blackstone', status: 'Pending', type: 'in_person_visit', requestD: -1, proposedD: 3, time: '14:00' },
  { key: 'ne_cw_ford', status: 'Accepted', type: 'terms_approval', requestD: -6, proposedD: 2, time: '11:00', managerNotes: 'I’ll bring the Commonwealth Toyota terms sheet so Sean Walsh can see they match. 45 minutes max.' },
  { key: 'ne_goldenmile', status: 'Completed', type: 'google_meet', requestD: -12, proposedD: -8, time: '13:30', outcome: 'Confirmed the claims turnaround in writing for Rachel. Stephen agreed to sign once the agreement arrives.' },
  { key: 'ne_cw_kia', status: 'Completed', type: 'contract_signing_support', requestD: -19, proposedD: -15, time: '11:00', outcome: 'Agreement signed by Brian Costa. Richard Doyle approved ChargeClub for this store only.' },
  { key: 'mw_ls_kia', status: 'Accepted', type: 'strategy_session', requestD: -6, proposedD: 3, time: '13:00', managerNotes: 'Let’s present one rollout plan for Joliet and the next two stores, so Diane approves once.' },
  { key: 'mw_ls_chevy', status: 'Completed', type: 'terms_approval', requestD: -16, proposedD: -13, time: '10:30', outcome: 'Terms approved by Dan Kozlowski. Diane Kowalski signed off at group level the same day.' },
  { key: 'mw_ls_hyundai', status: 'Completed', type: 'join_call', requestD: -5, proposedD: -2, time: '14:00', outcome: 'Chris Bauer said yes on the call. Kevin is sending the agreement.' },
  { key: 'se_crescent', status: 'Reschedule Proposed', type: 'in_person_visit', requestD: -2, proposedD: 2, time: '14:00', reschedule: [4, '10:30'], managerNotes: 'I’m in Miami on that day. Can we do a Google Meet on the later date instead? Andre is fine with video.' },
  { key: 'se_pd_nissan', status: 'Completed', type: 'contract_signing_support', requestD: -9, proposedD: -5, time: '11:30', outcome: 'Signed under the Piedmont group terms. Gregory Banks joined by phone for five minutes.' },
  { key: 'w_valleycrest', status: 'Declined', type: 'join_call', requestD: -4, proposedD: -2, time: '11:00', managerNotes: 'Mark already agreed the terms with you — close this one solo. Call me if he wavers.' },
  { key: 'w_cl_kia', status: 'Accepted', type: 'in_person_visit', requestD: -5, proposedD: 1, time: '10:30', managerNotes: 'I’ll bring the Torrance penetration numbers Elaine asked for.' },
  { key: 'w_cl_hyundai', status: 'Completed', type: 'google_meet', requestD: -21, proposedD: -17, time: '13:00', outcome: 'Elaine Park approved the EV Solutions pilot for Cerritos. Steve Kang signed.' },
  { key: 'tx_tr_honda', status: 'Completed', type: 'contract_signing_support', requestD: -6, proposedD: -3, time: '11:00', outcome: 'Rick Pruitt signed with Jose in the room. First signed deal for Carlos.' },
  { key: 'tx_tr_ford', status: 'Pending', type: 'join_call', requestD: -1, proposedD: 2, time: '11:30' }
];

interface IncentiveSpec {
  key: string;
  state: IntroductionIncentive['state'];
  amount: number;
  rule: string;
  comments?: string;
  conflicts?: string[];
  amountChange?: [number, number];
}

const INCENTIVES: IncentiveSpec[] = [
  { key: 'ne_oceanstate', state: 'Approved', amount: 450, rule: 'Solo introduction and close • 3 products signed', comments: 'Solo close confirmed with Greg Almeida by phone. Approved for the next payroll run.' },
  { key: 'ne_cw_kia', state: 'Paid', amount: 375, rule: 'Introduction with manager assist • 2 products', comments: 'Paid with the payroll run.' },
  { key: 'mw_ls_chevy', state: 'Verified', amount: 400, rule: 'Dealer-group rooftop • multi-product', comments: 'Verified with Diane Kowalski. Amount updated for the group-rooftop rule.', amountChange: [350, 400] },
  { key: 'mw_ls_hyundai', state: 'Pending verification', amount: 300, rule: 'Introduction qualified (verbal yes)', comments: 'Waiting for the signed agreement before verifying.' },
  { key: 'mw_ls_ford', state: 'Paid', amount: 425, rule: 'Dealer-group rooftop • 3 products', comments: 'Paid with the payroll run.' },
  { key: 'se_pd_nissan', state: 'Verified', amount: 350, rule: 'Group sister rooftop with assist', comments: 'Verified with Bobby Sanders. Ready for approval.' },
  { key: 'se_pd_toyota', state: 'Rejected', amount: 0, rule: 'Sister rooftop under existing group agreement', comments: 'Not a new introduction — Piedmont Toyota joined under the group agreement Todd already earned on Piedmont Honda.' },
  { key: 'w_cl_hyundai', state: 'Disputed', amount: 400, rule: 'Dealer-group rooftop with assist', comments: 'On hold until first-contact date is confirmed.', conflicts: ['Michael Sena logged a call with Elaine Park about Cerritos 3 weeks before Todd Kelly claimed the store.', 'Gmail shows Michael’s thread with the group F&I director started first.'] },
  { key: 'tx_tr_honda', state: 'Eligible', amount: 350, rule: 'Introduction with manager assist • 3 products', comments: undefined }
];

// ───────────────────────── the builder ─────────────────────────

export function buildDemoData(users: User[], gameRules: GameRule[], now: Date = new Date()): DemoData {
  const today = toISODate(now);
  const bd = (n: number) => addBusinessDays(today, n);
  const userById = (id: string | null | undefined) => users.find(u => u.id === id);
  const fullName = (u?: User) => (u ? `${u.firstName} ${u.lastName}` : '');
  const ruleOf = (action: string) => gameRules.find(r => r.actionType === action)?.basePoints ?? 0;

  // Points are a rolling six-week season; anything earlier is a small carry-over.
  const ledgerStart = bd(-30);

  // Carlos is a rookie: started about 12 weeks ago. Jose covered DFW before him.
  const carlosHire = bd(-62);
  const transferD = -47;

  // Product catalog — Ceramic Pro launched ~5 weeks ago.
  const ceramicLaunch = bd(-27);
  const products: ProductCatalogItem[] = [
    { id: 'prod_1', name: PRODUCT_NAME.prod_1, category: 'Warranty & Protection', description: 'Mechanical breakdown coverage for pre-owned inventory with fast claims.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-01-15', addedBy: 'David Sterling' },
    { id: 'prod_2', name: PRODUCT_NAME.prod_2, category: 'Warranty & Protection', description: 'Dealership-branded powertrain warranty that builds pre-owned buyer confidence.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-01-15', addedBy: 'David Sterling' },
    { id: 'prod_3', name: PRODUCT_NAME.prod_3, category: 'Hardware & Lot Tracking', description: 'Smart key tags and cabinets with real-time lot key tracking.', isActive: true, requiresInventoryTopups: true, dateAdded: '2023-01-15', addedBy: 'David Sterling' },
    { id: 'prod_4', name: PRODUCT_NAME.prod_4, category: 'F&I Ancillary', description: 'Guaranteed Asset Protection for financed vehicles.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-02-01', addedBy: 'David Sterling' },
    { id: 'prod_5', name: PRODUCT_NAME.prod_5, category: 'F&I Ancillary', description: 'Road-hazard tire, wheel and cosmetic rim repair coverage.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-02-01', addedBy: 'David Sterling' },
    { id: 'prod_6', name: PRODUCT_NAME.prod_6, category: 'Service Dept', description: 'Pre-paid oil, filter, rotation and scheduled service packages.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-03-01', addedBy: 'David Sterling' },
    { id: 'prod_7', name: PRODUCT_NAME.prod_7, category: 'Telematics & Digital', description: 'OBD-II lot tracking, low-battery alerts and instant vehicle history.', isActive: true, requiresInventoryTopups: false, dateAdded: '2023-06-10', addedBy: 'Jason Scott' },
    { id: 'prod_8', name: PRODUCT_NAME.prod_8, category: 'EV Infrastructure', description: 'Zero-capex EV fast chargers and a customer charging network.', isActive: true, requiresInventoryTopups: false, dateAdded: '2024-01-10', addedBy: 'Jason Scott' },
    { id: 'prod_9', name: PRODUCT_NAME.prod_9, category: 'EV Infrastructure', description: 'High-voltage toolkits, battery health diagnostics and EV service readiness.', isActive: true, requiresInventoryTopups: false, dateAdded: '2024-04-15', addedBy: 'Jason Scott' },
    { id: 'prod_10', name: PRODUCT_NAME.prod_10, category: 'Appearance & Protection', description: 'Ceramic nano-coating and interior protection, sold at delivery.', isActive: true, requiresInventoryTopups: false, isNewLaunch: true, dateAdded: ceramicLaunch, addedBy: 'David Sterling' }
  ];

  const monthStart = `${today.slice(0, 8)}01`;
  const monthEnd = toISODate(new Date(parseISODate(today).getFullYear(), parseISODate(today).getMonth() + 1, 0));
  const productBonuses: ProductBonus[] = [
    { id: 'pb_ceramic', productId: 'prod_10', productName: 'Ceramic Pro', bonusPoints: 150, actionTypes: ['upsell_won', 'signed'], startDate: ceramicLaunch, endDate: addDays(ceramicLaunch, 90), targetType: 'all', isActive: true },
    { id: 'pb_gap', productId: 'prod_4', productName: 'GAP', bonusPoints: 0, multiplier: 2, actionTypes: ['signed'], startDate: monthStart, endDate: monthEnd, targetType: 'all', isActive: true },
    { id: 'pb_ev_tx', productId: 'prod_9', productName: 'EV Solutions', bonusPoints: 50, actionTypes: ['interest_recorded'], startDate: bd(-15), endDate: bd(20), targetType: 'region', targetValue: 'Texas / South Central', isActive: true }
  ];

  // ── ids, phones, domains, zones ──
  const idOf = (key: string) => `deal_${key}`;
  const placeByKey = Object.fromEntries(PLACES.map(p => [p.key, p]));
  const phoneSeq: Record<string, number> = {};
  const phoneFor = (area: string) => {
    phoneSeq[area] = (phoneSeq[area] ?? 0) + 1;
    return `(${area}) 555-${String(100 + (phoneSeq[area] % 100)).padStart(4, '0')}`;
  };
  const mainPhone: Record<string, string> = {};
  PLACES.forEach(p => (mainPhone[p.key] = phoneFor(p.area)));
  const contactPhones: Record<string, string> = {};
  const slug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  const domainOf = (key: string) => {
    const p = placeByKey[key];
    const g = GROUPS.find(x => x.id === p.group);
    if (g) return g.domain;
    return `${slug(p.name)}.com`;
  };
  const zoneOf = (p: Place) => zoneFor(p.state, p.city) as TimeZone;

  // Group decision makers are contacts at the group's first rooftop.
  const placesWithGroupDM = PLACES.map(p => {
    const g = GROUPS.find(x => x.id === p.group);
    const first = g && PLACES.find(x => x.group === g.id && x.scen !== 'placeholder');
    if (g && first && first.key === p.key && p.people) return { ...p, people: [...p.people, g.dm] };
    return p;
  });

  // Rough "when did this story start" per scenario, used for createdAt.
  const START: Record<Scenario, number> = {
    pool: -95, pool_radar: -3, claimed: -2, visit_planned: -4, visited: -12, follow_up: -20, in_progress: -30, hot: -36,
    negotiation: -45, contract: -50, won: -48, signed: -58, onboarding: -60, client: -120, client_risk: -110, client_far: -125,
    lost: -40, not_now: -30, disqualified: -15, placeholder: -20
  };
  const jitter = (p: Place, span = 3) => hash(p.key) % span;
  const startD = (p: Place) => {
    let s = START[p.scen] - jitter(p, 4);
    if (p.rep === 'u_carlos' && !p.transferFrom) s = Math.max(s, -58);
    return s;
  };

  const { contacts, byPlace } = buildContacts(
    placesWithGroupDM,
    idOf,
    domainOf,
    key => {
      const p = placeByKey[key];
      const k = `${key}_${Object.keys(contactPhones).length}`;
      contactPhones[k] = phoneFor(p.area);
      return contactPhones[k];
    },
    key => stampAt(bd(startD(placeByKey[key]) + 1), '12:00', zoneOf(placeByKey[key])),
    key => placeByKey[key].rep ?? undefined
  );

  // ── assemble every dealership's events ──
  const activities: Activity[] = [];
  const topups: InventoryTopup[] = [];
  const ledger: PointsLedgerEntry[] = [];
  const audit: AuditLogRecord[] = [];
  const dealerships: Dealership[] = [];
  const assists: ManagerAssist[] = [];
  const incentives: IntroductionIncentive[] = [];
  let actSeq = 0;
  let ledgerSeq = 0;
  let auditSeq = 0;

  const addLedger = (userId: string, d: Dealership | undefined, actionType: string, description: string, points: number, ts: string) => {
    if (!points) return;
    ledger.push({ id: `ple_${++ledgerSeq}`, userId, dealershipId: d?.id, dealershipName: d?.dealershipName, actionType, description, pointsAwarded: points, ruleVersion: 'v2.1', timestamp: ts });
  };
  const addAudit = (ts: string, user: User | undefined, d: Dealership | undefined, action: string, details: string) => {
    audit.push({ id: `aud_${++auditSeq}`, timestamp: ts, userId: user?.id ?? 'system', userName: user ? fullName(user) : 'System', dealershipId: d?.id ?? '', dealershipName: d?.dealershipName ?? '', action, details });
  };

  const localsFor = (p: Place) => {
    const id = idOf(p.key);
    const zone = zoneOf(p);
    const rep = userById(p.rep);
    const mgr = userById(rep?.managerId);
    const prev = userById(p.transferFrom);
    const cs = byPlace[p.key] ?? [];
    const c = (i: number) => cs[Math.min(i, cs.length - 1)];
    const nm = (i: number) => (c(i) ? `${c(i).firstName} ${c(i).lastName}` : 'the GM');
    const fn = (i: number) => (c(i) ? c(i).firstName : 'the GM');
    const titleOf = (i: number) => (c(i) ? c(i).jobTitle.replace(/ \(.*\)|\/.*$/g, '').trim() : '');
    const ucmIdx = Math.max(0, cs.findIndex(x => /Used Car/.test(x.jobTitle)));
    const fiIdx = Math.max(0, cs.findIndex(x => /F&I|Finance/.test(x.jobTitle)));
    const h = hash(p.key);
    const group = GROUPS.find(g => g.id === p.group);
    const homeMiles = rep ? milesBetween(rep.homeCoords, { lat: p.lat, lng: p.lng }) : 0;
    const salesMo = Math.round(p.cars * (p.independent ? 0.45 : 0.62));
    const interestIds = (p.interest ?? defaultInterest(p)).filter(Boolean);
    const signedIds = p.signed ?? [];
    const s0 = startD(p);
    return { id, zone, rep, mgr, prev, cs, c, nm, fn, titleOf, ucmIdx, fiIdx, h, group, homeMiles, salesMo, interestIds, signedIds, s0 };
  };

  const stories: StoryCtx[] = [];

  // ═════════ pass 1: write each dealership's story as events ═════════
  for (const p of placesWithGroupDM) {
    const { id, zone, rep, mgr, prev, cs, nm, fn, titleOf, ucmIdx, fiIdx, h, group, homeMiles, salesMo, interestIds, signedIds, s0 } = localsFor(p);
    void id;
    const evs: Ev[] = [];
    const push = (e: Ev) => evs.push(e);
    const brandWord = p.brands[0] ?? 'independent';

    // ── first touches (claim / assignment / referral) ──
    const isOwned = !!rep && p.scen !== 'pool' && p.scen !== 'pool_radar';
    const sourceLabel: Dealership['source'] = p.referredBy || p.referredByUser
      ? 'Referral'
      : p.scen === 'client_far' || p.transferFrom
        ? 'Assigned'
        : p.scen === 'claimed' && h % 2 === 0
          ? 'Radar'
          : p.scen === 'placeholder'
            ? 'Manual Search'
            : 'Pool';

    if (isOwned && p.scen !== 'placeholder') {
      if (p.transferFrom && prev) {
        push({ d: s0, t: '09:10', type: 'System Note', by: 'prev', notes: `Account opened by ${fullName(prev)} while covering DFW before a rep was hired.`, tags: [] });
      } else if (p.scen === 'client_far') {
        push({ d: s0, t: '09:05', type: 'System Note', by: 'mgr', notes: `Assigned to ${rep!.firstName} by ${fullName(mgr)}. ${p.note ?? ''}`.trim() });
      } else if (sourceLabel === 'Referral') {
        const r = p.referredBy;
        push({
          d: s0,
          t: '08:50',
          type: 'System Note',
          notes: r
            ? `Referral from ${r[0]} (${r[1]}) — ${r[2]}. Added and claimed (${homeMiles.toFixed(0)} mi from home).`
            : `Internal referral from ${fullName(userById(p.referredByUser!.userId))}: ${p.referredByUser!.note} Claimed (${homeMiles.toFixed(0)} mi from home).`,
          tags: ['claim']
        });
      } else if (sourceLabel === 'Radar') {
        push({ d: s0, t: '08:40', type: 'System Note', notes: `Found with Open Radar (from home ZIP ${rep!.homeZipCode}, 25 mi) — not in the CRM before. Added and claimed: ${homeMiles.toFixed(0)} mi from home.`, tags: ['claim'] });
      } else {
        push({ d: s0, t: '08:45', type: 'System Note', notes: `Claimed from the Prospect Pool — ${homeMiles.toFixed(0)} mi from home, inside the 60-mile territory.`, tags: ['claim'] });
      }
    }

    // ── scenario timelines ──
    const intro = (d: number, booked: boolean, visitIn?: number, visitTime = '11:00') => {
      push({ d, t: '10:20', type: 'Phone Call', to: 0, notes: pick([
        `Called the main line and asked for the GSM. Left a voicemail with my cell and a one-line intro on Keyfetch.`,
        `Intro call — ${fn(0)} was on the floor. Receptionist took my number; left a voicemail.`
      ], h), tags: ['voicemail'], tasks: ['p_intro'] });
      if (booked) {
        const vd = visitIn ?? d + 2;
        push({ d: d + 1, t: '14:15', type: 'Phone Call', to: 0, notes: `Reached ${nm(0)} (${titleOf(0)}). Booked a first visit for ${weekday(bd(vd))} at ${time12(visitTime)} and asked for ${p.independent ? 'a quick look at the lot' : 'the used car manager to walk the lot with us'}.`, next: 'First visit / introduction', nextIn: vd, nextTime: visitTime, tasks: ['p_followup'] });
      }
    };
    const scout = (d: number, early = false) => {
      const t = early ? '09:10' : pick(['10:30', '11:15', '13:30', '14:10'], h);
      const aged = Math.round(p.cars * 0.18);
      const notes = p.independent
        ? `First visit. Met the owner ${nm(0)}. ${p.cars} cars on the lot, sells about ${salesMo} a month; no F&I office — ${fn(0)} does the paperwork himself. Interested in ${names(interestIds.slice(0, 2))} as add-ons at delivery. Left the one-pager.`
        : pick([
            `First visit. Met ${nm(0)} and walked the lot with ${fn(ucmIdx)}: counted ${p.cars} used units, about ${aged} over 60 days. F&I runs on ${p.fi}. Keys hang on a pegboard in the tower — ${fn(ucmIdx)} says they lose a few every month. Most interest in ${names(interestIds.slice(0, 2))}.`,
            `Walk-in. ${nm(0)} gave me 20 minutes between deals. ${p.cars} pre-owned on the lot, selling roughly ${salesMo} a month. Menu on ${p.fi}. Keen on ${SHORT[interestIds[0]]}; wants to know more about ${SHORT[interestIds[1] ?? 'prod_3']}.`,
            `Scouting visit. ${p.cars} used cars on the lot, mostly ${brandWord} trade-ins. ${fn(0)} (${titleOf(0)}) runs a tight F&I office on ${p.fi}. Asked good questions on ${names(interestIds.slice(0, 2))}.`
          ], h + 1);
      push({
        d,
        t,
        type: 'In-Person Visit',
        to: 0,
        notes: early ? `${notes} Arrived before 10 — the sales meeting was still running and I waited 25 minutes. Next time: after 10.` : notes,
        products: interestIds.filter(x => x !== 'prod_10' || bd(d) >= ceramicLaunch).slice(0, 3),
        interest: 'Medium',
        cars: p.cars,
        tags: ['interest', 'lot', ...(early ? (['late'] as Tag[]) : [])],
        tasks: ['p_intro', 'p_interest']
      });
      push({ d: d + 1, t: '08:35', type: 'Email', to: 0, notes: `Sent ${fn(0)} the one-pager on ${SHORT[interestIds[0]]} and a short case study from a similar ${p.independent ? 'independent lot' : `${brandWord} store`}.${cs.length > 1 ? ` Copied ${fn(1)}.` : ''}` });
    };
    const demo = (d: number) =>
      push({
        d,
        t: pick(['10:30', '13:00', '14:30'], h),
        type: 'Google Meet',
        to: fiIdx,
        notes: `Google Meet demo with ${nm(0)}${fiIdx ? ` and ${nm(fiIdx)}` : ''}. Walked through the ${SHORT[interestIds[0]]} claims flow and how products show on the ${p.fi} menu. ${fn(fiIdx)} asked how cancellations are handled. Interest high on ${SHORT[interestIds[0]]}, medium on ${SHORT[interestIds[1] ?? 'prod_3']}.`,
        products: interestIds.slice(0, 2),
        interest: 'High',
        tags: ['interest'],
        tasks: ['p_pitch']
      });
    const dmVisit = (d: number, objection?: string) =>
      push({
        d,
        t: pick(['11:00', '13:30', '14:00'], h + 2),
        type: 'In-Person Visit',
        to: 0,
        notes: `Decision-maker meeting with ${nm(0)}. ${objection ?? p.objection ?? `Main question was onboarding time for the F&I desk.`} Agreed next step and a date.`,
        products: interestIds.slice(0, 3),
        interest: 'High',
        tags: ['interest'],
        tasks: ['p_dm']
      });

    const signDeal = (d: number, assisted: boolean) => {
      push({
        d,
        t: '11:30',
        type: 'In-Person Visit',
        to: 0,
        notes: `Agreement signed by ${nm(0)} — ${names(signedIds)}.${assisted && mgr ? ` ${mgr.firstName} joined for the signing.` : ' Solo close.'} Booked the onboarding kick-off.`,
        products: signedIds,
        tags: ['signed'],
        tasks: ['s_contract']
      });
    };
    const onboard = (d: number, upTo: number, prods: string[] = signedIds) => {
      const steps: Ev[] = [
        { d, t: '10:30', type: 'In-Person Visit', to: 0, notes: `Onboarding kick-off with ${nm(0)}${fiIdx ? ` and ${nm(fiIdx)}` : ''}. Agreed install date${prods.includes('prod_3') ? ' for the Keyfetch cabinets' : ''} and asked their ${p.fi} admin to add the new products to the menu.`, tasks: ['s_setup'] },
        { d: d + 3, t: '13:00', type: 'In-Person Visit', to: ucmIdx, notes: prods.includes('prod_3') ? `Keyfetch cabinets installed at the used car desk. Tagged ${Math.round(p.cars * 0.6)} vehicles with ${fn(ucmIdx)}; porters will tag the rest this week.` : `Menu setup check with ${fn(fiIdx)} — products live on ${p.fi}.`, tasks: ['s_setup'] },
        { d: d + 6, t: '10:00', type: 'In-Person Visit', to: fiIdx, notes: `F&I training for the desk managers on presenting ${names(prods.filter(x => x !== 'prod_3').slice(0, 2)) || 'the new products'}. ${fn(fiIdx)} will run the first deals this week.`, tasks: ['s_training'] },
        { d: d + 10, t: '14:30', type: 'Phone Call', to: 0, notes: `Handover call with ${fn(0)}: first deals went through without issues. Moving to regular servicing.`, tasks: ['s_handover'] }
      ];
      steps.filter(s => s.d <= upTo).forEach(push);
    };
    const serviceHistory = (from: number, until: number, opts: { far?: boolean } = {}) => {
      // Keyfetch checks + top-ups roughly every 6 weeks, check-ins in between.
      const hasKey = signedIds.includes('prod_3');
      const cycle = opts.far ? 40 : 28;
      let d = from + 12 + (h % 5);
      let k = 0;
      while (d <= until) {
        const who: Who = prev && d < transferD ? 'prev' : 'rep';
        if (hasKey) {
          const needs = (k + h) % 2 === 1;
          const spare = needs ? 25 + ((h + k * 7) % 20) : 60 + ((h + k * 5) % 30);
          const qty = Math.max(100, Math.min(400, Math.round((p.cars * 0.9) / 50) * 50));
          push({
            d,
            t: pick(['10:45', '11:30', '13:15', '14:20'], h + k),
            type: opts.far && k % 2 === 1 ? 'Phone Call' : 'In-Person Visit',
            by: who,
            to: ucmIdx,
            notes: needs
              ? `Keyfetch check with ${fn(ucmIdx)}: ${spare} spare tags left — about two weeks at their pace. Ordered a refill of ${qty}.`
              : `Keyfetch check: ${spare} spare tags, cabinets syncing fine. No order needed yet.${k % 3 === 2 ? ` ${fn(0)} asked about adding a second cabinet at the service drive.` : ''}`,
            tags: needs ? ['refill'] : [],
            qty: needs ? qty : undefined,
            tasks: ['c_keyfetch', 'c_checkin']
          });
          if (needs && d + 3 <= until + 2 && d + 3 < 0) {
            push({ d: d + 3, t: '09:30', type: 'Keyfetch Top-up', by: who, to: ucmIdx, notes: `Keyfetch top-up delivered: ${qty} tags. Signed for by ${fn(ucmIdx)}.`, tags: ['topup'], qty });
          }
        } else {
          push({ d, t: '11:00', type: 'Phone Call', by: who, to: 0, notes: `Monthly check-in with ${fn(0)}. ${pick(['All good; claims paid on time this month.', 'Asked for refreshed menu cards for the F&I office.', 'No issues. Mentioned a new F&I manager starting next month.'], h + k)}`, tasks: ['c_checkin'] });
        }
        k++;
        d += cycle - (k % 2) * 4;
      }
    };
    const upsells: UpsellOpportunity[] = [];
    const upsellStory = (fromD: number) => {
      const owned = new Set(signedIds);
      const candidates = ['prod_10', 'prod_4', 'prod_5', 'prod_7', 'prod_8'].filter(x => !owned.has(x));
      const prodId = candidates[(h >>> 3) % candidates.length];
      if (!prodId) return;
      const createdD = Math.max(fromD + 15, prodId === 'prod_10' ? -26 : -40);
      if (createdD >= -2) return;
      const stage: UpsellOpportunity['stage'] = (['Identified', 'Pitched', 'Interested', 'Won', 'Pitched', 'Lost'] as const)[h % 6];
      const who = rep!;
      push({ d: createdD, t: '13:45', type: 'In-Person Visit', to: 0, notes: `Pitched ${SHORT[prodId]} to ${nm(0)}${prodId === 'prod_10' ? ' with the two-panel demo on a used SUV' : ''}. ${stage === 'Identified' ? 'Noted for next visit.' : stage === 'Lost' ? 'Not for them right now.' : 'Wants attach rates from a similar store.'}`, products: [prodId], interest: stage === 'Lost' ? 'Low' : 'Medium', tasks: ['c_upsell'] });
      let wonDate: string | undefined;
      if (stage === 'Won') {
        const wd = Math.min(-2, createdD + 8);
        wonDate = stampAt(bd(wd), '15:00', zone);
        push({ d: wd, t: '15:00', type: 'Phone Call', to: 0, notes: `${fn(0)} added ${SHORT[prodId]} — starts on next month’s deliveries.`, products: [prodId], tags: ['upsell_won'], upsell: prodId, tasks: ['c_upsell'] });
      }
      upsells.push({
        id: `ups_${id}_${prodId}`,
        dealershipId: id,
        productId: prodId,
        productName: PRODUCT_NAME[prodId],
        stage,
        ownerId: who.id,
        ownerName: fullName(who),
        nextStep: stage === 'Won' ? 'Check first-month attach rate' : stage === 'Lost' ? 'Revisit next quarter' : stage === 'Interested' ? 'Send attach rates from a similar store' : 'Bring a demo kit on the next visit',
        createdAt: stampAt(bd(createdD), '13:45', zone),
        wonDate,
        wonByUserId: stage === 'Won' ? who.id : undefined
      });
    };

    let signedD: number | undefined;
    let lostReason: string | undefined;
    let nurture: string | undefined;
    let disq: string | undefined;

    switch (p.scen) {
      case 'claimed':
        intro(s0, false);
        evs[evs.length - 1].next = 'Try the GSM again';
        evs[evs.length - 1].nextIn = 1;
        break;
      case 'visit_planned':
        intro(s0, true, 1 + (h % 2), '14:00');
        break;
      case 'visited':
        intro(s0, true, s0 + 3);
        scout(s0 + 3, p.rep === 'u_carlos' && h % 2 === 0);
        evs[evs.length - 1].next = 'Follow-up call';
        evs[evs.length - 1].nextIn = 1 + (h % 3);
        if (p.key === 'w_inland') {
          push({ d: -4, t: '17:40', type: 'In-Person Visit', to: 0, notes: 'Dropped in after 5 PM on the way home — owner had left; spoke briefly with the closing salesperson. Not a good time; rebook inside 10–4.', tags: ['late'], tasks: ['p_followup'] });
        }
        break;
      case 'follow_up':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        push({ d: -8 - (h % 3), t: '11:40', type: 'Phone Call', to: 0, notes: `Follow-up call — no answer. Left a voicemail and sent a text.`, tags: ['voicemail'], tasks: ['p_followup'] });
        push({ d: -8 - (h % 3), t: '11:45', type: 'Text Message', to: 0, notes: `Texted ${fn(0)}: thanks again for the walk-around — happy to bring the claims sample by any morning this week.` });
        push({ d: -3, t: '15:10', type: 'Email', to: 0, notes: `${fn(0)} replied: interested, but busy with month-end. Asked me to call next week.`, next: 'Follow-up call', nextIn: 2 + (h % 2) });
        break;
      case 'in_progress':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        push({ d: s0 + 10, t: '14:00', type: 'Phone Call', to: 0, notes: `Follow-up call with ${fn(0)}. Read the material; wants the F&I team to see a demo.`, tasks: ['p_followup'] });
        demo(s0 + 16);
        dmVisit(-5);
        evs[evs.length - 1].next = 'Send a side-by-side comparison';
        evs[evs.length - 1].nextIn = 2;
        break;
      case 'hot': {
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 14);
        dmVisit(-9);
        push({ d: -3, t: '15:20', type: 'Phone Call', to: 0, notes: `${fn(0)} called back — ready to move. ${p.objection ?? ''} Asked if my manager can join the next meeting.`.replace('  ', ' '), interest: 'High', products: interestIds.slice(0, 2), tags: ['interest'], tasks: ['p_followup'] });
        break;
      }
      case 'negotiation':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 12);
        dmVisit(-24);
        push({ d: -15, t: '10:40', type: 'Email', to: 0, notes: `Sent ${fn(0)} the draft terms for ${names(interestIds.slice(0, 2))}.` });
        push({ d: -9, t: '13:15', type: 'Phone Call', to: 0, notes: `${fn(0)} reviewed the draft: ${p.objection ?? 'a few questions on cancellations.'}`, tasks: ['p_followup'] });
        break;
      case 'contract':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 12);
        dmVisit(-26);
        push({ d: -4, t: '09:15', type: 'Email', to: 0, notes: `Sent the agreement for e-signature to ${nm(0)} — ${names(interestIds.slice(0, 3))}.${p.group ? ` Same terms as the ${group?.name} agreement.` : ''}`, next: 'Chase signature', nextIn: 1 });
        push({ d: -1, t: '14:40', type: 'Phone Call', to: 0, notes: `${fn(0)} confirmed the agreement is with their controller; expects to sign by ${weekday(bd(3))} — booked a signing visit for 10:30 AM.`, tasks: ['s_contract'], next: 'Contract signing', nextIn: 3, nextTime: '10:30' });
        break;
      case 'won':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 12);
        dmVisit(-20, 'Wanted to see the Lakeshore Honda numbers first.');
        push({ d: -1, t: '08:50', type: 'Email', to: 0, notes: `Agreement drafted for ${nm(0)} — sending for e-signature once the group approves.`, next: 'Send agreement for signature', nextIn: 1 });
        break;
      case 'signed':
      case 'onboarding': {
        const assistedSign = ASSISTS.find(a => a.key === p.key && a.status === 'Completed');
        signedD = assistedSign ? assistedSign.proposedD : p.scen === 'signed' ? -2 - (h % 6) : -14 - (h % 3);
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 12);
        dmVisit(signedD - 14);
        push({ d: signedD - 4, t: '09:20', type: 'Email', to: 0, notes: `Sent the agreement for e-signature — ${names(signedIds)}.` });
        signDeal(signedD, ASSISTS.some(a => a.key === p.key && a.status === 'Completed'));
        if (p.scen === 'onboarding') onboard(signedD + 4, -1);
        else evs[evs.length - 1].next = 'Onboarding kick-off';
        if (p.scen === 'signed') {
          evs[evs.length - 1].nextIn = 1;
          evs[evs.length - 1].nextTime = '11:00';
        }
        break;
      }
      case 'client':
      case 'client_risk':
      case 'client_far': {
        signedD = s0 + 14;
        const who: Who = prev ? 'prev' : 'rep';
        const firstSigned = signedIds.filter(x => x !== 'prod_10' || bd(signedD!) >= ceramicLaunch);
        evs.push({ d: s0 + 3, t: '11:00', type: 'In-Person Visit', by: who, to: 0, notes: `First visit with ${nm(0)}. ${p.cars} used units; F&I on ${p.fi}. Interested in ${names(firstSigned.slice(0, 3))}.`, products: firstSigned, interest: 'High', cars: p.cars, tags: ['interest', 'lot'], tasks: ['p_intro'] });
        evs.push({ d: signedD, t: '11:30', type: 'In-Person Visit', by: who, to: 0, notes: `Agreement signed by ${nm(0)} — ${names(firstSigned)}.`, products: firstSigned, tags: ['signed'], tasks: ['s_contract'] });
        if (firstSigned.length < signedIds.length) {
          // Ceramic Pro came after launch as an upsell on an existing client.
          const pitchD = -20 - (h % 4);
          const wonD = pitchD + 7;
          evs.push({ d: pitchD, t: '13:45', type: 'In-Person Visit', to: 0, notes: `Pitched Ceramic Pro (new launch) to ${nm(0)} with the two-panel demo on a used SUV. Wants to try it on next week’s deliveries.`, products: ['prod_10'], interest: 'High', tasks: ['c_upsell'] });
          evs.push({ d: wonD, t: '15:00', type: 'Phone Call', to: 0, notes: `${fn(0)} added Ceramic Pro for all used-car deliveries.`, products: ['prod_10'], tags: ['upsell_won'], upsell: 'prod_10', tasks: ['c_upsell'] });
          upsells.push({ id: `ups_${id}_prod_10`, dealershipId: id, productId: 'prod_10', productName: PRODUCT_NAME.prod_10, stage: 'Won', ownerId: rep!.id, ownerName: fullName(rep), nextStep: 'Check first-month attach rate', createdAt: stampAt(bd(pitchD), '13:45', zone), wonDate: stampAt(bd(wonD), '15:00', zone), wonByUserId: rep!.id });
        }
        const onb: Ev[] = [];
        const keep = evs.length;
        onboard(signedD + 3, signedD + 14, firstSigned);
        evs.splice(keep).forEach(e => onb.push({ ...e, by: who }));
        evs.push(...onb);
        if (prev) {
          evs.push({ d: transferD, t: '09:00', type: 'System Note', by: 'prev', notes: `Account handed over from ${fullName(prev)} to ${fullName(rep)} after ride-alongs. Origin attribution stays with ${prev.firstName}.` });
          evs.push({ d: transferD + 2, t: '11:00', type: 'In-Person Visit', to: 0, notes: `Intro visit with ${nm(0)} — ${prev.firstName} introduced me as the new rep. Walked the lot and the key cabinet with ${fn(ucmIdx)}.`, tasks: ['c_checkin'] });
        }
        const until = p.scen === 'client_risk' ? -34 : -2 - (h % 6);
        serviceHistory(signedD + 14, until, { far: p.scen === 'client_far' });
        if (p.scen === 'client_risk') {
          push({ d: -40, t: '10:15', type: 'Phone Call', to: 1, notes: `${fn(1)} flagged that tags aren’t being re-hung after test drives since the showroom remodel started. Suggested a porter checklist.`, tags: ['issue'], tasks: ['c_issue'] });
          push({ d: -34, t: '13:00', type: 'Phone Call', to: 0, notes: `Tried ${fn(0)} — voicemail. Remodel still under way.`, tags: ['voicemail'], tasks: ['c_checkin'] });
        } else {
          upsellStory(signedD + 14);
        }
        if (p.key === 'ne_cw_toyota') {
          push({ d: -6, t: '10:30', type: 'In-Person Visit', to: 0, notes: `Quick visit with ${fn(0)}. Asked for refreshed menu cards and said Richard Doyle is happy with the program — good reference for Commonwealth Ford.`, voice: 'Paul says Richard is happy with the program, use him as a reference for Quincy. Menu cards needed for the F&I office.', tasks: ['c_checkin'] });
        }
        break;
      }
      case 'lost':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        demo(s0 + 12);
        push({ d: s0 + 20, t: '11:10', type: 'Phone Call', to: 0, notes: `Follow-up with ${fn(0)}: comparing us with their current provider; decision this month.`, tasks: ['p_followup'] });
        lostReason = `They ${p.competitor ?? 'went with another provider'}.`;
        push({ d: -9, t: '15:30', type: 'Phone Call', to: 0, notes: `${fn(0)} called — they ${p.competitor ?? 'went with another provider'}. Closed as lost; OK to check back next year.`, tasks: ['p_followup'] });
        break;
      case 'not_now':
        intro(s0, true, s0 + 3);
        scout(s0 + 3);
        nurture = bd(38);
        push({ d: -10, t: '14:45', type: 'Phone Call', to: 0, notes: `${fn(0)} likes the products but wants to revisit after ${p.rep === 'u_toddk' ? 'the GM is back on the 20th and inventory settles' : 'the first-quarter inventory reset'}. Set a nurture follow-up for ${shortDate(nurture)}.`, tasks: ['p_followup'] });
        break;
      case 'disqualified':
        intro(s0, true, s0 + 3);
        disq = 'Wholesale-only lot — no retail customers and no F&I office.';
        push({ d: s0 + 3, t: '11:20', type: 'In-Person Visit', to: 0, notes: `Visited: they only sell to other dealers at auction — no retail customers, no F&I office. Disqualified.`, tasks: ['p_intro'] });
        break;
      case 'pool_radar':
        break;
    }

    // Carlos: one cancelled visit (rookie week, GM called in sick)
    if (p.key === 'tx_whiterock') {
      push({ d: -9, t: '11:00', type: 'In-Person Visit', to: 0, notes: 'Visit cancelled — GM called in sick. Rebooked by phone.', tags: ['cancelled'], tasks: ['p_followup'] });
    }

    // Assist events
    const aSpec = ASSISTS.find(a => a.key === p.key);
    if (aSpec && mgr) {
      push({ d: aSpec.requestD, t: '15:10', type: 'System Note', notes: `Requested a Manager Assist from ${fullName(mgr)} (${ASSIST_LABEL[aSpec.type]}) for ${shortDate(bd(aSpec.proposedD))} at ${time12(aSpec.time)}. Brief sent.`, tags: ['assist_req'] });
      const signEv = evs.find(e => e.tags?.includes('signed') && e.d === aSpec.proposedD);
      if (aSpec.status === 'Completed' && signEv) {
        signEv.tags = [...(signEv.tags ?? []), 'assist_meet'];
      } else if (aSpec.status === 'Completed') {
        push({
          d: aSpec.proposedD,
          t: aSpec.time,
          type: aSpec.type === 'google_meet' ? 'Google Meet' : aSpec.type === 'join_call' ? 'Phone Call' : 'In-Person Visit',
          to: 0,
          notes: `Manager Assist with ${mgr.firstName}. ${aSpec.outcome}`,
          tags: ['assist_meet'],
          tasks: ['p_assist']
        });
      }
      if (aSpec.status === 'Declined') {
        push({ d: aSpec.proposedD, t: '14:20', type: 'Phone Call', to: 0, notes: `${fn(0)} confirmed the terms again on the phone. Bringing the agreement for signature.`, next: 'Contract signing', nextIn: 1, nextTime: '14:30', tasks: ['p_followup'] });
      }
    }

    stories.push({ p, evs, upsells, signedD, lostReason, nurture, disq, isOwned, sourceLabel });
  }

  // ═════════ pass 2: everyday routine (drop-ins, check-ins, calls) ═════════
  // Reps make 2–4 live contacts a day. The stories above hold the big moments;
  // this adds the ordinary touches in the last month so My Plan history,
  // streaks and the weekly leaderboard look like a real working month.
  addRoutine(stories, users, localsFor, bd);

  // ═════════ pass 3: derive records from the events ═════════
  for (const story of stories) {
    const { p, evs, upsells, signedD, lostReason, nurture, disq, isOwned, sourceLabel } = story;
    const { id, zone, rep, mgr, prev, cs, c, nm, ucmIdx, fiIdx, h, group, salesMo, interestIds, signedIds, s0 } = localsFor(p);
    void fiIdx; void ucmIdx; void interestIds; void s0;
    const aSpec = ASSISTS.find(a => a.key === p.key);
    // ── turn events into Activities ──
    const dealershipName = p.name;
    const actOf: Activity[] = [];
    evs
      .filter(e => e.d < 0)
      .sort((a, b) => a.d - b.d || a.t.localeCompare(b.t))
      .forEach(e => {
        const user = e.by === 'mgr' ? mgr : e.by === 'prev' ? prev : rep;
        if (!user) return;
        const date = bd(e.d);
        if (user.id === 'u_carlos' && date < carlosHire) return;
        const ts = stampAt(date, e.t, zone);
        const [hh] = e.t.split(':').map(Number);
        const live = LIVE.includes(e.type);
        const cancelled = e.tags?.includes('cancelled');
        const contact = e.to !== undefined ? c(e.to) : undefined;
        const a: Activity = {
          id: `act_${++actSeq}`,
          dealershipId: id,
          dealershipName,
          userId: user.id,
          userName: fullName(user),
          contactId: contact?.id,
          contactName: contact ? `${contact.firstName} ${contact.lastName}` : undefined,
          activityType: e.type,
          communicationType: COMM[e.type],
          status: cancelled ? 'cancelled' : 'completed',
          plannedDate: date,
          plannedTime: e.t,
          completedAt: cancelled ? undefined : ts,
          isGoodWindow: live && !cancelled ? hh >= 10 && hh < 16 : undefined,
          notes: e.notes,
          voiceNotesTranscript: e.voice,
          productsDiscussed: (e.products ?? []).map(x => PRODUCT_NAME[x]),
          interestLevel: e.interest,
          nextAction: e.next,
          nextActionDate: e.nextIn !== undefined ? bd(e.nextIn) : undefined,
          checkInLocation: e.type === 'In-Person Visit' && !cancelled ? { lat: p.lat + 0.0004, lng: p.lng - 0.0003, verified: true } : undefined,
          taskIds: e.tasks,
          nextActionTime: e.nextTime,
          tags: e.tags
        };
        actOf.push(a);
      });
    activities.push(...actOf);

    // ── derived dealership fields ──
    const done = actOf.filter(a => a.status === 'completed');
    const touches = done.filter(a => a.activityType !== 'System Note');
    const lastTouch = touches.length ? touches[touches.length - 1].completedAt! : null;
    const interests: DealershipProductInterest[] = [];
    done.forEach(a => {
      if (!a.productsDiscussed.length || !a.interestLevel) return;
      a.productsDiscussed.forEach(name => {
        const pid = Object.keys(PRODUCT_NAME).find(k => PRODUCT_NAME[k] === name)!;
        const existing = interests.find(i => i.productId === pid);
        const rec = { productId: pid, productName: name, interestLevel: a.interestLevel!, recordedDate: a.completedAt!, recordedByUserId: a.userId, recordedByUserName: a.userName.split(' ')[0] };
        if (existing) Object.assign(existing, rec);
        else interests.push(rec);
      });
    });
    const firstVisit = done.find(a => a.tags?.includes('lot'));
    const history = done
      .filter(a => a.tags?.includes('lot'))
      .map(a => ({ date: a.completedAt!.slice(0, 10), count: p.cars, monthlySales: salesMo, recordedBy: a.userId }));
    if (['client', 'client_far', 'onboarding'].includes(p.scen) && history.length) {
      const recent = done.filter(a => a.taskIds?.includes('c_keyfetch')).slice(-1)[0];
      if (recent) history.push({ date: recent.completedAt!.slice(0, 10), count: Math.round(p.cars * (0.94 + (h % 10) / 100)), monthlySales: salesMo, recordedBy: recent.userId });
    }

    const dTopups: InventoryTopup[] = done
      .filter(a => a.activityType === 'Keyfetch Top-up')
      .map((a, i) => ({
        id: `top_${id}_${i + 1}`,
        dealershipId: id,
        productId: 'prod_3',
        date: a.completedAt!.slice(0, 10),
        quantity: Number(a.notes.match(/(\d+) tags/)?.[1] ?? 150),
        handledByUserId: a.userId,
        handledByName: a.userName,
        notes: i === 0 ? 'First refill after install' : 'Refill after Keyfetch check'
      }));
    topups.push(...dTopups);

    const stage = STAGE[p.scen];
    const heat: Dealership['heatLevel'] = ['hot', 'negotiation', 'contract', 'won'].includes(p.scen) ? 'Hot' : ['claimed', 'visit_planned', 'lost', 'disqualified', 'not_now', 'pool', 'pool_radar', 'placeholder'].includes(p.scen) ? 'Cold' : 'Warm';
    const daysSince = lastTouch ? Math.round((now.getTime() - new Date(lastTouch).getTime()) / 86400000) : 999;
    const issues = done.filter(a => a.tags?.includes('issue')).length;
    const hasRecentTopup = dTopups.some(t => (now.getTime() - new Date(t.date).getTime()) / 86400000 < 75);
    const isClient = stage === 'Client';
    const health = isClient
      ? calculateClientHealthScore({ daysSinceLastTouch: daysSince, hasRecentTopup: hasRecentTopup || !signedIds.includes('prod_3'), activeUpsellCount: upsells.filter(u => u.stage !== 'Lost' && u.stage !== 'Won').length, reportedIssues: issues })
      : undefined;

    const temperature = temperatureFor(p, { daysSince, health, interestIds, competitor: p.competitor });

    const onboardingTasks: OnboardingTask[] | undefined =
      signedD !== undefined && (stage === 'Signed' || stage === 'Onboarding')
        ? [
            { title: 'Onboarding kick-off meeting', offset: 4 },
            { title: signedIds.includes('prod_3') ? 'Keyfetch cabinets installed and vehicles tagged' : 'Products loaded on the F&I menu', offset: 7 },
            { title: `New products added to the ${p.fi} menu`, offset: 8 },
            { title: 'F&I desk training', offset: 10 },
            { title: '30-day review with the GM', offset: 24 }
          ].map((t, i) => {
            const due = bd(signedD! + t.offset);
            const completed = due < today && stage === 'Onboarding' && i < 4;
            return { id: `onb_${id}_${i + 1}`, title: t.title, ownerUserId: rep!.id, dueDate: due, completed, completedAt: completed ? stampAt(due, '15:00', zone) : undefined };
          })
        : undefined;

    const claimedAt = isOwned && p.scen !== 'placeholder' ? stampAt(bd(s0), '08:45', zone) : null;
    const createdAt = stampAt(bd(p.scen === 'pool' ? START.pool - (h % 40) : s0), '08:30', zone);
    const g = group;

    const transfers: OwnershipTransfer[] | undefined =
      prev && rep
        ? [{ id: `otr_${id}`, dealershipId: id, fromRepId: prev.id, toRepId: rep.id, transferredByManagerId: prev.id, transferredByManagerName: fullName(prev), reason: `${rep.firstName} finished ride-alongs and now covers DFW. Jose stays involved for group-level decisions.`, timestamp: stampAt(bd(transferD), '09:00', zone) }]
        : undefined;

    const assistOpen = aSpec && ['Pending', 'Accepted', 'Reschedule Proposed'].includes(aSpec.status);
    const dealer: Dealership = {
      id,
      dealershipName,
      groupId: p.group ?? null,
      groupName: g?.name,
      dealershipType: g ? 'Dealer Group' : 'Standalone',
      rooftopCount: g ? g.rooftops : 1,
      franchiseType: p.independent ? 'Independent' : 'Franchise',
      franchiseBrands: p.brands,
      phone: mainPhone[p.key],
      address: p.street,
      city: p.city,
      state: p.state,
      zipCode: p.zip,
      coordinates: { lat: p.lat, lng: p.lng },
      timeZone: zone,
      usedCarsOnLot: p.cars,
      monthlyUsedSales: p.cars ? salesMo : undefined,
      inventoryHistory: history,
      fiSystem: p.fi,
      fiSource: firstVisit ? 'Scout visit' : undefined,
      fiCapturedDate: firstVisit?.completedAt,
      stage,
      heatLevel: heat,
      source: p.scen === 'pool_radar' ? 'Radar' : p.scen === 'pool' ? 'Pool' : sourceLabel,
      assignedRepId: isOwned ? rep!.id : null,
      originRepId: isOwned ? (prev ? prev.id : rep!.id) : null,
      claimedAt,
      lastTouchpointDate: lastTouch,
      lostReason,
      nurtureFollowUpDate: nurture,
      disqualifiedReason: disq,
      hasActiveAssist: !!assistOpen,
      activeAssistId: assistOpen ? `ast_${p.key}` : undefined,
      closedBy: signedD !== undefined || isClient ? fullName(prev ?? rep) : undefined,
      signedBy: signedD !== undefined || isClient ? nm(0) : undefined,
      closedWithAssistFrom: aSpec?.status === 'Completed' && mgr && (signedD !== undefined || p.scen === 'won') ? fullName(mgr) : undefined,
      ownershipTransfers: transfers,
      relationshipTemperature: temperature,
      productInterests: interests,
      signedProducts: ['signed', 'onboarding', 'client', 'client_risk', 'client_far'].includes(p.scen) ? signedIds : [],
      topups: dTopups,
      upsells,
      onboardingTasks,
      clientHealthScore: health,
      primaryContactName: cs[0] ? `${cs[0].firstName} ${cs[0].lastName}` : undefined,
      website: p.scen === 'placeholder' ? undefined : `https://www.${domainOf(p.key)}`,
      referral: p.referredBy
        ? { externalName: p.referredBy[0], externalCompany: p.referredBy[1], relationship: p.referredBy[2], recordedAt: claimedAt ?? createdAt, recordedByUserId: rep!.id, recordedByName: fullName(rep) }
        : p.referredByUser
          ? { internalUserId: p.referredByUser.userId, internalName: fullName(userById(p.referredByUser.userId)), relationship: p.referredByUser.note, recordedAt: claimedAt ?? createdAt, recordedByUserId: rep!.id, recordedByName: fullName(rep) }
          : undefined,
      isPlaceholder: p.scen === 'placeholder' || undefined,
      locationApproximate: p.scen === 'placeholder' || undefined,
      discoveredVia: p.scen === 'pool_radar' || sourceLabel === 'Radar' ? 'Radar' : undefined,
      createdAt,
      updatedAt: lastTouch ?? createdAt
    };
    dealerships.push(dealer);

    // ── assists ──
    if (aSpec && rep && mgr) {
      const requestTs = stampAt(bd(aSpec.requestD), '15:10', zone);
      const dm = c(0);
      const assist: ManagerAssist = {
        id: `ast_${p.key}`,
        dealershipId: id,
        dealershipName,
        originRepId: rep.id,
        originRepName: fullName(rep),
        assignedManagerId: mgr.id,
        assignedManagerName: fullName(mgr),
        assistType: aSpec.type,
        proposedDate: bd(aSpec.proposedD),
        proposedTime: aSpec.time,
        requestDate: requestTs,
        decisionMakerName: dm ? `${dm.firstName} ${dm.lastName}` : 'General Manager',
        decisionMakerTitle: dm?.jobTitle ?? 'General Manager (GM)',
        objections: p.objection ?? 'Wants reassurance on onboarding time and claims turnaround.',
        productsOfInterest: (p.signed ?? interestIds).slice(0, 3).map(x => PRODUCT_NAME[x]),
        aiBriefing: `${dealershipName} (${p.city}, ${p.state}) — ${p.cars} used units, about ${salesMo} sales a month, F&I on ${p.fi}. ${done.filter(a => a.activityType !== 'System Note').length} touches so far; last: ${touches.length ? touches[touches.length - 1].notes.slice(0, 90) : 'none'}… Decision maker: ${dm ? `${dm.firstName} ${dm.lastName}` : 'GM'}.`,
        status: aSpec.status,
        managerNotes: aSpec.managerNotes,
        rescheduledDate: aSpec.reschedule ? bd(aSpec.reschedule[0]) : undefined,
        rescheduledTime: aSpec.reschedule?.[1],
        completedAt: aSpec.status === 'Completed' ? stampAt(bd(aSpec.proposedD), aSpec.time, zone) : undefined,
        outcomeNotes: aSpec.outcome
      };
      assists.push(assist);
      addAudit(requestTs, rep, dealer, 'Manager Assist Requested', `${rep.firstName} asked ${fullName(mgr)} to ${ASSIST_LABEL[aSpec.type]} on ${shortDate(assist.proposedDate)} at ${time12(aSpec.time)}.`);
      if (aSpec.status !== 'Pending') {
        const decided = stampAt(bd(Math.min(aSpec.requestD + 1, -1)), '17:05', zone);
        const word = aSpec.status === 'Declined' ? 'Declined' : aSpec.status === 'Reschedule Proposed' ? 'Reschedule Proposed' : 'Accepted';
        addAudit(decided, mgr, dealer, `Manager Assist ${word}`, aSpec.managerNotes ?? `${mgr.firstName} accepted the assist.`);
      }
      if (aSpec.status === 'Completed') addAudit(assist.completedAt!, mgr, dealer, 'Manager Assist Completed', aSpec.outcome ?? '');
    }

    // ── audit trail for stage events ──
    actOf.forEach(a => {
      const tags = (a.tags ?? []) as Tag[];
      const u = userById(a.userId);
      if (tags.includes('claim')) addAudit(a.completedAt!, u, dealer, 'Prospect Claimed', a.notes);
      if (tags.includes('signed')) addAudit(a.completedAt!, u, dealer, 'Deal Signed', `Signed ${listText(a.productsDiscussed)} with ${nm(0)}. Attribution: ${fullName(prev ?? rep)}.`);
    });
    if (transfers) transfers.forEach(t => addAudit(t.timestamp, prev, dealer, 'Ownership Transferred', `From ${fullName(prev)} to ${fullName(rep)}. Reason: ${t.reason}`));
    if (lostReason) addAudit(touches[touches.length - 1].completedAt!, rep, dealer, 'Marked Lost', lostReason);
    if (disq) addAudit(touches[touches.length - 1].completedAt!, rep, dealer, 'Disqualified', disq);
    if (nurture) addAudit(touches[touches.length - 1].completedAt!, rep, dealer, 'Moved to Not Now', `Nurture follow-up set for ${shortDate(nurture)}.`);

    // ── points for this dealership's history ──
    actOf.forEach(a => {
      if (a.status !== 'completed') return;
      const tags = (a.tags ?? []) as Tag[];
      const ts = a.completedAt!;
      const inWindow = ts.slice(0, 10) >= ledgerStart;
      let pts = 0;
      const award = (action: string, desc: string, value: number) => {
        if (inWindow) addLedger(a.userId, dealer, action, desc, value, ts);
        pts += value;
      };
      if (tags.includes('claim')) award('claim_prospect', 'Claimed a prospect inside the territory', ruleOf('claim_prospect'));
      if (a.activityType === 'In-Person Visit') {
        if (a.isGoodWindow) award('visit_good_window', 'Field visit inside 10 AM – 4 PM', ruleOf('visit_good_window'));
        else award('visit_bad_window', 'Field visit outside 10 AM – 4 PM', ruleOf('visit_bad_window'));
      }
      if (a.activityType === 'Phone Call' && !tags.includes('voicemail')) award('phone_call', 'Completed phone call', ruleOf('phone_call'));
      if (a.activityType === 'Email' && dealer.stage !== 'Client') award('email_outreach', 'Targeted email', ruleOf('email_outreach'));
      if (a.activityType === 'Google Meet') award('google_meet', 'Google Meet demo', ruleOf('google_meet'));
      if (tags.includes('interest') && a.productsDiscussed.length) award('record_product_interest', `Product interest recorded (${a.productsDiscussed.length})`, ruleOf('record_product_interest'));
      if (tags.includes('assist_req')) award('request_assist', 'Requested a Manager Assist with a brief', ruleOf('request_assist'));
      if (tags.includes('topup')) award('keyfetch_topup', `Keyfetch top-up logged (${a.notes.match(/(\d+) tags/)?.[1]} tags)`, ruleOf('keyfetch_topup'));
      if (tags.includes('signed')) {
        award('deal_won', 'Deal signed', ruleOf('deal_won'));
        a.productsDiscussed.map(n => Object.keys(PRODUCT_NAME).find(k => PRODUCT_NAME[k] === n)!).forEach(pid => {
          let v = ruleOf('product_signed');
          const date = ts.slice(0, 10);
          if (pid === 'prod_10' && date >= ceramicLaunch) v += 150;
          if (pid === 'prod_4' && date >= monthStart) v *= 2;
          award('product_signed', `${SHORT[pid]} signed${pid === 'prod_10' && date >= ceramicLaunch ? ' (+150 launch bonus)' : ''}`, v);
        });
      }
      if (tags.includes('upsell_won')) {
        const pid = Object.keys(PRODUCT_NAME).find(k => a.productsDiscussed[0] === PRODUCT_NAME[k])!;
        award('upsell_won', `Upsell won: ${SHORT[pid]}${pid === 'prod_10' ? ' (+150 launch bonus)' : ''}`, ruleOf('upsell_won') + (pid === 'prod_10' ? 150 : 0));
      }
      a.pointsEarned = pts || undefined;
    });
    // Manager points for attending assists
    if (aSpec?.status === 'Completed' && mgr && bd(aSpec.proposedD) >= ledgerStart) addLedger(mgr.id, dealer, 'attend_assist', `Joined ${rep!.firstName}’s Manager Assist`, ruleOf('attend_assist'), stampAt(bd(aSpec.proposedD), aSpec.time, zone));

    // ── incentives ──
    const iSpec = INCENTIVES.find(x => x.key === p.key);
    if (iSpec && rep) {
      const origin = prev ?? rep;
      const trail: IntroductionTrailStep[] = done
        .filter(a => {
          const t = (a.tags ?? []) as Tag[];
          return t.includes('claim') || t.includes('lot') || t.includes('assist_req') || t.includes('assist_meet') || t.includes('signed') || a.activityType === 'Google Meet';
        })
        .map(a => {
          const t = (a.tags ?? []) as Tag[];
          const step = t.includes('claim') ? 'Claimed' : t.includes('lot') ? 'Scouting visit' : t.includes('assist_req') ? 'Manager Assist requested' : t.includes('assist_meet') ? 'Manager Assist completed' : t.includes('signed') ? 'Agreement signed' : 'Product demo';
          return { step, date: a.completedAt!.slice(0, 10), actor: a.userName, details: a.notes.length > 140 ? `${a.notes.slice(0, 137)}…` : a.notes, isGoodWindow: a.isGoodWindow };
        });
      const signedAct = done.find(a => a.tags?.includes('signed'));
      const anchor = signedAct ? signedAct.completedAt! : touches[touches.length - 1].completedAt!;
      const afterBD = (n: number, hhmm: string) => {
        const base = addBusinessDays(anchor.slice(0, 10), n);
        return stampAt(base < today ? base : bd(-1), hhmm, 'America/Detroit');
      };
      const donna = users.find(u => u.role === 'finance');
      const st = iSpec.state;
      const inc: IntroductionIncentive = {
        id: `inc_${p.key}`,
        dealershipId: id,
        dealershipName,
        originRepId: origin.id,
        originRepName: fullName(origin),
        closedByUserId: rep.id,
        closedByUserName: fullName(rep),
        signedByUserId: rep.id,
        signedByUserName: fullName(rep),
        assistInvolved: !!(aSpec && aSpec.status === 'Completed'),
        assistManagerId: aSpec?.status === 'Completed' ? mgr?.id : undefined,
        assistManagerName: aSpec?.status === 'Completed' ? fullName(mgr) : undefined,
        triggerEvent: signedAct ? 'Agreement signed' : 'Introduction qualified',
        state: st,
        amount: iSpec.amount || undefined,
        calculatedRule: iSpec.rule,
        financeComments: iSpec.comments,
        verifiedAt: ['Verified', 'Approved', 'Paid'].includes(st) ? afterBD(2, '10:15') : undefined,
        approvedAt: ['Approved', 'Paid'].includes(st) ? afterBD(3, '16:00') : undefined,
        paidAt: st === 'Paid' ? afterBD(6, '08:00') : undefined,
        paymentReference: st === 'Paid' ? `ACH-${String(880000 + (h % 99999)).slice(0, 6)}` : undefined,
        reviewDate: st !== 'Eligible' ? afterBD(2, '10:15').slice(0, 10) : undefined,
        reviewedBy: st !== 'Eligible' && donna ? fullName(donna) : undefined,
        trail,
        conflicts: iSpec.conflicts,
        amountAuditTrail: iSpec.amountChange ? [{ changedBy: fullName(donna), changedAt: afterBD(2, '10:10'), oldAmount: iSpec.amountChange[0], newAmount: iSpec.amountChange[1] }] : undefined
      };
      incentives.push(inc);
      if (inc.verifiedAt) addAudit(inc.verifiedAt, donna, dealer, 'Incentive Verified', `Introduction verified for ${fullName(origin)}.`);
      if (inc.approvedAt) addAudit(inc.approvedAt, donna, dealer, 'Incentive Approved', `Approved for payroll.`);
      if (inc.paidAt) addAudit(inc.paidAt, donna, dealer, 'Incentive Paid', `Paid to ${fullName(origin)}. Reference ${inc.paymentReference}.`);
      if (st === 'Rejected') addAudit(afterBD(2, '11:00'), donna, dealer, 'Incentive Rejected', iSpec.comments ?? '');
      if (st === 'Disputed') addAudit(afterBD(2, '11:30'), donna, dealer, 'Incentive Disputed', (iSpec.conflicts ?? []).join(' '));
    }
  }

  // ── dealer groups ──
  const groups: DealerGroup[] = GROUPS.map(g => ({
    id: g.id,
    name: g.name,
    hqAddress: g.hqAddress,
    hqCity: g.hqCity,
    hqState: g.hqState,
    hqZip: g.hqZip,
    mainDecisionMaker: `${g.dm.first} ${g.dm.last} (${g.dm.title === 'GFI' ? 'Group F&I Director' : 'Group Director of Operations'})`,
    mainPhone: phoneFor(g.area),
    notes: g.notes,
    domain: g.domain,
    rooftopCount: g.rooftops,
    groupAccountOwnerId: g.ownerId
  }));

  // ── manager priorities ──
  const dl = (key: string) => dealerships.find(d => d.id === idOf(key))!;
  const prio = (x: Omit<ManagerPriority, 'managerName' | 'linkedDealershipName' | 'linkedProductName'>): ManagerPriority => ({
    ...x,
    managerName: fullName(userById(x.managerId)),
    linkedDealershipName: x.linkedDealershipId ? dealerships.find(d => d.id === x.linkedDealershipId)?.dealershipName : undefined,
    linkedProductName: x.linkedProductId ? PRODUCT_NAME[x.linkedProductId] : undefined
  });
  const priorities: ManagerPriority[] = [
    prio({ id: 'mp_blackstone', managerId: 'u_jason', targetType: 'rep', targetId: 'u_kelley', title: 'Get sample VSC terms to Tom Ricci at Blackstone Valley Subaru', reason: 'Tom needs them to show Carol Hebert before our assist meeting — it’s the last thing holding them back.', priorityLevel: 'Urgent', dueDate: bd(1), linkedDealershipId: dl('ne_blackstone').id, linkedProductId: 'prod_1', bonusPoints: 50, status: 'scheduled', createdAt: stampAt(bd(-1), '08:10', 'America/New_York') }),
    prio({ id: 'mp_lakeshore', managerId: 'u_jason', targetType: 'rep', targetId: 'u_kevin', title: 'Confirm F&I training dates for Lakeshore Chevrolet', reason: 'Diane Kowalski wants all store trainings on the group calendar before our Joliet strategy session.', priorityLevel: 'High', dueDate: bd(2), linkedDealershipId: dl('mw_ls_chevy').id, bonusPoints: 40, status: 'accepted', createdAt: stampAt(bd(-2), '09:00', 'America/Chicago') }),
    prio({ id: 'mp_ceramic_tx', managerId: 'u_jose', targetType: 'region', targetId: 'Texas / South Central', title: 'Pitch Ceramic Pro to the top 5 pre-owned lots', reason: 'Launch bonus is live (+150 pts per win) and DFW lots are asking for add-ons they can sell at delivery.', priorityLevel: 'Normal', dueDate: bd(5), linkedProductId: 'prod_10', bonusPoints: 60, status: 'pending', createdAt: stampAt(bd(-1), '09:30', 'America/Chicago') }),
    prio({ id: 'mp_stonemtn', managerId: 'u_jose', targetType: 'rep', targetId: 'u_toddb', title: 'Re-pitch Ceramic Pro at Stone Mountain Chevrolet', reason: 'Earl Simmons asked about appearance packages at the Piedmont event.', priorityLevel: 'High', dueDate: bd(-3), linkedDealershipId: dl('se_stonemtn').id, linkedProductId: 'prod_10', bonusPoints: 40, status: 'completed', createdAt: stampAt(bd(-8), '08:30', 'America/New_York'), completedAt: stampAt(bd(-4), '15:00', 'America/New_York') }),
    prio({ id: 'mp_conejo', managerId: 'u_michael', targetType: 'rep', targetId: 'u_toddk', title: 'Visit Conejo Valley Jeep this week', reason: 'They were on the list from the AutoWest show.', priorityLevel: 'Normal', dueDate: bd(2), linkedDealershipId: dl('w_malibu').id, bonusPoints: 30, status: 'declined', declineReason: 'GM is out until the 20th — I’ve booked a call for when he’s back.', createdAt: stampAt(bd(-3), '10:00', 'America/Los_Angeles') }),
    prio({ id: 'mp_team_keyfetch', managerId: 'u_jason', targetType: 'team', targetId: 'team', title: 'Log a Keyfetch count on every client visit this month', reason: 'We want accurate restock forecasts before the holiday rush.', priorityLevel: 'Normal', dueDate: bd(12), linkedProductId: 'prod_3', bonusPoints: 20, status: 'accepted', createdAt: stampAt(bd(-5), '08:00', 'America/New_York') })
  ];
  // Completed priority earns its points; make sure the Ceramic upsell exists there.
  const stoneMtn = dl('se_stonemtn');
  if (!stoneMtn.upsells.some(u => u.productId === 'prod_10' && u.stage === 'Won')) {
    stoneMtn.upsells = stoneMtn.upsells.filter(u => u.productId !== 'prod_10');
    stoneMtn.upsells.push({ id: `ups_${stoneMtn.id}_prod_10`, dealershipId: stoneMtn.id, productId: 'prod_10', productName: PRODUCT_NAME.prod_10, stage: 'Won', ownerId: 'u_toddb', ownerName: 'Todd Bilius', nextStep: 'Check first-month attach rate', createdAt: stampAt(bd(-12), '13:45', 'America/New_York'), wonDate: stampAt(bd(-4), '15:00', 'America/New_York'), wonByUserId: 'u_toddb' });
    const wonTs = stampAt(bd(-4), '14:30', 'America/New_York');
    const act: Activity = {
      id: `act_${++actSeq}`, dealershipId: stoneMtn.id, dealershipName: stoneMtn.dealershipName, userId: 'u_toddb', userName: 'Todd Bilius',
      contactId: contacts.find(x => x.dealershipId === stoneMtn.id)?.id, contactName: 'Earl Simmons', activityType: 'In-Person Visit', communicationType: 'In-Person', status: 'completed',
      plannedDate: bd(-4), plannedTime: '14:30', completedAt: wonTs, isGoodWindow: true,
      notes: 'Priority from Jose: re-pitched Ceramic Pro to Earl Simmons with the two-panel demo. Earl added it for all used-car deliveries starting next week.',
      productsDiscussed: [PRODUCT_NAME.prod_10], interestLevel: 'High', checkInLocation: { lat: 33.8461, lng: -84.0128, verified: true }, taskIds: ['c_upsell'], tags: ['upsell_won', 'priority_done'], pointsEarned: 40 + ruleOf('upsell_won') + 150 + 50 + 40
    };
    activities.push(act);
    addLedger('u_toddb', stoneMtn, 'visit_good_window', 'Field visit inside 10 AM – 4 PM', 40, wonTs);
    addLedger('u_toddb', stoneMtn, 'upsell_won', 'Upsell won: Ceramic Pro (+150 launch bonus)', ruleOf('upsell_won') + 150, wonTs);
    addLedger('u_toddb', stoneMtn, 'complete_priority', 'Completed Jose Matos’s priority on time (+40 bonus)', ruleOf('complete_priority') + 40, wonTs);
  }

  // ── Workspace (Gmail / Calendar / Meet / Chat / Drive) ──
  const contactAt = (key: string, i = 0) => contacts.filter(x => x.dealershipId === idOf(key))[i];
  const cn = (x?: Contact) => (x ? `${x.firstName} ${x.lastName}` : '');
  const ws = (x: Omit<WorkspaceItem, 'id'>, i: number): WorkspaceItem => ({ id: `ws_${i + 1}`, ...x });
  const wsRaw: Omit<WorkspaceItem, 'id'>[] = [
    { service: 'Gmail', dealershipId: dl('ne_blackstone').id, dealershipName: dl('ne_blackstone').dealershipName, userId: 'u_kelley', date: stampAt(bd(-1), '09:42', 'America/New_York'), subjectOrTitle: 'Sample terms before Carol signs off?', summary: `${cn(contactAt('ne_blackstone'))} asked for sample VSC terms and a claims example to show the dealer principal before the assist meeting.`, deepLink: 'https://mail.google.com/mail/u/0/#inbox', actionItems: ['Send sample VSC terms', 'Confirm assist meeting time with Jason'], isMatched: true },
    { service: 'Calendar', dealershipId: dl('ne_cw_ford').id, dealershipName: dl('ne_cw_ford').dealershipName, userId: 'u_kelley', date: stampAt(bd(2), '11:00', 'America/New_York'), subjectOrTitle: 'Commonwealth Ford — terms review (Jason joining)', summary: `In-person with ${cn(contactAt('ne_cw_ford'))}. Jason Scott bringing the Commonwealth Toyota terms.`, deepLink: 'https://calendar.google.com/calendar/u/0/r', isMatched: true },
    { service: 'Gmail', dealershipId: dl('ne_cw_toyota').id, dealershipName: dl('ne_cw_toyota').dealershipName, userId: 'u_kelley', date: stampAt(bd(-5), '16:20', 'America/New_York'), subjectOrTitle: 'Menu cards for the F&I office', summary: `${cn(contactAt('ne_cw_toyota'))} asked for 20 refreshed menu cards; happy to be a reference for Commonwealth Ford.`, deepLink: 'https://mail.google.com/mail/u/0/#inbox', actionItems: ['Order menu cards'], isMatched: true },
    { service: 'Drive', dealershipId: dl('ne_oceanstate').id, dealershipName: dl('ne_oceanstate').dealershipName, userId: 'u_kelley', date: dl('ne_oceanstate').updatedAt, subjectOrTitle: 'Ocean_State_Honda_Agreement_signed.pdf', summary: 'Signed agreement uploaded to the client folder.', deepLink: 'https://drive.google.com/drive/my-drive', isMatched: true },
    { service: 'Gmail', userId: 'u_kelley', date: stampAt(bd(-2), '19:05', 'America/New_York'), subjectOrTitle: 'Fwd: dealer list for the South Shore', summary: 'Forwarded list of five dealerships from a personal Gmail address. Not matched to any dealership yet — review and link or ignore.', deepLink: 'https://mail.google.com/mail/u/0/#inbox', isMatched: false },
    { service: 'Chat', dealershipId: dl('mw_ls_kia').id, dealershipName: dl('mw_ls_kia').dealershipName, userId: 'u_kevin', date: stampAt(bd(-3), '09:15', 'America/Chicago'), subjectOrTitle: 'Chat with Jason Scott', summary: 'Jason and Kevin agreed to present one rollout plan for Joliet and the next two Lakeshore stores.', deepLink: 'https://chat.google.com/', isMatched: true },
    { service: 'Meet', dealershipId: dl('mw_ls_hyundai').id, dealershipName: dl('mw_ls_hyundai').dealershipName, userId: 'u_kevin', date: stampAt(bd(-2), '14:00', 'America/Chicago'), subjectOrTitle: 'Lakeshore Hyundai — call with Chris Bauer (Jason joined)', summary: 'Meeting notes: Chris agreed to Keyfetch, VSC and EV Solutions. Agreement to follow; group approval expected this week.', deepLink: 'https://meet.google.com/', actionItems: ['Send agreement for e-signature'], isMatched: true },
    { service: 'Gmail', dealershipId: dl('mw_ls_chevy').id, dealershipName: dl('mw_ls_chevy').dealershipName, userId: 'u_kevin', date: stampAt(bd(-1), '08:05', 'America/Chicago'), subjectOrTitle: 'RE: Training dates — all Lakeshore stores', summary: 'Diane Kowalski asked for the Orland Park training date to go on the group calendar.', deepLink: 'https://mail.google.com/mail/u/0/#inbox', actionItems: ['Confirm Orland Park training date'], isMatched: true },
    { service: 'Gmail', dealershipId: dl('se_crescent').id, dealershipName: dl('se_crescent').dealershipName, userId: 'u_toddb', date: stampAt(bd(-1), '11:20', 'America/New_York'), subjectOrTitle: 'RE: Meeting with your manager', summary: `${cn(contactAt('se_crescent'))} is fine with a Google Meet instead of the in-person meeting.`, deepLink: 'https://mail.google.com/mail/u/0/#inbox', isMatched: true },
    { service: 'Drive', dealershipId: dl('se_pd_nissan').id, dealershipName: dl('se_pd_nissan').dealershipName, userId: 'u_toddb', date: dl('se_pd_nissan').updatedAt, subjectOrTitle: 'Piedmont_Nissan_Alpharetta_Agreement.pdf', summary: 'Signed under the Piedmont group terms.', deepLink: 'https://drive.google.com/drive/my-drive', isMatched: true },
    { service: 'Meet', dealershipId: dl('w_valleycrest').id, dealershipName: dl('w_valleycrest').dealershipName, userId: 'u_toddk', date: stampAt(bd(-6), '13:00', 'America/Los_Angeles'), subjectOrTitle: 'Valley Crest Ford — F&I demo', summary: 'Jasmine Cole asked how VSC cancellations post to Reynolds. Mark Delaney agreed terms verbally.', deepLink: 'https://meet.google.com/', isMatched: true },
    { service: 'Calendar', userId: 'u_toddk', date: stampAt(bd(3), '08:30', 'America/Los_Angeles'), subjectOrTitle: 'Coffee — Mark?', summary: 'Calendar event with no dealership or contact email. Not matched.', deepLink: 'https://calendar.google.com/calendar/u/0/r', isMatched: false },
    { service: 'Gmail', dealershipId: dl('w_cl_hyundai').id, dealershipName: dl('w_cl_hyundai').dealershipName, userId: 'u_michael', date: stampAt(addBusinessDays(dl('w_cl_hyundai').claimedAt!.slice(0, 10), -15), '10:00', 'America/Los_Angeles'), subjectOrTitle: 'Great to meet you at AutoWest — Cerritos EV plans', summary: 'Michael’s first thread with Elaine Park about Cerritos. Referenced in the incentive dispute.', deepLink: 'https://mail.google.com/mail/u/0/#inbox', isMatched: true },
    { service: 'Gmail', dealershipId: dl('tx_tr_honda').id, dealershipName: dl('tx_tr_honda').dealershipName, userId: 'u_carlos', date: stampAt(bd(-1), '10:40', 'America/Chicago'), subjectOrTitle: 'Onboarding — install date', summary: `${cn(contactAt('tx_tr_honda', 1))} asked to install the Keyfetch cabinets before Saturday’s sale.`, deepLink: 'https://mail.google.com/mail/u/0/#inbox', actionItems: ['Book install before Saturday'], isMatched: true },
    { service: 'Drive', dealershipId: dl('tx_tr_honda').id, dealershipName: dl('tx_tr_honda').dealershipName, userId: 'u_carlos', date: dl('tx_tr_honda').updatedAt, subjectOrTitle: 'Trinity_Honda_Grapevine_Agreement_signed.pdf', summary: 'Signed agreement — Carlos’s first deal.', deepLink: 'https://drive.google.com/drive/my-drive', isMatched: true },
    { service: 'Chat', dealershipId: dl('tx_tr_ford').id, dealershipName: dl('tx_tr_ford').dealershipName, userId: 'u_carlos', date: stampAt(bd(-1), '16:10', 'America/Chicago'), subjectOrTitle: 'Chat with Jose Matos', summary: 'Carlos asked Jose to join the Trinity Ford call; Jose said he’ll confirm once he checks his Thursday.', deepLink: 'https://chat.google.com/', isMatched: true }
  ];
  const workspace: WorkspaceItem[] = wsRaw.map(ws);

  // ── system-level audit entries ──
  const david = users.find(u => u.role === 'owner');
  addAudit(stampAt(ceramicLaunch, '09:00', 'America/New_York'), david, undefined, 'Product Added', 'Added Ceramic Pro to the catalog and flagged it as a new launch.');
  addAudit(stampAt(ceramicLaunch, '09:05', 'America/New_York'), david, undefined, 'Product Bonus Created', 'Ceramic Pro launch bonus: +150 pts per sign-up or upsell for 90 days.');
  addAudit(stampAt(monthStart < today ? monthStart : today, '08:00', 'America/New_York'), david, undefined, 'Product Bonus Created', 'GAP double points for sign-ups this month.');
  priorities.forEach(pr => addAudit(pr.createdAt, userById(pr.managerId), pr.linkedDealershipId ? dealerships.find(d => d.id === pr.linkedDealershipId) : undefined, 'Priority Created', `${pr.title} (${pr.priorityLevel}, due ${shortDate(pr.dueDate)}).`));
  audit.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  activities.sort((a, b) => (b.completedAt ?? b.plannedDate ?? '').localeCompare(a.completedAt ?? a.plannedDate ?? ''));

  // ── gamification: derived from the ledger ──
  const OPENING: Record<string, number> = { u_kevin: 600, u_kelley: 300, u_toddb: 250, u_toddk: 100, u_carlos: 0, u_jason: 1100, u_jose: 950, u_michael: 800 };
  Object.entries(OPENING).forEach(([uid, pts]) => {
    if (pts > 0) ledger.push({ id: `ple_open_${uid}`, userId: uid, actionType: 'opening_balance', description: `Carried over from last season (before ${shortDate(ledgerStart)})`, pointsAwarded: pts, ruleVersion: 'v2.0', timestamp: stampAt(ledgerStart, '06:00', 'America/New_York') });
  });
  ledger.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const sinceDays = (n: number) => now.getTime() - n * 86400000;
  const gamification: Record<string, GamificationProfile> = {};
  const scored = users.filter(u => ['new_rep', 'veteran_rep', 'team_lead', 'manager'].includes(u.role));
  const totals = scored.map(u => {
    const mine = ledger.filter(l => l.userId === u.id);
    const sum = (from: number) => mine.filter(l => new Date(l.timestamp).getTime() >= from && l.actionType !== 'opening_balance').reduce((s, l) => s + l.pointsAwarded, 0);
    return { u, all: mine.reduce((s, l) => s + l.pointsAwarded, 0), week: sum(sinceDays(7)), month: sum(sinceDays(30)), today: mine.filter(l => l.timestamp.slice(0, 10) === today).reduce((s, l) => s + l.pointsAwarded, 0) };
  });
  const reps = totals.filter(t => t.u.role !== 'manager');
  const rankIn = (list: typeof totals, uid: string, key: 'week' | 'month') => [...list].sort((a, b) => b[key] - a[key]).findIndex(t => t.u.id === uid) + 1;

  totals.forEach(t => {
    const mine = activities.filter(a => a.userId === t.u.id && a.status === 'completed');
    const visits = mine.filter(a => a.activityType === 'In-Person Visit');
    // Golden Window streak: consecutive working days (back from the last one)
    // with live contact, all of it inside 10 AM – 4 PM.
    const liveAll = mine.filter(a => LIVE.includes(a.activityType));
    const dayState = (iso: string) => {
      const dayActs = liveAll.filter(a => a.completedAt!.slice(0, 10) === iso);
      if (!dayActs.length) return 'none';
      return dayActs.every(a => a.isGoodWindow) ? 'good' : 'bad';
    };
    let streak = 0;
    for (let i = 1; i < 60; i++) {
      if (dayState(bd(-i)) === 'good') streak++;
      else break;
    }
    let best = 0;
    let run = 0;
    for (let i = 60; i >= 1; i--) {
      if (dayState(bd(-i)) === 'good') {
        run++;
        best = Math.max(best, run);
      } else run = 0;
    }
    // consecutive good-window visits (most recent first)
    let goodRun = 0;
    for (const v of [...visits].sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))) {
      if (v.isGoodWindow) goodRun++;
      else break;
    }
    const visitsPerDay: Record<string, number> = {};
    visits.forEach(v => (visitsPerDay[v.completedAt!.slice(0, 10)] = (visitsPerDay[v.completedAt!.slice(0, 10)] ?? 0) + 1));
    const myDeals = dealerships.filter(d => d.assignedRepId === t.u.id);
    const scouted = myDeals.filter(d => d.inventoryHistory.length > 0).length;
    const keyUnits = topups.filter(x => x.handledByUserId === t.u.id).reduce((s, x) => s + x.quantity, 0);
    const ceramicWins = myDeals.reduce((s, d) => s + d.upsells.filter(u => u.productId === 'prod_10' && u.stage === 'Won').length, 0) + myDeals.filter(d => d.signedProducts.includes('prod_10') && d.stage !== 'Client').length;
    const assistedWins = assists.filter(a => a.originRepId === t.u.id && a.status === 'Completed').length;
    const groupSigned = Math.max(0, ...GROUPS.map(g => myDeals.filter(d => d.groupId === g.id && ['Client', 'Signed', 'Onboarding'].includes(d.stage)).length));
    const clientHealth = myDeals.filter(d => d.clientHealthScore !== undefined).map(d => d.clientHealthScore!);
    const avgHealth = clientHealth.length ? Math.round(clientHealth.reduce((s, x) => s + x, 0) / clientHealth.length) : 0;
    const monthWins = dealerships.filter(d => d.assignedRepId === t.u.id && d.closedBy && activities.some(a => a.dealershipId === d.id && a.tags?.includes('signed') && new Date(a.completedAt!).getTime() >= sinceDays(30))).length;
    const earned = (cond: boolean, dateHint: string) => (cond ? dateHint : undefined);
    const badge = (b: Omit<GamificationBadge, 'unlocked' | 'earnedDate'>, hint: string): GamificationBadge => ({ ...b, unlocked: b.currentProgress >= b.targetProgress, earnedDate: earned(b.currentProgress >= b.targetProgress, hint) });
    const badges: GamificationBadge[] =
      t.u.role === 'manager'
        ? [badge({ id: 'b_coach', name: 'Coach', category: 'Teamwork', description: 'Joined 3 Manager Assists that closed', icon: '🤝', currentProgress: assists.filter(a => a.assignedManagerId === t.u.id && a.status === 'Completed').length, targetProgress: 3 }, bd(-5))]
        : [
            badge({ id: 'b_scout', name: 'Territory Hawk', category: 'Scouting', description: 'Scouted 10 dealerships in your territory', icon: '🦅', currentProgress: scouted, targetProgress: 10 }, bd(-20)),
            badge({ id: 'b_goodtime', name: 'Golden Window Master', category: 'Visits', description: '10 visits in a row inside 10 AM – 4 PM', icon: '⏱️', currentProgress: Math.min(goodRun, 10), targetProgress: 10 }, bd(-6)),
            badge({ id: 'b_key', name: 'Key Master', category: 'Servicing', description: 'Topped up 1,000 Keyfetch tags', icon: '🔑', currentProgress: keyUnits, targetProgress: 1000 }, bd(-10)),
            badge({ id: 'b_ceramic', name: 'Ceramic Pro Pioneer', category: 'Upselling', description: 'First 3 Ceramic Pro wins', icon: '✨', currentProgress: ceramicWins, targetProgress: 3 }, bd(-4)),
            badge({ id: 'b_closer', name: 'The Closer', category: 'Closing', description: 'Turned 2 Manager Assists into signed deals', icon: '🎯', currentProgress: assistedWins, targetProgress: 2 }, bd(-3)),
            badge({ id: 'b_group', name: 'Empire Builder', category: 'Teamwork', description: 'Signed 3 rooftops in one dealer group', icon: '🏛️', currentProgress: groupSigned, targetProgress: 3 }, bd(-14)),
            badge({ id: 'b_trust', name: 'Shield of Trust', category: 'Relationships', description: 'Average client health of 85+', icon: '🛡️', currentProgress: avgHealth, targetProgress: 85 }, bd(-8))
          ];
    const lv = levelFor(t.all);
    gamification[t.u.id] = {
      userId: t.u.id,
      points: t.all,
      pointsToday: t.today,
      dailyTarget: t.u.isRookie ? 80 : 100,
      streakDays: streak,
      bestStreak: Math.max(best, streak),
      ...lv,
      badges,
      weeklyRank: t.u.role === 'manager' ? rankIn(totals, t.u.id, 'week') : rankIn(reps, t.u.id, 'week'),
      monthlyRank: t.u.role === 'manager' ? rankIn(totals, t.u.id, 'month') : rankIn(reps, t.u.id, 'month'),
      activeMultiplier: { label: '🔥 2x GAP this month', multiplier: 2 },
      personalBests: { maxVisitsDay: Math.max(0, ...Object.values(visitsPerDay)), maxWinsMonth: Math.max(monthWins, 1), longestStreak: Math.max(best, streak) }
    };
  });

  return {
    today,
    products,
    productBonuses,
    groups,
    dealerships,
    contacts,
    activities,
    assists,
    incentives,
    topups,
    priorities,
    ledger,
    gamification,
    workspace,
    audit,
    userHireDates: { u_carlos: carlosHire }
  };
}

// ───────────────────────── helpers ─────────────────────────

type Locals = {
  fn: (i: number) => string;
  nm: (i: number) => string;
  ucmIdx: number;
  fiIdx: number;
  interestIds: string[];
  h: number;
};

/**
 * Everyday touches for the last month: drop-ins and check-in calls at active
 * clients and live deals, so each rep has 2–4 live contacts a day (visits /
 * calls inside 10–4). Never touches lost, nurture, at-risk or far accounts.
 */
function addRoutine(stories: StoryCtx[], users: User[], localsFor: (p: Place) => Locals, bd: (n: number) => string) {
  const TARGET: Record<string, number> = { u_kevin: 3, u_kelley: 3, u_toddb: 3, u_toddk: 2, u_carlos: 2 };
  // Desired current streaks: a day with no live contact (office / training
  // day) ends each streak. Picked on a day with no story events for that rep.
  const STREAK: Record<string, number> = { u_kevin: 14, u_kelley: 8, u_toddb: 6, u_toddk: 2, u_carlos: 4 };
  const SKIP: Record<string, number[]> = {};
  Object.entries(STREAK).forEach(([uid, n]) => {
    const busy = (d: number) => stories.some(s => s.p.rep === uid && s.evs.some(e => e.d === d && (!e.by || e.by === 'rep') && LIVE.includes(e.type)));
    const free = (from: number) => {
      for (let k = from; k < from + 15; k++) if (!busy(-k)) return -k;
      return -from;
    };
    const a = free(n + 1);
    SKIP[uid] = [a, free(-a + 9)];
  });
  const ACTIVE: Scenario[] = ['client', 'contract', 'negotiation', 'hot', 'in_progress'];
  const TIMES = ['10:10', '10:35', '11:05', '11:40', '13:10', '13:35', '14:05', '14:40', '15:15'];
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const lastFiller = new Map<StoryCtx, number>();
  let turn = 0;
  for (const u of users.filter(x => TARGET[x.id])) {
    const mine = stories.filter(s => s.p.rep === u.id && ACTIVE.includes(s.p.scen));
    for (let d = -22; d <= -1; d++) {
      if (SKIP[u.id]?.includes(d)) continue;
      const today = stories.filter(s => s.p.rep === u.id).flatMap(s => s.evs.filter(e => e.d === d && (!e.by || e.by === 'rep') && LIVE.includes(e.type)));
      const used = new Set(today.map(e => e.t));
      let need = TARGET[u.id] + (u.isRookie ? 0 : (d + turn) % 3 === 0 ? 1 : 0) - today.length;
      const order = [...mine].sort((a, b) => ((hash(a.p.key) + d * 7) % 97) - ((hash(b.p.key) + d * 7) % 97));
      for (const s of order) {
        if (need <= 0) break;
        if (s.evs.some(e => e.d === d)) continue;
        const first = Math.min(...s.evs.filter(e => e.type === 'In-Person Visit').map(e => e.d));
        const from = s.signedD !== undefined ? s.signedD + 14 : first + 2;
        if (!(d > from)) continue;
        if ((lastFiller.get(s) ?? -999) > d - 3) continue;
        const L = localsFor(s.p);
        const isClient = s.p.scen === 'client';
        const hasVisit = today.some(e => e.type === 'In-Person Visit');
        const visit = !hasVisit || (L.h + d) % 10 < (isClient ? 6 : 5);
        const rot = (L.h + d * 7) % TIMES.length;
        const t = [...TIMES.slice(rot), ...TIMES.slice(0, rot)].find(x => [...used].every(u => Math.abs(mins(u) - mins(x)) >= 60));
        if (!t) break;
        used.add(t);
        const k = Math.abs(L.h + d * 3);
        const notes = isClient
          ? visit
            ? pick([
                `Drop-in with ${L.fn(0)}: all good; dropped off refreshed menu cards for the F&I office.`,
                `Keyfetch spot check with ${L.fn(L.ucmIdx)} — cabinets syncing, no order needed.`,
                `Stopped by the F&I desk; ${L.fn(L.fiIdx)} asked for two more product brochures.`,
                `Quick visit — ${L.fn(0)} was in a meeting, caught up with ${L.fn(L.ucmIdx)} on lot levels instead.`
              ], k)
            : pick([`Check-in call with ${L.fn(0)}. No issues this week.`, `Called ${L.fn(L.fiIdx)} to confirm last month’s claims were paid — all paid.`, `Called ${L.fn(0)} about the holiday sales event; they’ll need extra Keyfetch tags in December.`], k)
          : visit
            ? pick([
                `Dropped off the claims sample for ${L.fn(0)}, who was with a customer. Will call tomorrow.`,
                `Quick follow-up visit — ${L.fn(0)} asked for a reference from a similar store.`,
                `Stopped by the F&I office; ${L.fn(L.fiIdx)} is still keen on ${SHORT[L.interestIds[0]]}.`
              ], k)
            : pick([`Follow-up call with ${L.fn(0)}: still reviewing; asked me to check back next week.`, `Call with ${L.fn(0)} — answered two questions on cancellations.`], k);
        const ev: Ev = { d, t, type: visit ? 'In-Person Visit' : 'Phone Call', to: 0, notes, tasks: [isClient ? 'c_checkin' : 'p_followup'] };
        s.evs.push(ev);
        today.push(ev);
        lastFiller.set(s, d);
        need--;
      }
    }
    turn++;
  }
}

function defaultInterest(p: Place): string[] {
  const b = p.brands[0] ?? '';
  if (p.independent) return ['prod_7', 'prod_5', 'prod_2'];
  if (['BMW', 'Lexus'].includes(b)) return ['prod_10', 'prod_5', 'prod_3'];
  if (['Hyundai', 'Kia', 'Nissan', 'Volkswagen'].includes(b)) return ['prod_3', 'prod_9', 'prod_1'];
  if (['Jeep', 'Ram', 'Ford', 'Chevrolet'].includes(b)) return ['prod_3', 'prod_1', 'prod_5'];
  return ['prod_3', 'prod_1', 'prod_4'];
}

function temperatureFor(p: Place, x: { daysSince: number; health?: number; interestIds: string[]; competitor?: string }): RelationshipTemperature {
  const base: Partial<Record<Scenario, number>> = {
    claimed: 40, visit_planned: 48, visited: 58, follow_up: 52, in_progress: 66, hot: 84, negotiation: 80, contract: 88, won: 91,
    signed: 93, onboarding: 90, client: 86, client_far: 78, client_risk: 54, lost: 22, not_now: 45, disqualified: 15
  };
  const score = Math.max(10, Math.min(98, (base[p.scen] ?? 30) + (hash(p.key) % 7) - 3));
  const trend: RelationshipTemperature['trend'] = ['client_risk', 'follow_up', 'lost', 'not_now'].includes(p.scen) ? 'cooling' : score >= 70 ? 'rising' : 'steady';
  const spark = trend === 'cooling' ? [score + 14, score + 11, score + 8, score + 5, score + 2, score] : trend === 'rising' ? [score - 16, score - 12, score - 9, score - 5, score - 2, score] : [score - 3, score - 1, score - 2, score, score - 1, score];
  const first = SHORT[x.interestIds[0]] ?? 'Keyfetch';
  const intent: Record<string, string[]> = {
    hot: ['Asked for sample terms', `Wants ${first} live before month-end`],
    negotiation: ['Reviewing draft terms', 'Asked about training dates'],
    contract: ['Agreement with their controller', 'Asked about the install date'],
    won: ['Said yes on the call', 'Asked when onboarding starts'],
    in_progress: [`Strong interest in ${first}`, 'F&I team asked for a demo'],
    visited: [`Interested in ${first}`],
    follow_up: ['Asked to be called next week'],
    signed: ['Excited to go live', 'Asked for staff training'],
    onboarding: ['First deals went through', 'Asked for menu cards'],
    client: ['Happy with claims turnaround', 'Open to add-ons'],
    client_far: ['Steady account', 'Prefers phone check-ins between visits'],
    not_now: ['Likes the products'],
    client_risk: []
  };
  const hesitation: Record<string, string[]> = {
    follow_up: ['Busy with month-end'],
    not_now: ['Wants to wait for the inventory reset'],
    client_risk: ['No reply to the last two calls', 'Tags not re-hung during the remodel'],
    lost: [x.competitor ? `Chose an alternative: ${x.competitor}` : 'Chose another provider'],
    hot: p.objection ? [p.objection] : [],
    negotiation: p.objection ? [p.objection] : [],
    in_progress: p.objection ? [p.objection] : ['Comparing with the current provider']
  };
  return {
    score,
    trend,
    sparkline: spark.map(v => Math.max(5, Math.min(99, v))),
    intentPhrases: intent[p.scen] ?? [],
    hesitationPhrases: hesitation[p.scen] ?? [],
    ghostingRisk: p.scen === 'client_risk' || (x.daysSince > 25 && score < 60) ? 'high' : score < 60 ? 'medium' : 'low'
  };
}
