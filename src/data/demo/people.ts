// Dealership contacts for the demo. Named people from places.ts are used as
// given; the rest are generated from name pools so every dealership has
// believable, unique people. Staff surnames are never reused, so a contact
// can't be confused with a GenZ team member.

import type { Contact } from '../../types/crm';
import type { Place, PlacePerson, TitleCode } from './places';

export const TITLE: Record<TitleCode, string> = {
  DP: 'Dealer Principal / Owner',
  GM: 'General Manager (GM)',
  GSM: 'General Sales Manager (GSM)',
  FID: 'F&I Director / Finance Director',
  FIM: 'Finance and Insurance (F&I) Manager',
  UCM: 'Used Car Manager / Pre-owned Director',
  SVC: 'Aftersales Manager / Service Director',
  BDC: 'BDC Representative (Business Development Centre)',
  ISM: 'Internet Sales Manager / Digital Concierge',
  ADM: 'Sales Administrator',
  MKT: 'Marketing / Social Media Manager',
  GDO: 'Group Director of Operations',
  GFI: 'Group F&I Director',
  REC: 'Receptionist'
};

export const SHORT_TITLE: Record<TitleCode, string> = {
  DP: 'dealer principal',
  GM: 'GM',
  GSM: 'GSM',
  FID: 'F&I director',
  FIM: 'F&I manager',
  UCM: 'used car manager',
  SVC: 'service director',
  BDC: 'BDC rep',
  ISM: 'internet sales manager',
  ADM: 'sales administrator',
  MKT: 'marketing manager',
  GDO: 'group director of operations',
  GFI: 'group F&I director',
  REC: 'receptionist'
};

const DM_CODES: TitleCode[] = ['DP', 'GM', 'GSM', 'FID', 'FIM', 'GDO', 'GFI'];
export const isDMCode = (c: TitleCode) => DM_CODES.includes(c);

const FIRST = [
  'Aaron', 'Adriana', 'Alan', 'Alexis', 'Amir', 'Ashley', 'Ben', 'Bianca', 'Brett', 'Caleb', 'Camille', 'Cesar', 'Chad', 'Dana', 'Darnell',
  'Deborah', 'Diego', 'Donovan', 'Elena', 'Eli', 'Emily', 'Evan', 'Felicia', 'Gabe', 'Gina', 'Grant', 'Holly', 'Isaac', 'Ivy', 'Jake',
  'Janelle', 'Jared', 'Joanna', 'Jorge', 'Justin', 'Kara', 'Keith', 'Kendra', 'Kurt', 'Laura', 'Leon', 'Mandy', 'Manny', 'Marisol', 'Matt',
  'Melissa', 'Miguel', 'Natalie', 'Neil', 'Omar', 'Pam', 'Quinn', 'Ramon', 'Renee', 'Rob', 'Sabrina', 'Sam', 'Sergio', 'Shannon', 'Terrence',
  'Tiffany', 'Travis', 'Trent', 'Valerie', 'Vince', 'Whitney', 'Xavier', 'Yolanda', 'Zach', 'Carmen', 'Doug', 'Lena', 'Phil', 'Rita', 'Stan'
];
const LAST = [
  'Abbott', 'Acosta', 'Barrett', 'Becker', 'Bishop', 'Boyd', 'Calloway', 'Cardenas', 'Chen', 'Conway', 'Crawford', 'Dawson', 'Delgado', 'Duffy',
  'Ellis', 'Espinoza', 'Fitzgerald', 'Fleming', 'Gallagher', 'Grant', 'Greene', 'Guerrero', 'Hammond', 'Hayes', 'Hobbs', 'Ingram', 'Jensen',
  'Keller', 'Kim', 'Larson', 'Lowe', 'Lucero', 'Maddox', 'Malone', 'McBride', 'Mendez', 'Morrow', 'Nash', 'Navarro', 'Ochoa', 'Padilla',
  'Parsons', 'Pham', 'Quinlan', 'Ramsey', 'Rhodes', 'Rios', 'Salazar', 'Schaefer', 'Sloan', 'Soto', 'Stratton', 'Sutton', 'Thornton',
  'Underwood', 'Vasquez', 'Vaughn', 'Wagner', 'Warren', 'Weber', 'Whitaker', 'Wilkins', 'Yates', 'Zamora', 'Brooks', 'Fischer', 'Hughes'
];

/** Deterministic hash of a string → non-negative integer. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Contact roles to generate for a dealership, by scenario and type. */
function rolesFor(p: Place): TitleCode[] {
  const early = ['claimed', 'visit_planned'].includes(p.scen);
  if (p.scen === 'pool' || p.scen === 'pool_radar' || p.scen === 'placeholder') return [];
  if (p.independent) return early ? ['DP'] : ['DP', 'ADM'];
  if (early) return ['GSM'];
  const rich = ['client', 'client_far', 'client_risk', 'onboarding', 'signed', 'contract', 'won', 'negotiation', 'hot'].includes(p.scen);
  return rich ? ['GM', 'FIM', 'UCM'] : ['GM', 'UCM'];
}

const NOTE_BY_TITLE: Partial<Record<TitleCode, string[]>> = {
  DP: ['Owner-operator; makes every product decision personally.', 'Signs contracts. Best reached mid-morning.'],
  GM: ['Final say on store-level products.', 'Prefers short visits with one clear ask.', 'Reads email on his phone between deals; text first.'],
  GSM: ['Runs the sales floor; good first contact.', 'Gatekeeper to the GM — keep him in the loop.'],
  FID: ['Owns the F&I menu and product mix.', 'Cares about penetration and claims turnaround.'],
  FIM: ['Day-to-day F&I contact; sees the menu every deal.', 'Will pilot new products on her desk first.'],
  UCM: ['Manages the pre-owned lot and key board.', 'Good source for lot counts and turn rates.'],
  ADM: ['Handles paperwork and orders.'],
  SVC: ['Service drive contact for maintenance plans.']
};

export function buildContacts(
  places: Place[],
  idOf: (key: string) => string,
  domainOf: (key: string) => string,
  phoneOf: (key: string, ext: number) => string,
  createdAt: (key: string) => string,
  createdBy: (key: string) => string | undefined
): { contacts: Contact[]; byPlace: Record<string, Contact[]> } {
  const used = new Set<string>();
  let cursor = 0;
  const nextName = (seed: number): [string, string] => {
    for (let tries = 0; tries < 500; tries++) {
      const f = FIRST[(seed + cursor * 7) % FIRST.length];
      const l = LAST[(seed * 3 + cursor * 11) % LAST.length];
      cursor++;
      const key = `${f} ${l}`;
      if (!used.has(key)) {
        used.add(key);
        return [f, l];
      }
    }
    return ['Alex', `Contact${cursor}`];
  };
  places.forEach(p => (p.people ?? []).forEach(pp => used.add(`${pp.first} ${pp.last}`)));

  const contacts: Contact[] = [];
  const byPlace: Record<string, Contact[]> = {};
  places.forEach(p => {
    const people: PlacePerson[] = p.people ? [...p.people] : rolesFor(p).map((title, i) => {
      const [first, last] = nextName(hash(p.key) + i * 13);
      return { first, last, title };
    });
    const list = people.map((pp, i): Contact => {
      const notes = pp.note ?? (NOTE_BY_TITLE[pp.title] ?? [''])[hash(p.key + i) % (NOTE_BY_TITLE[pp.title]?.length ?? 1)];
      return {
        id: `cont_${idOf(p.key)}_${i + 1}`,
        dealershipId: idOf(p.key),
        firstName: pp.first,
        lastName: pp.last,
        jobTitle: TITLE[pp.title],
        phone: phoneOf(p.key, i + 1),
        email: `${pp.first[0].toLowerCase()}${pp.last.toLowerCase().replace(/[^a-z]/g, '')}@${domainOf(p.key)}`,
        isDecisionMaker: isDMCode(pp.title),
        notes: notes || undefined,
        linkedInUrl: i === 0 && hash(p.key) % 3 === 0 ? `https://www.linkedin.com/in/${pp.first.toLowerCase()}-${pp.last.toLowerCase()}` : undefined,
        createdByUserId: createdBy(p.key),
        createdAt: createdAt(p.key)
      };
    });
    byPlace[p.key] = list;
    contacts.push(...list);
  });
  return { contacts, byPlace };
}
