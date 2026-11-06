// Dealership contact job titles. Key decision makers are listed first and
// tagged; choosing one ticks "Decision maker" automatically (it can be
// unticked). "Other" lets the rep type their own title.

export const KEY_DECISION_MAKER_TITLES = [
  'Dealer Principal / Owner',
  'General Manager (GM)',
  'General Sales Manager (GSM)',
  'F&I Director / Finance Director',
  'Finance and Insurance (F&I) Manager',
  'Corporate VP of Finance / F&I Director',
  'Group Director of Operations',
  'Group F&I Director'
] as const;

export const OTHER_TITLES = [
  'Used Car Manager / Pre-owned Director',
  'Sales Associate / Sales Executive',
  'BDC Representative (Business Development Centre)',
  'Internet Sales Manager / Digital Concierge',
  'Receptionist',
  'Aftersales Manager / Service Director',
  'Parts Advisor / Counter Specialist',
  'Sales Administrator',
  'Accounts Payable / Receivable Clerk',
  'Marketing / Social Media Manager'
] as const;

export const OTHER_TITLE = 'Other';

export const ALL_TITLES: string[] = [...KEY_DECISION_MAKER_TITLES, ...OTHER_TITLES, OTHER_TITLE];

export const isKeyDecisionMaker = (title?: string): boolean =>
  !!title && (KEY_DECISION_MAKER_TITLES as readonly string[]).includes(title);

/**
 * Map an old free-text title to the closest one in the list; anything that
 * doesn't match becomes "Other" (the original text is kept as the custom title).
 */
export function normalizeJobTitle(raw: string | undefined): { title: string; custom?: string } {
  const t = (raw ?? '').trim();
  if (!t) return { title: OTHER_TITLE };
  if (ALL_TITLES.includes(t)) return { title: t };
  const s = t.toLowerCase();
  const rules: [RegExp, string][] = [
    [/principal|owner|dealer op/, 'Dealer Principal / Owner'],
    [/general sales|\bgsm\b/, 'General Sales Manager (GSM)'],
    [/general manager|\bgm\b/, 'General Manager (GM)'],
    [/vp.*(finance|f&i)|corporate.*finance/, 'Corporate VP of Finance / F&I Director'],
    [/group.*f&i/, 'Group F&I Director'],
    [/group.*(operation|director)/, 'Group Director of Operations'],
    [/f&i director|finance director/, 'F&I Director / Finance Director'],
    [/f&i|finance/, 'Finance and Insurance (F&I) Manager'],
    [/used car|pre-?owned/, 'Used Car Manager / Pre-owned Director'],
    [/bdc|business development/, 'BDC Representative (Business Development Centre)'],
    [/internet|digital/, 'Internet Sales Manager / Digital Concierge'],
    [/reception/, 'Receptionist'],
    [/service|aftersales/, 'Aftersales Manager / Service Director'],
    [/parts/, 'Parts Advisor / Counter Specialist'],
    [/admin/, 'Sales Administrator'],
    [/accounts|payable|receivable/, 'Accounts Payable / Receivable Clerk'],
    [/marketing|social/, 'Marketing / Social Media Manager'],
    [/sales/, 'Sales Associate / Sales Executive']
  ];
  const hit = rules.find(([re]) => re.test(s));
  return hit ? { title: hit[1] } : { title: OTHER_TITLE, custom: t };
}
