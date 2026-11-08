// Next step after a meeting: read the rep's note with plain, predictable
// rules (no AI guessing) and suggest
//   • the next step — how (visit / call / Meet / email), which tasks, which day, what time
//   • action points with due dates ("send the training agenda by Friday")
//   • a stage hint ("went with another provider" → Lost, "after Q1" → Not Now)
// Every suggestion says which words it came from, and the rep confirms it.
// When the note says nothing useful, sensible defaults by stage are used.

import type { HowType, PlanSlot, SlotTask } from '../types';
import type { PipelineStage } from '../../../types/crm';
import { addDays, isWeekend, nextWeekday, parseISODate, toISODate } from './time';

export interface NoteDate {
  date: string;
  phrase: string;
  /** "by Friday" = a deadline (do it before), otherwise = the day itself. */
  deadline?: boolean;
  time?: string;
}

export interface NextStepSuggestion {
  how: HowType;
  taskIds: string[];
  /** Contacts named in the note for the next step ("…with Tracy"). */
  contactIds?: string[];
  date: string;
  time?: string;
  /** Short human label, e.g. "Keyfetch install visit". */
  label: string;
  /** Words from the note this came from (empty = a default for the stage). */
  from: string[];
}

export interface NoteActionPoint {
  title: string;
  dueDate: string;
  from: string;
}

export interface NoteStageHint {
  to: PipelineStage;
  reason: string;
  from: string;
  nurtureDate?: string;
}

export interface NoteReading {
  next: NextStepSuggestion | null;
  actionPoints: NoteActionPoint[];
  stage: NoteStageHint | null;
  /** The note says there is nothing more to do (e.g. lost). */
  noFurtherAction: boolean;
}

const WD_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, 'a couple of': 2, few: 3, 'a few': 3 };

const workday = (iso: string) => (isWeekend(iso) ? nextWeekday(iso) : iso);
const addBusinessDays = (iso: string, n: number) => {
  let d = iso;
  let k = n;
  while (k > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d)) k--;
  }
  return d;
};

/** Parse "2pm", "2:30 pm", "10:30", "at 11" → HH:MM (business hours guess for bare numbers). */
export function parseTime(text: string): string | undefined {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i) ?? text.match(/\bat\s+(\d{1,2})(?::(\d{2}))\b/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = (m[3] ?? '').toLowerCase();
  if (ap.startsWith('p') && h < 12) h += 12;
  if (ap.startsWith('a') && h === 12) h = 0;
  if (!ap && h < 7) h += 12; // "at 2:30" during the working day means PM
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Find the first date phrase in a piece of text, relative to `today`. */
export function parseDate(text: string, today: string): NoteDate | null {
  const t = text.toLowerCase();
  const time = parseTime(t);
  const base = parseISODate(today);
  const dow = base.getDay();
  const hit = (date: string, phrase: string, deadline = false): NoteDate => ({ date: workday(date), phrase, deadline, time });

  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(by\s+)?(today|this afternoon|later today)\b/))) return hit(today, m[0], !!m[1]);
  if ((m = t.match(/\b(by\s+)?tomorrow\b/))) return hit(addDays(today, 1), m[0], !!m[1]);
  if ((m = t.match(/\b(by\s+)?(?:the\s+)?(end of (?:the )?week|this week)\b/))) {
    const fri = addDays(today, (5 - dow + 7) % 7 || 0);
    return hit(fri < today ? today : fri, m[0], true);
  }
  if ((m = t.match(/\b(by\s+)?(?:the\s+)?(end of (?:the )?month|month[- ]end)\b/))) {
    const end = toISODate(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    let d = end;
    while (isWeekend(d)) d = addDays(d, -1);
    return hit(d, m[0], true);
  }
  if ((m = t.match(/\b(after|in|from|until)\s+(q[1-4]|the new year|january|next quarter|the holidays)\b/))) {
    const q = m[2];
    const curQ = Math.floor(base.getMonth() / 3);
    let year = base.getFullYear();
    let month: number;
    if (q.startsWith('q')) {
      let qi = Number(q[1]) - 1 + (m[1] === 'after' ? 1 : 0);
      if (qi > 3) {
        qi -= 4;
        year += 1;
      }
      month = qi * 3;
      if (year === base.getFullYear() && qi <= curQ) year += 1;
    } else if (q === 'next quarter') {
      month = (curQ + 1) * 3;
      if (month > 9) {
        month = 0;
        year += 1;
      }
    } else {
      month = 0;
      year += 1;
    }
    return hit(toISODate(new Date(year, month, q.startsWith('q') || q === 'next quarter' ? 1 : 5)), m[0]);
  }
  if ((m = t.match(/\bnext year\b/))) return hit(toISODate(new Date(base.getFullYear() + 1, 0, 15)), m[0]);
  if ((m = t.match(/\bin\s+(a|an|one|two|three|four|five|six|a couple of|couple|a few|few|\d+)\s+(day|days|week|weeks|month|months)\b/))) {
    const n = NUM[m[1]] ?? Number(m[1]);
    const unit = m[2];
    const d = unit.startsWith('day') ? addDays(today, n) : unit.startsWith('week') ? addDays(today, n * 7) : toISODate(new Date(base.getFullYear(), base.getMonth() + n, base.getDate()));
    return hit(d, m[0]);
  }
  if ((m = t.match(/\bnext\s+week\b/))) return hit(addDays(today, ((8 - dow) % 7) || 7), m[0]);
  if ((m = t.match(/\b(by\s+|on\s+|next\s+|this\s+|until\s+|before\s+)?(monday|tuesday|wednesday|thursday|friday|mon|tues|tue|wed|thurs|thur|thu|fri)\b/))) {
    const target = WD_SHORT.indexOf(m[2].slice(0, 3));
    const lead = (m[1] ?? '').trim();
    let diff = (target - dow + 7) % 7 || 7; // the coming one (never today)
    if (lead === 'next') {
      // "next Tuesday" = Tuesday of next week
      const toNextMonday = ((8 - dow) % 7) || 7;
      diff = toNextMonday + ((target + 6) % 7);
    }
    return hit(addDays(today, diff), m[0], lead === 'by' || lead === 'until' || lead === 'before');
  }
  // "the 20th", "on the 3rd", "after the 20th", "December 3", "Dec 3rd"
  if ((m = t.match(/\b(after|by|on|before)?\s*(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?!\s*(?:car|unit|tag|vehicle))/))) {
    const day = Number(m[2]);
    if (day >= 1 && day <= 31) {
      let d = new Date(base.getFullYear(), base.getMonth(), day);
      if (toISODate(d) <= today) d = new Date(base.getFullYear(), base.getMonth() + 1, day);
      let iso = toISODate(d);
      if (m[1] === 'after') iso = addBusinessDays(iso, 1);
      return hit(iso, m[0].trim(), m[1] === 'by' || m[1] === 'before');
    }
  }
  if ((m = t.match(new RegExp(`\\b(${MONTHS.map(x => x.slice(0, 3)).join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`)))) {
    const month = MONTHS.findIndex(x => x.startsWith(m![1]));
    let d = new Date(base.getFullYear(), month, Number(m[2]));
    if (toISODate(d) < today) d = new Date(base.getFullYear() + 1, month, Number(m[2]));
    return hit(toISODate(d), m[0]);
  }
  return null;
}

type Intent = { kind: 'visit' | 'call' | 'meet' | 'install' | 'training' | 'sign' | 'demo' | 'assist' | 'email'; phrase: string };

const INTENTS: { kind: Intent['kind']; re: RegExp }[] = [
  { kind: 'install', re: /\b(install(?:ation|ed)?|set ?up the (?:cabinets?|hardware)|tag(?:ging)? the (?:cars|vehicles))\b/ },
  { kind: 'training', re: /\b(train(?:ing)?|walk (?:the )?(?:f&i )?(?:team|desk) through)\b/ },
  { kind: 'sign', re: /\b(sign(?:ing|ature)?(?! up for)|contract|agreement (?:ready|signed|back))\b/ },
  { kind: 'demo', re: /\b(demo|show (?:them|the team|him|her) how)\b/ },
  { kind: 'meet', re: /\b(google meet|video call|zoom|teams call|meet online)\b/ },
  { kind: 'assist', re: /\b(bring (?:my )?manager|manager (?:to )?join|bring (?:jason|jose|michael))\b/ },
  { kind: 'call', re: /\b(call(?: me| him| her| them| back)?|phone|ring|check back|touch base|follow up by phone)\b/ },
  { kind: 'visit', re: /\b(come back|stop by|drop (?:by|in|off)|visit|see (?:him|her|them) again|meet again|walk the lot)\b/ }
];

const EMAIL_RE = /\b(send|email|e-mail|forward|share|get (?:him|her|them))\s+(?:him |her |them |over )?(?:the |a |an |our |some )?([a-z0-9&' -]{2,40}?)(?=\s+(?:by|before|on|to|for|next|this|tomorrow|today|after|in)\b|[,.;!]|$)/;

const LOST_RE = /\b(not interested|no longer interested|went with|chose (?:another|a different|someone)|signed with (?:another|a competitor|someone)|renewed with|going with (?:another|someone else)|lost (?:it|the deal)|closing down|out of business)\b/;
const NOT_NOW_RE = /\b(not (?:right )?now|wait(?:ing)? until|revisit|circle back|after (?:q[1-4]|the new year|january|the holidays)|next year|too busy|bad timing|freeze|on hold)\b/;
const WAITING_RE = /\b(waiting (?:on|for) (?:them|him|her|the gm|the owner|approval|their)|they(?:'ll| will) (?:call|get back|let me know)|will get back to me|reviewing (?:it )?with)\b/;

/** Extra tasks the note mentions for the next step. */
const TASK_HINTS: { re: RegExp; client?: string; prospect?: string; signup?: string }[] = [
  { re: /\b(tags?|keyfetch|key ?fetch|recount|key cabinet|stock)\b/, client: 'c_keyfetch' },
  { re: /\b(upsell|ceramic|gap|add-?ons?|tire (?:&|and) wheel)\b/, client: 'c_upsell', prospect: 'p_pitch' },
  { re: /\b(issue|problem|fix|broken|not syncing)\b/, client: 'c_issue' },
  { re: /\b(pricing|terms|proposal|pitch)\b/, prospect: 'p_pitch' },
  { re: /\b(decision maker|owner|dealer principal|gm)\b/, prospect: 'p_dm' },
  { re: /\b(interest|which products)\b/, prospect: 'p_interest' }
];

const splitClauses = (note: string) =>
  note
    .split(/(?<=[.!?;])\s+|\n+|,\s*(?:and\s+)?(?=(?:he|she|they|asked|wants|send|call|come|we|i)\b)/i)
    .map(s => s.trim())
    .filter(Boolean);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface ReadNoteInput {
  note: string;
  today: string;
  stage?: PipelineStage | string;
  workType: PlanSlot['workType'];
  /** Outcomes chosen on the task cards (they add to what the note says). */
  tasks?: SlotTask[];
  dealershipName: string;
  /** Contacts at the dealership, to spot names in the note. */
  contacts?: { id: string; firstName: string; lastName: string }[];
}

/** Default next step by stage when the note doesn't say. */
export function defaultNextStep(stage: string | undefined, workType: PlanSlot['workType'], today: string, tasks: SlotTask[] = []): NextStepSuggestion {
  const followUp = tasks.some(t => t.outcome?.kind === 'simple' && t.outcome.result === 'follow_up');
  const signed = tasks.some(t => t.outcome?.kind === 'signed' && t.outcome.productIds.length > 0);
  if (signed) return { how: 'in_person', taskIds: ['s_setup'], date: addBusinessDays(today, 3), label: 'Onboarding kick-off', from: [] };
  if (workType === 'client') return { how: 'in_person', taskIds: ['c_keyfetch', 'c_checkin'], date: addBusinessDays(today, 20), label: 'Next client check-in', from: [] };
  switch (stage) {
    case 'Contract':
    case 'Won':
      return { how: 'in_person', taskIds: ['s_contract'], date: addBusinessDays(today, 2), label: 'Contract signing', from: [] };
    case 'Signed':
      return { how: 'in_person', taskIds: ['s_training'], date: addBusinessDays(today, 3), label: 'Onboarding training', from: [] };
    case 'Onboarding':
      return { how: 'phone', taskIds: ['s_handover'], date: addBusinessDays(today, 5), label: 'Check the first deals', from: [] };
    case 'HOT':
    case 'Negotiation':
      return { how: 'in_person', taskIds: ['p_dm'], date: addBusinessDays(today, 3), label: 'Decision-maker meeting', from: [] };
    default:
      return { how: 'phone', taskIds: ['p_followup'], date: addBusinessDays(today, followUp ? 2 : 3), label: 'Follow-up call', from: [] };
  }
}

const PLAN: Record<Intent['kind'], { how: HowType; taskIds: string[]; label: string }> = {
  install: { how: 'in_person', taskIds: ['s_setup'], label: 'Keyfetch install visit' },
  training: { how: 'in_person', taskIds: ['s_training'], label: 'Training visit' },
  sign: { how: 'in_person', taskIds: ['s_contract'], label: 'Contract signing' },
  demo: { how: 'meet', taskIds: ['p_pitch'], label: 'Product demo' },
  meet: { how: 'meet', taskIds: ['p_followup'], label: 'Google Meet' },
  assist: { how: 'in_person', taskIds: ['p_assist', 'p_dm'], label: 'Meeting with your manager' },
  call: { how: 'phone', taskIds: ['p_followup'], label: 'Follow-up call' },
  visit: { how: 'in_person', taskIds: ['p_followup'], label: 'Follow-up visit' },
  email: { how: 'email', taskIds: ['p_followup'], label: 'Email' }
};

/** Read a post-meeting note and suggest the next step, action points and a stage hint. */
export function readNote(input: ReadNoteInput): NoteReading {
  const { note, today, stage, workType, tasks = [] } = input;
  const clauses = splitClauses(note.toLowerCase());
  const actionPoints: NoteActionPoint[] = [];
  let next: NextStepSuggestion | null = null;
  let stageHint: NoteStageHint | null = null;
  let anyDate: NoteDate | null = null;
  let waiting = false;

  for (const clause of clauses) {
    const date = parseDate(clause, today);
    if (date && !anyDate) anyDate = date;

    const lost = clause.match(LOST_RE);
    if (lost && workType !== 'client') {
      stageHint = { to: 'Lost', reason: 'The note says they went another way', from: lost[0] };
      continue;
    }
    const notNow = clause.match(NOT_NOW_RE);
    if (notNow && workType !== 'client') {
      const nurture = date?.date ?? addDays(today, 60);
      stageHint = { to: 'Not Now', reason: `The note says to wait — nurture follow-up ${nurture}`, from: date ? `${notNow[0]} … ${date.phrase}` : notNow[0], nurtureDate: workday(nurture) };
    }
    if (clause.match(WAITING_RE)) waiting = true;

    // Emails / things to send become action points with a due date.
    const email = clause.match(EMAIL_RE);
    if (email) {
      const what = email[2].replace(/\b(him|her|them|over)\b/g, '').trim();
      if (what && !/^(it|that|this)$/.test(what)) {
        // The date that belongs to the email is the one after "send …"
        const eDate = parseDate(clause.slice(email.index ?? 0), today);
        const due = eDate ? eDate.date : addBusinessDays(today, 1);
        actionPoints.push({ title: `Send ${what} to ${input.dealershipName}`, dueDate: due < today ? today : due, from: eDate ? `${email[0].trim()} … ${eDate.phrase}` : email[0].trim() });
      }
    }

    // The first meeting-type intent becomes the next step.
    if (!next) {
      // Ignore the thing being sent ("send the training agenda" is not a training visit).
      const intentText = email ? clause.replace(email[0], ' ') : clause;
      const intent = INTENTS.map(i => ({ i, m: intentText.match(i.re) })).find(x => x.m);
      if (intent && !(intent.i.kind === 'call' && email && !date)) {
        const plan = PLAN[intent.i.kind];
        // Prefer the date nearest after the intent; else the clause's date (unless it belonged to the email).
        const after = parseDate(intentText.slice(intent.m!.index ?? 0), today);
        const before = parseDate(intentText, today);
        const iDate = after ?? before;
        const d = iDate ? iDate.date : defaultNextStep(stage, workType, today, tasks).date;
        const kind = workType === 'client' ? 'client' : workType === 'signup' ? 'signup' : 'prospect';
        const base = workType === 'client' && plan.taskIds[0].startsWith('p_') ? ['c_checkin'] : plan.taskIds;
        const extra = TASK_HINTS.filter(t => t.re.test(intentText)).map(t => t[kind]).filter((x): x is string => !!x);
        const people = (input.contacts ?? []).filter(c => new RegExp(`\\b${c.firstName.toLowerCase()}\\b`).test(intentText));
        next = {
          how: plan.how,
          taskIds: Array.from(new Set([...extra.filter(x => x === 'c_keyfetch'), ...base, ...extra])),
          contactIds: people.length ? people.map(c => c.id) : undefined,
          date: d < today ? today : d,
          time: iDate?.time,
          label: plan.label,
          from: [intent.m![0], ...(iDate ? [iDate.phrase] : []), ...people.map(c => c.firstName.toLowerCase())]
        };
      }
    }
  }

  if (stageHint?.to === 'Lost') return { next: null, actionPoints, stage: stageHint, noFurtherAction: true };
  if (stageHint?.to === 'Not Now' && !next) {
    next = { how: 'phone', taskIds: ['p_followup'], date: stageHint.nurtureDate!, label: 'Nurture follow-up call', from: [stageHint.from] };
  }
  if (!next) {
    const def = defaultNextStep(stage, workType, today, tasks);
    // A date in the note with no clear action still sets the day.
    next = anyDate && !anyDate.deadline ? { ...def, date: anyDate.date, time: anyDate.time, from: [anyDate.phrase] } : def;
    if (waiting && !anyDate) next = { ...def, date: addBusinessDays(today, 5), label: `Check in if they haven't replied`, from: ['waiting on them'] };
  }
  return { next, actionPoints: actionPoints.slice(0, 4), stage: stageHint, noFurtherAction: false };
}

export const NEXT_SKIP_REASONS = [
  { id: 'waiting', label: 'Waiting on them' },
  { id: 'not_now', label: 'Not now — follow up later' },
  { id: 'none', label: 'No further action needed' }
] as const;
export type NextSkipReason = (typeof NEXT_SKIP_REASONS)[number]['id'];

export const describeNext = (s: Pick<NextStepSuggestion, 'label' | 'date' | 'time'>) => {
  const d = parseISODate(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (!s.time) return `${s.label} · ${d}`;
  const [h, m] = s.time.split(':').map(Number);
  return `${s.label} · ${d}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export { cap };
