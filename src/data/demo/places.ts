// Demo dealerships and dealer groups. All dealership and group names are
// fictional; towns, roads and area codes are real so the map, distance bands,
// time zones and phone numbers look right. Each record has a SCENARIO: the
// story engine (story.ts) turns it into a dated history of visits, calls,
// emails, assists, sign-ups, top-ups and upsells.
//
// Every claimed dealership is inside its rep's 60-mile territory, except:
// - "client_far" accounts (assigned by a manager, visited on trip days)
// - a few Pool records placed in the 60–69 mile tolerance band or beyond,
//   so the distance warnings have something to show.

export type Scenario =
  | 'pool'
  | 'pool_radar'
  | 'claimed'
  | 'visit_planned'
  | 'visited'
  | 'follow_up'
  | 'in_progress'
  | 'hot'
  | 'negotiation'
  | 'contract'
  | 'won'
  | 'signed'
  | 'onboarding'
  | 'client'
  | 'client_risk'
  | 'client_far'
  | 'lost'
  | 'not_now'
  | 'disqualified'
  | 'placeholder';

/** Title codes used for contacts (mapped to the job-title list in people.ts). */
export type TitleCode = 'DP' | 'GM' | 'GSM' | 'FID' | 'FIM' | 'UCM' | 'SVC' | 'BDC' | 'ISM' | 'ADM' | 'MKT' | 'GDO' | 'GFI' | 'REC';

export interface PlacePerson {
  first: string;
  last: string;
  title: TitleCode;
  note?: string;
}

export interface Place {
  key: string;
  name: string;
  brands: string[];
  independent?: boolean;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  area: string; // telephone area code
  cars: number;
  fi: string;
  rep: string | null;
  scen: Scenario;
  group?: string;
  /** Named people for the hero stories (others are generated). */
  people?: PlacePerson[];
  /** Products this dealership cares about (ids). Generated from the profile when absent. */
  interest?: string[];
  /** Products signed (clients / sign-ups). */
  signed?: string[];
  objection?: string;
  competitor?: string;
  /** External referral: [name, company, relationship]. */
  referredBy?: [string, string, string];
  /** Internal referral by a GenZ person. */
  referredByUser?: { userId: string; note: string };
  /** Manager who covered the account before handing it to the rep. */
  transferFrom?: string;
  /** Which manager assisted (defaults to the rep's manager). */
  note?: string;
}

export interface GroupDef {
  id: string;
  name: string;
  domain: string;
  hqAddress: string;
  hqCity: string;
  hqState: string;
  hqZip: string;
  area: string;
  dm: PlacePerson;
  notes: string;
  ownerId: string;
  /** Total rooftops in the group (placeholders make up the difference). */
  rooftops: number;
}

export const GROUPS: GroupDef[] = [
  {
    id: 'grp_commonwealth',
    name: 'Commonwealth Auto Group',
    domain: 'commonwealthautogroup.com',
    hqAddress: '1000 Providence Hwy',
    hqCity: 'Norwood',
    hqState: 'MA',
    hqZip: '02062',
    area: '781',
    dm: { first: 'Richard', last: 'Doyle', title: 'GDO', note: 'Signs off on any product rolled out to more than one store. Prefers a one-page summary before meetings.' },
    notes: 'Family-owned group, four South Shore / North Shore rooftops. Each store GM decides on store-level products; Richard approves group-wide programs.',
    ownerId: 'u_jason',
    rooftops: 4
  },
  {
    id: 'grp_lakeshore',
    name: 'Lakeshore Automotive Group',
    domain: 'lakeshoreauto.com',
    hqAddress: '2100 Swift Dr',
    hqCity: 'Oak Brook',
    hqState: 'IL',
    hqZip: '60523',
    area: '630',
    dm: { first: 'Diane', last: 'Kowalski', title: 'GDO', note: 'Runs group operations. Wants one onboarding plan for all stores, not five separate ones.' },
    notes: 'Five suburban Chicago rooftops. Two stores live, one onboarding, two in progress. Group F&I training happens on the first Tuesday of the month.',
    ownerId: 'u_kevin',
    rooftops: 5
  },
  {
    id: 'grp_piedmont',
    name: 'Piedmont Motor Group',
    domain: 'piedmontmotorgroup.com',
    hqAddress: '1050 Cobb Pkwy S',
    hqCity: 'Marietta',
    hqState: 'GA',
    hqZip: '30060',
    area: '770',
    dm: { first: 'Gregory', last: 'Banks', title: 'GDO', note: 'Negotiated the group agreement. New rooftops join under the same terms.' },
    notes: 'Four north-Atlanta rooftops under one group agreement. Sister stores join under the existing terms.',
    ownerId: 'u_toddb',
    rooftops: 4
  },
  {
    id: 'grp_coastline',
    name: 'Coastline Auto Partners',
    domain: 'coastlineautopartners.com',
    hqAddress: '20800 Hawthorne Blvd',
    hqCity: 'Torrance',
    hqState: 'CA',
    hqZip: '90503',
    area: '310',
    dm: { first: 'Elaine', last: 'Park', title: 'GFI', note: 'Group F&I Director. Data-driven; asks for penetration numbers from similar stores.' },
    notes: 'South Bay / Long Beach group with four rooftops. F&I decisions are made centrally by Elaine Park.',
    ownerId: 'u_toddk',
    rooftops: 4
  },
  {
    id: 'grp_trinity',
    name: 'Trinity Motor Group',
    domain: 'trinitymotorgroup.com',
    hqAddress: '4100 W Airport Fwy',
    hqCity: 'Irving',
    hqState: 'TX',
    hqZip: '75062',
    area: '972',
    dm: { first: 'Ray', last: 'Delgado', title: 'GDO', note: 'Took over group operations in the summer. Open to adding products store by store.' },
    notes: 'DFW group with five rooftops. Three are set up in the CRM; two were added as placeholders until Carlos gets the store details.',
    ownerId: 'u_carlos',
    rooftops: 5
  }
];

const P = (first: string, last: string, title: TitleCode, note?: string): PlacePerson => ({ first, last, title, note });

export const PLACES: Place[] = [
  // ─────────────── NORTHEAST — Kelley Koliopulos (Boston, MA) ───────────────
  {
    key: 'ne_cw_toyota', name: 'Commonwealth Toyota of Norwood', brands: ['Toyota'], group: 'grp_commonwealth',
    street: '1060 Providence Hwy', city: 'Norwood', state: 'MA', zip: '02062', lat: 42.1846, lng: -71.1995, area: '781',
    cars: 165, fi: 'CDK Global', rep: 'u_kelley', scen: 'client',
    people: [P('Paul', 'Medeiros', 'GM', 'Long-standing client contact. Likes a quick text before a drop-in.'), P('Lisa', 'Tran', 'FID'), P('Mike', 'Donnelly', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_4']
  },
  {
    key: 'ne_cw_honda', name: 'Commonwealth Honda of Braintree', brands: ['Honda'], group: 'grp_commonwealth',
    street: '425 Granite St', city: 'Braintree', state: 'MA', zip: '02184', lat: 42.2079, lng: -71.004, area: '781',
    cars: 140, fi: 'Reynolds & Reynolds', rep: 'u_kelley', scen: 'client',
    people: [P('Angela', 'Russo', 'GM'), P('Dev', 'Patel', 'FIM'), P('Shawn', 'Murphy', 'SVC')],
    signed: ['prod_3', 'prod_1', 'prod_5']
  },
  {
    key: 'ne_cw_ford', name: 'Commonwealth Ford of Quincy', brands: ['Ford'], group: 'grp_commonwealth',
    street: '480 Southern Artery', city: 'Quincy', state: 'MA', zip: '02169', lat: 42.2529, lng: -71.0023, area: '617',
    cars: 120, fi: 'DealerTrack', rep: 'u_kelley', scen: 'negotiation',
    people: [P('Sean', 'Walsh', 'GM'), P('Maria', 'Santos', 'FIM')],
    interest: ['prod_3', 'prod_1', 'prod_7'],
    objection: 'Wants the same terms Commonwealth Toyota has, and a training date before month-end.'
  },
  {
    key: 'ne_cw_kia', name: 'Commonwealth Kia of Peabody', brands: ['Kia'], group: 'grp_commonwealth',
    street: '212 Andover St', city: 'Peabody', state: 'MA', zip: '01960', lat: 42.5279, lng: -70.9287, area: '978',
    cars: 95, fi: 'RouteOne', rep: 'u_kelley', scen: 'onboarding',
    people: [P('Brian', 'Costa', 'GM'), P('Nicole', 'Fraser', 'FIM')],
    signed: ['prod_3', 'prod_8']
  },
  {
    key: 'ne_minuteman', name: 'Minuteman Chevrolet', brands: ['Chevrolet'],
    street: '870 Main St', city: 'Waltham', state: 'MA', zip: '02451', lat: 42.3765, lng: -71.2356, area: '781',
    cars: 110, fi: 'Reynolds & Reynolds', rep: 'u_kelley', scen: 'client_risk',
    people: [P('Frank', 'DiNapoli', 'DP', 'Owner. Busy with a showroom remodel since September.'), P('Tracy', 'Morin', 'FIM')],
    signed: ['prod_3', 'prod_1'],
    objection: 'Keyfetch tags not being re-hung after test drives since the remodel started.'
  },
  {
    key: 'ne_goldenmile', name: 'Golden Mile Hyundai', brands: ['Hyundai'],
    street: '100 Worcester Rd', city: 'Framingham', state: 'MA', zip: '01701', lat: 42.2993, lng: -71.416, area: '508',
    cars: 130, fi: 'DealerTrack', rep: 'u_kelley', scen: 'contract',
    people: [P('Stephen', 'Lam', 'GM'), P('Rachel', 'Goldberg', 'FID'), P('Joe', 'Pacheco', 'UCM')],
    interest: ['prod_1', 'prod_3', 'prod_9'],
    objection: 'Rachel wanted written confirmation of the claims turnaround before signing.'
  },
  {
    key: 'ne_blackstone', name: 'Blackstone Valley Subaru', brands: ['Subaru'],
    street: '77 Lincoln St', city: 'Worcester', state: 'MA', zip: '01605', lat: 42.2897, lng: -71.7836, area: '508',
    cars: 105, fi: 'CDK Global', rep: 'u_kelley', scen: 'hot',
    people: [P('Tom', 'Ricci', 'GSM', 'Asked for sample contract terms to show the dealer principal.'), P('Carol', 'Hebert', 'DP'), P('Luis', 'Ferreira', 'UCM')],
    interest: ['prod_1', 'prod_3', 'prod_10'],
    objection: 'Dealer principal wants to see sample terms and how claims are paid before committing.'
  },
  {
    key: 'ne_gatecity', name: 'Gate City Jeep Ram', brands: ['Jeep', 'Ram'],
    street: '332 Amherst St', city: 'Nashua', state: 'NH', zip: '03063', lat: 42.7787, lng: -71.5054, area: '603',
    cars: 90, fi: 'RouteOne', rep: 'u_kelley', scen: 'in_progress',
    interest: ['prod_2', 'prod_3'],
    objection: 'Comparing our Certified Limited Warranty with their current administrator.'
  },
  {
    key: 'ne_oceanstate', name: 'Ocean State Honda', brands: ['Honda'],
    street: '1200 Bald Hill Rd', city: 'Warwick', state: 'RI', zip: '02886', lat: 41.7001, lng: -71.4162, area: '401',
    cars: 125, fi: 'CDK Global', rep: 'u_kelley', scen: 'signed',
    people: [P('Greg', 'Almeida', 'GM'), P('Jenna', 'Rossi', 'FID'), P('Pete', 'Camara', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_10']
  },
  {
    key: 'ne_northshore', name: 'North Shore Auto Sales', brands: [], independent: true,
    street: '96 Newbury St (Route 1 South)', city: 'Danvers', state: 'MA', zip: '01923', lat: 42.5751, lng: -70.95, area: '978',
    cars: 60, fi: 'Other', rep: 'u_kelley', scen: 'visited', interest: ['prod_7', 'prod_5']
  },
  {
    key: 'ne_southshorebmw', name: 'South Shore BMW', brands: ['BMW'],
    street: '1960 Washington St', city: 'Hanover', state: 'MA', zip: '02339', lat: 42.1132, lng: -70.812, area: '781',
    cars: 85, fi: 'CDK Global', rep: 'u_kelley', scen: 'follow_up', interest: ['prod_10', 'prod_8', 'prod_5'],
    referredByUser: { userId: 'u_jason', note: 'Met the GM at the regional dealer association meeting.' }
  },
  {
    key: 'ne_route1', name: 'Route 1 Nissan', brands: ['Nissan'],
    street: '915 Broadway', city: 'Saugus', state: 'MA', zip: '01906', lat: 42.4637, lng: -71.0101, area: '781',
    cars: 115, fi: 'DealerTrack', rep: 'u_kelley', scen: 'claimed'
  },
  {
    key: 'ne_merrimack', name: 'Merrimack Valley Ford', brands: ['Ford'],
    street: '360 Broadway', city: 'Methuen', state: 'MA', zip: '01844', lat: 42.7262, lng: -71.1909, area: '978',
    cars: 140, fi: 'Reynolds & Reynolds', rep: 'u_kelley', scen: 'lost', interest: ['prod_1', 'prod_4'],
    competitor: 'renewed with their current service-contract administrator for 3 more years'
  },
  {
    key: 'ne_cascobay', name: 'Casco Bay Toyota', brands: ['Toyota'],
    street: '1500 Brighton Ave', city: 'Portland', state: 'ME', zip: '04102', lat: 43.6667, lng: -70.3007, area: '207',
    cars: 150, fi: 'CDK Global', rep: 'u_kelley', scen: 'client_far', signed: ['prod_3', 'prod_6'],
    note: 'Outside the 60-mile territory. Assigned by Jason Scott; visited on quarterly trip days.'
  },
  { key: 'ne_baycolony', name: 'Bay Colony Kia', brands: ['Kia'], street: '395 Washington St', city: 'Woburn', state: 'MA', zip: '01801', lat: 42.4793, lng: -71.1523, area: '781', cars: 80, fi: 'RouteOne', rep: null, scen: 'pool_radar' },
  { key: 'ne_pilgrim', name: 'Pilgrim Mazda', brands: ['Mazda'], street: '22 Samoset St', city: 'Plymouth', state: 'MA', zip: '02360', lat: 41.9584, lng: -70.6673, area: '508', cars: 70, fi: 'DealerTrack', rep: null, scen: 'pool' },
  { key: 'ne_wachusett', name: 'Wachusett Auto Mall', brands: [], independent: true, street: '780 N Main St', city: 'Leominster', state: 'MA', zip: '01453', lat: 42.5251, lng: -71.7598, area: '978', cars: 55, fi: 'Other', rep: null, scen: 'pool' },
  { key: 'ne_granite', name: 'Granite State Chevrolet', brands: ['Chevrolet'], street: '1550 S Willow St', city: 'Manchester', state: 'NH', zip: '03103', lat: 42.9563, lng: -71.4381, area: '603', cars: 120, fi: 'CDK Global', rep: null, scen: 'pool' },
  { key: 'ne_capecod', name: 'Cape Cod Ford', brands: ['Ford'], street: '120 Iyannough Rd', city: 'Hyannis', state: 'MA', zip: '02601', lat: 41.6525, lng: -70.2881, area: '508', cars: 95, fi: 'Reynolds & Reynolds', rep: null, scen: 'pool' },
  { key: 'ne_pioneer', name: 'Pioneer Valley Honda', brands: ['Honda'], street: '1400 Boston Rd', city: 'Springfield', state: 'MA', zip: '01129', lat: 42.1345, lng: -72.5065, area: '413', cars: 110, fi: 'DealerTrack', rep: null, scen: 'pool' },

  // ─────────────── MIDWEST — Kevin Houk (Chicago, IL) ───────────────
  {
    key: 'mw_ls_honda', name: 'Lakeshore Honda of Naperville', brands: ['Honda'], group: 'grp_lakeshore',
    street: '1550 W Ogden Ave', city: 'Naperville', state: 'IL', zip: '60540', lat: 41.7686, lng: -88.1882, area: '630',
    cars: 175, fi: 'CDK Global', rep: 'u_kevin', scen: 'client',
    people: [P('Jim', 'Novak', 'GM'), P('Erica', 'Lindgren', 'FID'), P('Andre', 'Wallace', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_4', 'prod_7']
  },
  {
    key: 'mw_ls_ford', name: 'Lakeshore Ford of Schaumburg', brands: ['Ford'], group: 'grp_lakeshore',
    street: '1100 E Golf Rd', city: 'Schaumburg', state: 'IL', zip: '60173', lat: 42.0485, lng: -88.0501, area: '847',
    cars: 210, fi: 'Reynolds & Reynolds', rep: 'u_kevin', scen: 'client',
    people: [P('Mark', 'Brennan', 'GM'), P('Sonia', 'Reyes', 'FIM'), P('Tony', 'Galati', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_10']
  },
  {
    key: 'mw_ls_chevy', name: 'Lakeshore Chevrolet of Orland Park', brands: ['Chevrolet'], group: 'grp_lakeshore',
    street: '8800 W 159th St', city: 'Orland Park', state: 'IL', zip: '60462', lat: 41.6011, lng: -87.8432, area: '708',
    cars: 160, fi: 'CDK Global', rep: 'u_kevin', scen: 'onboarding',
    people: [P('Dan', 'Kozlowski', 'GM'), P('Heather', 'Price', 'FID')],
    signed: ['prod_3', 'prod_1', 'prod_4']
  },
  {
    key: 'mw_ls_kia', name: 'Lakeshore Kia of Joliet', brands: ['Kia'], group: 'grp_lakeshore',
    street: '2501 W Jefferson St', city: 'Joliet', state: 'IL', zip: '60435', lat: 41.5214, lng: -88.1385, area: '815',
    cars: 95, fi: 'DealerTrack', rep: 'u_kevin', scen: 'negotiation',
    people: [P('Ryan', 'Schultz', 'GM'), P('Megan', 'Hart', 'FIM')],
    interest: ['prod_3', 'prod_8', 'prod_9'],
    objection: 'Wants Diane Kowalski to approve before signing; asked for the group rollout plan.'
  },
  {
    key: 'mw_ls_hyundai', name: 'Lakeshore Hyundai of Elgin', brands: ['Hyundai'], group: 'grp_lakeshore',
    street: '1200 S Randall Rd', city: 'Elgin', state: 'IL', zip: '60123', lat: 42.0198, lng: -88.3387, area: '847',
    cars: 120, fi: 'RouteOne', rep: 'u_kevin', scen: 'won',
    people: [P('Chris', 'Bauer', 'GM'), P('Alicia', 'Moreno', 'FIM')],
    interest: ['prod_3', 'prod_1', 'prod_9']
  },
  {
    key: 'mw_goldcoast', name: 'Gold Coast Lexus', brands: ['Lexus'],
    street: '1150 W Division St', city: 'Chicago', state: 'IL', zip: '60642', lat: 41.9036, lng: -87.6568, area: '312',
    cars: 130, fi: 'CDK Global', rep: 'u_kevin', scen: 'client',
    people: [P('Victoria', 'Hale', 'GM'), P('Marcus', 'Bell', 'FID')],
    signed: ['prod_3', 'prod_10', 'prod_5']
  },
  {
    key: 'mw_prairie', name: 'Prairie State Subaru', brands: ['Subaru'],
    street: '4300 E New York St', city: 'Aurora', state: 'IL', zip: '60504', lat: 41.7616, lng: -88.2386, area: '630',
    cars: 105, fi: 'DealerTrack', rep: 'u_kevin', scen: 'client', signed: ['prod_3', 'prod_1']
  },
  {
    key: 'mw_nwcdjr', name: 'Northwest Chrysler Dodge Jeep Ram', brands: ['Chrysler', 'Dodge', 'Jeep', 'Ram'],
    street: '1400 E Rand Rd', city: 'Arlington Heights', state: 'IL', zip: '60004', lat: 42.0975, lng: -87.9638, area: '847',
    cars: 140, fi: 'Reynolds & Reynolds', rep: 'u_kevin', scen: 'hot', interest: ['prod_3', 'prod_1', 'prod_7'],
    objection: 'GM is ready; waiting on the dealer principal to free up 30 minutes.'
  },
  { key: 'mw_kenosha', name: 'Kenosha Auto Center', brands: [], independent: true, street: '7100 Green Bay Rd', city: 'Kenosha', state: 'WI', zip: '53142', lat: 42.5651, lng: -87.8718, area: '262', cars: 70, fi: 'Other', rep: 'u_kevin', scen: 'in_progress', interest: ['prod_7', 'prod_2'] },
  { key: 'mw_midway', name: 'Midway Nissan', brands: ['Nissan'], street: '6300 S Cicero Ave', city: 'Chicago', state: 'IL', zip: '60638', lat: 41.7769, lng: -87.7426, area: '773', cars: 150, fi: 'DealerTrack', rep: 'u_kevin', scen: 'visited' },
  {
    key: 'mw_foxvalley', name: 'Fox Valley Mazda', brands: ['Mazda'], street: '2400 E Main St', city: 'St. Charles', state: 'IL', zip: '60174', lat: 41.9137, lng: -88.2826, area: '630', cars: 85, fi: 'CDK Global', rep: 'u_kevin', scen: 'follow_up',
    referredBy: ['Jim Novak', 'Lakeshore Honda of Naperville', 'GM at an existing client; plays in the same golf league']
  },
  { key: 'mw_hoosier', name: 'Hoosier Motors', brands: [], independent: true, street: '1850 E 81st Ave', city: 'Merrillville', state: 'IN', zip: '46410', lat: 41.4689, lng: -87.3049, area: '219', cars: 55, fi: 'Automate DMS', rep: 'u_kevin', scen: 'not_now' },
  { key: 'mw_calumet', name: 'Calumet Wholesale Autos', brands: [], independent: true, street: '4400 Calumet Ave', city: 'Hammond', state: 'IN', zip: '46327', lat: 41.6342, lng: -87.5099, area: '219', cars: 40, fi: 'Other', rep: 'u_kevin', scen: 'disqualified' },
  { key: 'mw_lakecounty', name: 'Lake County Volkswagen', brands: ['Volkswagen'], street: '1001 S Milwaukee Ave', city: 'Libertyville', state: 'IL', zip: '60048', lat: 42.2689, lng: -87.9578, area: '847', cars: 90, fi: 'Reynolds & Reynolds', rep: 'u_kevin', scen: 'visit_planned' },
  { key: 'mw_windycity', name: 'Windy City Kia', brands: ['Kia'], street: '3900 N Elston Ave', city: 'Chicago', state: 'IL', zip: '60618', lat: 41.9532, lng: -87.7178, area: '773', cars: 85, fi: 'RouteOne', rep: null, scen: 'pool' },
  { key: 'mw_dupage', name: 'DuPage Hyundai', brands: ['Hyundai'], street: '1500 Ogden Ave', city: 'Downers Grove', state: 'IL', zip: '60515', lat: 41.8061, lng: -88.0384, area: '630', cars: 100, fi: 'DealerTrack', rep: null, scen: 'pool_radar' },
  { key: 'mw_tristate', name: 'Tri-State Toyota', brands: ['Toyota'], street: '1200 US-41', city: 'Schererville', state: 'IN', zip: '46375', lat: 41.4893, lng: -87.4548, area: '219', cars: 130, fi: 'CDK Global', rep: null, scen: 'pool' },
  { key: 'mw_racine', name: 'Root River Ford', brands: ['Ford'], street: '5500 Durand Ave', city: 'Racine', state: 'WI', zip: '53406', lat: 42.6996, lng: -87.8644, area: '262', cars: 110, fi: 'Reynolds & Reynolds', rep: null, scen: 'pool' },
  { key: 'mw_rockford', name: 'Rock River Honda', brands: ['Honda'], street: '6800 E State St', city: 'Rockford', state: 'IL', zip: '61108', lat: 42.2668, lng: -88.9906, area: '815', cars: 115, fi: 'DealerTrack', rep: null, scen: 'pool' },

  // ─────────────── SOUTHEAST — Todd Bilius (Atlanta, GA) ───────────────
  {
    key: 'se_pd_toyota', name: 'Piedmont Toyota of Marietta', brands: ['Toyota'], group: 'grp_piedmont',
    street: '1100 Cobb Pkwy S', city: 'Marietta', state: 'GA', zip: '30060', lat: 33.9288, lng: -84.5095, area: '770',
    cars: 190, fi: 'CDK Global', rep: 'u_toddb', scen: 'client',
    people: [P('Derrick', 'Owens', 'GM'), P('Tamika', 'Jordan', 'FID'), P('Wes', 'Harper', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_4']
  },
  {
    key: 'se_pd_honda', name: 'Piedmont Honda of Kennesaw', brands: ['Honda'], group: 'grp_piedmont',
    street: '2540 Barrett Lakes Blvd', city: 'Kennesaw', state: 'GA', zip: '30144', lat: 34.0177, lng: -84.5664, area: '770',
    cars: 160, fi: 'Reynolds & Reynolds', rep: 'u_toddb', scen: 'client',
    people: [P('Lance', 'Whitfield', 'GM'), P('Kim', 'Nguyen', 'FIM')],
    signed: ['prod_3', 'prod_1', 'prod_6']
  },
  {
    key: 'se_pd_nissan', name: 'Piedmont Nissan of Alpharetta', brands: ['Nissan'], group: 'grp_piedmont',
    street: '11200 Alpharetta Hwy', city: 'Alpharetta', state: 'GA', zip: '30009', lat: 34.0657, lng: -84.2943, area: '678',
    cars: 130, fi: 'DealerTrack', rep: 'u_toddb', scen: 'signed',
    people: [P('Bobby', 'Sanders', 'GM'), P('Crystal', 'Webb', 'FIM')],
    signed: ['prod_3', 'prod_1', 'prod_10']
  },
  {
    key: 'se_pd_kia', name: 'Piedmont Kia of Duluth', brands: ['Kia'], group: 'grp_piedmont',
    street: '3500 Pleasant Hill Rd', city: 'Duluth', state: 'GA', zip: '30096', lat: 33.9801, lng: -84.1484, area: '678',
    cars: 100, fi: 'RouteOne', rep: 'u_toddb', scen: 'contract',
    people: [P('Nate', 'Coleridge', 'GM'), P('Priya', 'Shah', 'FIM')],
    interest: ['prod_3', 'prod_8', 'prod_4']
  },
  {
    key: 'se_peachtree', name: 'Peachtree Industrial Ford', brands: ['Ford'],
    street: '5900 Peachtree Industrial Blvd', city: 'Doraville', state: 'GA', zip: '30340', lat: 33.9039, lng: -84.2747, area: '770',
    cars: 175, fi: 'CDK Global', rep: 'u_toddb', scen: 'client', signed: ['prod_3', 'prod_1', 'prod_5']
  },
  {
    key: 'se_stonemtn', name: 'Stone Mountain Chevrolet', brands: ['Chevrolet'],
    street: '2600 Scenic Hwy S', city: 'Snellville', state: 'GA', zip: '30078', lat: 33.8461, lng: -84.0128, area: '770',
    cars: 140, fi: 'Reynolds & Reynolds', rep: 'u_toddb', scen: 'client', signed: ['prod_3', 'prod_1'],
    people: [P('Earl', 'Simmons', 'DP'), P('Rhonda', 'Givens', 'FIM')]
  },
  {
    key: 'se_crescent', name: 'Southern Crescent Hyundai', brands: ['Hyundai'],
    street: '1500 Mt Zion Blvd', city: 'Morrow', state: 'GA', zip: '30260', lat: 33.5545, lng: -84.3292, area: '770',
    cars: 120, fi: 'DealerTrack', rep: 'u_toddb', scen: 'hot',
    people: [P('Andre', 'Fulton', 'GM'), P('Lakisha', 'Moore', 'FIM')],
    interest: ['prod_1', 'prod_9', 'prod_3'],
    objection: 'Wants the EV readiness piece explained before Hyundai’s new EV allocation lands.'
  },
  { key: 'se_gwinnett', name: 'Gwinnett Subaru', brands: ['Subaru'], street: '3400 Mall of Georgia Blvd', city: 'Buford', state: 'GA', zip: '30519', lat: 34.0663, lng: -83.9878, area: '678', cars: 95, fi: 'CDK Global', rep: 'u_toddb', scen: 'in_progress', interest: ['prod_3', 'prod_10'] },
  { key: 'se_fayette', name: 'Fayette Auto Exchange', brands: [], independent: true, street: '720 N Glynn St', city: 'Fayetteville', state: 'GA', zip: '30214', lat: 33.4637, lng: -84.4557, area: '770', cars: 65, fi: 'Other', rep: 'u_toddb', scen: 'visited' },
  { key: 'se_chattahoochee', name: 'Chattahoochee Mazda', brands: ['Mazda'], street: '1100 Holcomb Bridge Rd', city: 'Roswell', state: 'GA', zip: '30076', lat: 34.0154, lng: -84.3302, area: '770', cars: 85, fi: 'CDK Global', rep: 'u_toddb', scen: 'follow_up' },
  { key: 'se_lanier', name: 'Lake Lanier Jeep', brands: ['Jeep', 'Ram'], street: '2050 Browns Bridge Rd', city: 'Gainesville', state: 'GA', zip: '30501', lat: 34.3002, lng: -83.8697, area: '770', cars: 110, fi: 'RouteOne', rep: 'u_toddb', scen: 'claimed' },
  { key: 'se_cobbvw', name: 'Cobb County Volkswagen', brands: ['Volkswagen'], street: '2700 Cobb Pkwy SE', city: 'Smyrna', state: 'GA', zip: '30080', lat: 33.8726, lng: -84.4801, area: '770', cars: 80, fi: 'DealerTrack', rep: 'u_toddb', scen: 'lost', interest: ['prod_3'], competitor: 'chose a cheaper key-tracking system bundled with their DMS' },
  {
    key: 'se_scenic', name: 'Scenic City Toyota', brands: ['Toyota'], street: '7200 Lee Hwy', city: 'Chattanooga', state: 'TN', zip: '37421', lat: 35.0436, lng: -85.1555, area: '423', cars: 145, fi: 'CDK Global', rep: 'u_toddb', scen: 'client_far', signed: ['prod_3', 'prod_1'],
    note: 'Outside the 60-mile territory. Assigned by Jose Matos; visited on trip days.'
  },
  { key: 'se_henry', name: 'Henry County Ford', brands: ['Ford'], street: '1700 Hwy 20 W', city: 'McDonough', state: 'GA', zip: '30253', lat: 33.4573, lng: -84.1727, area: '678', cars: 130, fi: 'Reynolds & Reynolds', rep: null, scen: 'pool' },
  { key: 'se_conyers', name: 'Rockdale Honda', brands: ['Honda'], street: '1600 Iris Dr SE', city: 'Conyers', state: 'GA', zip: '30013', lat: 33.6627, lng: -84.0106, area: '770', cars: 105, fi: 'CDK Global', rep: null, scen: 'pool_radar' },
  { key: 'se_athens', name: 'Classic City Chevrolet', brands: ['Chevrolet'], street: '3000 Atlanta Hwy', city: 'Athens', state: 'GA', zip: '30606', lat: 33.9302, lng: -83.4422, area: '706', cars: 115, fi: 'DealerTrack', rep: null, scen: 'pool' },
  { key: 'se_macon', name: 'Middle Georgia Motor Mile', brands: [], independent: true, street: '4400 Riverside Dr', city: 'Macon', state: 'GA', zip: '31210', lat: 32.8807, lng: -83.6863, area: '478', cars: 75, fi: 'Other', rep: null, scen: 'pool' },

  // ─────────────── WEST — Todd Kelly (Beverly Hills, CA) ───────────────
  {
    key: 'w_cl_toyota', name: 'Coastline Toyota of Torrance', brands: ['Toyota'], group: 'grp_coastline',
    street: '20900 Hawthorne Blvd', city: 'Torrance', state: 'CA', zip: '90503', lat: 33.8396, lng: -118.3528, area: '310',
    cars: 220, fi: 'CDK Global', rep: 'u_toddk', scen: 'client',
    people: [P('Glenn', 'Matsuda', 'GM'), P('Rosa', 'Herrera', 'FIM'), P('Kyle', 'Brandt', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_5', 'prod_8']
  },
  {
    key: 'w_cl_honda', name: 'Coastline Honda of Long Beach', brands: ['Honda'], group: 'grp_coastline',
    street: '2900 Cherry Ave', city: 'Long Beach', state: 'CA', zip: '90755', lat: 33.8126, lng: -118.1677, area: '562',
    cars: 180, fi: 'Reynolds & Reynolds', rep: 'u_toddk', scen: 'client', signed: ['prod_3', 'prod_1']
  },
  {
    key: 'w_cl_hyundai', name: 'Coastline Hyundai of Cerritos', brands: ['Hyundai'], group: 'grp_coastline',
    street: '18800 Studebaker Rd', city: 'Cerritos', state: 'CA', zip: '90703', lat: 33.8641, lng: -118.1015, area: '562',
    cars: 150, fi: 'DealerTrack', rep: 'u_toddk', scen: 'onboarding',
    people: [P('Steve', 'Kang', 'GM'), P('Monica', 'Alvarez', 'FIM')],
    signed: ['prod_3', 'prod_9', 'prod_1']
  },
  {
    key: 'w_cl_kia', name: 'Coastline Kia of Carson', brands: ['Kia'], group: 'grp_coastline',
    street: '22100 S Avalon Blvd', city: 'Carson', state: 'CA', zip: '90745', lat: 33.8318, lng: -118.2648, area: '310',
    cars: 110, fi: 'RouteOne', rep: 'u_toddk', scen: 'negotiation', interest: ['prod_3', 'prod_8', 'prod_4'],
    objection: 'Elaine Park wants penetration numbers from the Torrance store before approving.'
  },
  { key: 'w_westside', name: 'Westside BMW', brands: ['BMW'], street: '1700 Santa Monica Blvd', city: 'Santa Monica', state: 'CA', zip: '90404', lat: 34.0281, lng: -118.4785, area: '310', cars: 95, fi: 'CDK Global', rep: 'u_toddk', scen: 'client', signed: ['prod_3', 'prod_10'] },
  {
    key: 'w_valleycrest', name: 'Valley Crest Ford', brands: ['Ford'], street: '6200 Van Nuys Blvd', city: 'Van Nuys', state: 'CA', zip: '91401', lat: 34.1781, lng: -118.4487, area: '818', cars: 200, fi: 'Reynolds & Reynolds', rep: 'u_toddk', scen: 'hot',
    people: [P('Mark', 'Delaney', 'GM', 'Already agreed the terms verbally; needs the paperwork.'), P('Jasmine', 'Cole', 'FID')],
    interest: ['prod_3', 'prod_1', 'prod_7']
  },
  { key: 'w_pasadena', name: 'Pasadena Pacific Subaru', brands: ['Subaru'], street: '3200 E Colorado Blvd', city: 'Pasadena', state: 'CA', zip: '91107', lat: 34.1463, lng: -118.0927, area: '626', cars: 100, fi: 'CDK Global', rep: 'u_toddk', scen: 'in_progress', interest: ['prod_10', 'prod_3'] },
  { key: 'w_brand', name: 'Brand Boulevard Nissan', brands: ['Nissan'], street: '1000 S Brand Blvd', city: 'Glendale', state: 'CA', zip: '91204', lat: 34.1361, lng: -118.2555, area: '818', cars: 140, fi: 'DealerTrack', rep: 'u_toddk', scen: 'in_progress', interest: ['prod_1', 'prod_4'] },
  { key: 'w_inland', name: 'Inland Empire Auto Plaza', brands: [], independent: true, street: '1200 S Grove Ave', city: 'Ontario', state: 'CA', zip: '91761', lat: 34.0485, lng: -117.6187, area: '909', cars: 75, fi: 'Other', rep: 'u_toddk', scen: 'visited' },
  { key: 'w_southbay', name: 'South Bay Mazda', brands: ['Mazda'], street: '1800 Pacific Coast Hwy', city: 'Redondo Beach', state: 'CA', zip: '90277', lat: 33.8288, lng: -118.3865, area: '310', cars: 80, fi: 'CDK Global', rep: 'u_toddk', scen: 'visited' },
  { key: 'w_orangecoast', name: 'Orange Coast Chevrolet', brands: ['Chevrolet'], street: '2600 Harbor Blvd', city: 'Costa Mesa', state: 'CA', zip: '92626', lat: 33.6762, lng: -117.9187, area: '714', cars: 160, fi: 'Reynolds & Reynolds', rep: 'u_toddk', scen: 'follow_up' },
  { key: 'w_malibu', name: 'Conejo Valley Jeep', brands: ['Jeep', 'Ram'], street: '3800 E Thousand Oaks Blvd', city: 'Thousand Oaks', state: 'CA', zip: '91362', lat: 34.1557, lng: -118.8199, area: '805', cars: 90, fi: 'RouteOne', rep: 'u_toddk', scen: 'not_now' },
  { key: 'w_burbank', name: 'Burbank Volkswagen', brands: ['Volkswagen'], street: '900 N San Fernando Blvd', city: 'Burbank', state: 'CA', zip: '91502', lat: 34.1844, lng: -118.3109, area: '818', cars: 85, fi: 'DealerTrack', rep: 'u_toddk', scen: 'claimed' },
  { key: 'w_gateway', name: 'Gateway Cities Toyota', brands: ['Toyota'], street: '9500 Firestone Blvd', city: 'Downey', state: 'CA', zip: '90241', lat: 33.9401, lng: -118.1332, area: '562', cars: 170, fi: 'CDK Global', rep: null, scen: 'pool' },
  { key: 'w_foothill', name: 'Foothill Kia', brands: ['Kia'], street: '1500 S Mountain Ave', city: 'Monrovia', state: 'CA', zip: '91016', lat: 34.1311, lng: -117.9962, area: '626', cars: 90, fi: 'RouteOne', rep: null, scen: 'pool_radar' },
  { key: 'w_ventura', name: 'Ventura Coast Honda', brands: ['Honda'], street: '6000 Auto Center Dr', city: 'Ventura', state: 'CA', zip: '93003', lat: 34.2614, lng: -119.2115, area: '805', cars: 120, fi: 'DealerTrack', rep: null, scen: 'pool' },
  { key: 'w_temecula', name: 'Temecula Valley Ford', brands: ['Ford'], street: '40500 Temecula Center Dr', city: 'Temecula', state: 'CA', zip: '92591', lat: 33.5073, lng: -117.1478, area: '951', cars: 140, fi: 'Reynolds & Reynolds', rep: null, scen: 'pool' },

  // ─────────────── TEXAS — Carlos Martinez (Dallas, TX) ───────────────
  {
    key: 'tx_tr_toyota', name: 'Trinity Toyota of Irving', brands: ['Toyota'], group: 'grp_trinity',
    street: '4200 W Airport Fwy', city: 'Irving', state: 'TX', zip: '75062', lat: 32.8371, lng: -97.0125, area: '972',
    cars: 210, fi: 'CDK Global', rep: 'u_carlos', scen: 'client', transferFrom: 'u_jose',
    people: [P('Hector', 'Villarreal', 'GM'), P('Brenda', 'Okafor', 'FID'), P('Cody', 'Wyatt', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_4']
  },
  {
    key: 'tx_tr_honda', name: 'Trinity Honda of Grapevine', brands: ['Honda'], group: 'grp_trinity',
    street: '1300 State Hwy 114', city: 'Grapevine', state: 'TX', zip: '76051', lat: 32.9304, lng: -97.0858, area: '817',
    cars: 170, fi: 'Reynolds & Reynolds', rep: 'u_carlos', scen: 'signed',
    people: [P('Rick', 'Pruitt', 'GM'), P('Yesenia', 'Garza', 'FIM'), P('Brandon', 'Tate', 'UCM')],
    signed: ['prod_3', 'prod_1', 'prod_9']
  },
  {
    key: 'tx_tr_ford', name: 'Trinity Ford of Arlington', brands: ['Ford'], group: 'grp_trinity',
    street: '1500 N Collins St', city: 'Arlington', state: 'TX', zip: '76011', lat: 32.7514, lng: -97.0912, area: '817',
    cars: 160, fi: 'DealerTrack', rep: 'u_carlos', scen: 'hot',
    people: [P('Dwayne', 'Mitchell', 'GM'), P('Carla', 'Benavides', 'FIM')],
    interest: ['prod_3', 'prod_1', 'prod_10'],
    objection: 'Dwayne wants a manager on the call to confirm training for the night F&I shift.'
  },
  { key: 'tx_tr_ph4', name: 'Trinity Motor Group — Rooftop 4 (details needed)', brands: [], group: 'grp_trinity', street: '', city: 'Irving', state: 'TX', zip: '75062', lat: 32.8371, lng: -97.0125, area: '972', cars: 0, fi: 'Other', rep: 'u_carlos', scen: 'placeholder' },
  { key: 'tx_tr_ph5', name: 'Trinity Motor Group — Rooftop 5 (details needed)', brands: [], group: 'grp_trinity', street: '', city: 'Irving', state: 'TX', zip: '75062', lat: 32.8371, lng: -97.0125, area: '972', cars: 0, fi: 'Other', rep: 'u_carlos', scen: 'placeholder' },
  {
    key: 'tx_bigtex', name: 'Big Tex Chevrolet', brands: ['Chevrolet'], street: '18700 LBJ Fwy', city: 'Mesquite', state: 'TX', zip: '75150', lat: 32.8064, lng: -96.6267, area: '972',
    cars: 180, fi: 'CDK Global', rep: 'u_carlos', scen: 'client', transferFrom: 'u_jose',
    people: [P('Wayne', 'Holcomb', 'DP'), P('Marco', 'Ruiz', 'UCM', 'Referred Carlos to Oak Cliff Auto Outlet.')],
    signed: ['prod_3', 'prod_1']
  },
  { key: 'tx_prairiecreek', name: 'Prairie Creek Hyundai', brands: ['Hyundai'], street: '6800 Dallas Pkwy', city: 'Plano', state: 'TX', zip: '75024', lat: 33.0748, lng: -96.8224, area: '972', cars: 130, fi: 'DealerTrack', rep: 'u_carlos', scen: 'in_progress', interest: ['prod_9', 'prod_8', 'prod_3'] },
  { key: 'tx_whiterock', name: 'White Rock Nissan', brands: ['Nissan'], street: '2000 Northwest Hwy', city: 'Garland', state: 'TX', zip: '75041', lat: 32.8776, lng: -96.6464, area: '972', cars: 120, fi: 'Reynolds & Reynolds', rep: 'u_carlos', scen: 'visited' },
  { key: 'tx_stockyards', name: 'Stockyards Kia', brands: ['Kia'], street: '2900 N Main St', city: 'Fort Worth', state: 'TX', zip: '76164', lat: 32.7887, lng: -97.3465, area: '817', cars: 100, fi: 'RouteOne', rep: 'u_carlos', scen: 'visited' },
  { key: 'tx_denton', name: 'Denton County Mazda', brands: ['Mazda'], street: '4000 S Interstate 35 E', city: 'Denton', state: 'TX', zip: '76210', lat: 33.1676, lng: -97.0951, area: '940', cars: 75, fi: 'CDK Global', rep: 'u_carlos', scen: 'follow_up' },
  { key: 'tx_rockwall', name: 'Rockwall Lake Subaru', brands: ['Subaru'], street: '1100 E Interstate 30', city: 'Rockwall', state: 'TX', zip: '75087', lat: 32.9017, lng: -96.4597, area: '972', cars: 90, fi: 'DealerTrack', rep: 'u_carlos', scen: 'visit_planned' },
  {
    key: 'tx_oakcliff', name: 'Oak Cliff Auto Outlet', brands: [], independent: true, street: '2400 W Illinois Ave', city: 'Dallas', state: 'TX', zip: '75224', lat: 32.7246, lng: -96.8592, area: '214', cars: 55, fi: 'Other', rep: 'u_carlos', scen: 'claimed',
    referredBy: ['Marco Ruiz', 'Big Tex Chevrolet', 'Used Car Manager at an existing client; buys trade-ins from them']
  },
  { key: 'tx_mckinney', name: 'McKinney Volkswagen', brands: ['Volkswagen'], street: '700 N Central Expy', city: 'McKinney', state: 'TX', zip: '75070', lat: 33.2035, lng: -96.6305, area: '972', cars: 85, fi: 'CDK Global', rep: 'u_carlos', scen: 'visit_planned' },
  { key: 'tx_waxahachie', name: 'Ellis County Ford', brands: ['Ford'], street: '2000 N Interstate 35 E', city: 'Waxahachie', state: 'TX', zip: '75165', lat: 32.4185, lng: -96.8431, area: '972', cars: 95, fi: 'Reynolds & Reynolds', rep: 'u_carlos', scen: 'not_now' },
  { key: 'tx_frisco', name: 'Frisco Station Toyota', brands: ['Toyota'], street: '9500 State Hwy 121', city: 'Frisco', state: 'TX', zip: '75035', lat: 33.1277, lng: -96.7864, area: '972', cars: 160, fi: 'CDK Global', rep: null, scen: 'pool' },
  { key: 'tx_cedarhill', name: 'Cedar Hill Honda', brands: ['Honda'], street: '500 E Hwy 67', city: 'Cedar Hill', state: 'TX', zip: '75104', lat: 32.5885, lng: -96.9561, area: '972', cars: 110, fi: 'Reynolds & Reynolds', rep: null, scen: 'pool_radar' },
  { key: 'tx_weatherford', name: 'Parker County Chevrolet', brands: ['Chevrolet'], street: '1800 S Main St', city: 'Weatherford', state: 'TX', zip: '76086', lat: 32.7393, lng: -97.7973, area: '817', cars: 120, fi: 'DealerTrack', rep: null, scen: 'pool' },
  { key: 'tx_gainesville', name: 'Red River Ford', brands: ['Ford'], street: '1400 N Interstate 35', city: 'Gainesville', state: 'TX', zip: '76240', lat: 33.6459, lng: -97.1515, area: '940', cars: 85, fi: 'RouteOne', rep: null, scen: 'pool' },
  { key: 'tx_waco', name: 'Brazos Valley Motor Plaza', brands: [], independent: true, street: '4400 Franklin Ave', city: 'Waco', state: 'TX', zip: '76710', lat: 31.5313, lng: -97.1823, area: '254', cars: 70, fi: 'Other', rep: null, scen: 'pool' }
];
