// The manager's weekly summary: who needs help this week and why, what
// changed since last week, check-ins that are due, requests waiting on the
// manager, and what's going well. Plain code over the same rep reports the
// My team screen uses, so the summary and the screen always agree.

import type { Flag, RepReport, RepStatus } from './signals';
import { STATUS_LABEL } from './signals';

export interface SummaryLine {
  repId: string;
  name: string;
  reason: string;
  more: number;
  /** A sensible first move, from the most urgent flag. */
  action: string;
}

export interface WeekSummary {
  weekOf: string;
  counts: Record<RepStatus, number>;
  headline: string;
  changes: string[];
  needsHelp: SummaryLine[];
  keepAnEye: SummaryLine[];
  checkInsDue: { repId: string; name: string; days: number | null }[];
  waitingOnYou: { repId: string; name: string; text: string }[];
  wins: string[];
}

/** Monday of the week containing `iso` (YYYY-MM-DD). */
export function weekStart(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const firstMove = (f: Flag, first: string): string => {
  const id = f.id.startsWith('losses_') ? 'losses' : f.id;
  switch (id) {
    case 'quiet':
      return `Call ${first} today`;
    case 'drop':
      return `Ask ${first} how the week is going`;
    case 'plan':
      return `Help ${first} plan the next few days`;
    case 'no_next':
      return `Send ${first} a nudge to plan next steps`;
    case 'waiting':
      return `Suggest ${first} chases the dealers`;
    case 'stuck':
      return `Offer to join ${first} on the stuck deal`;
    case 'risk':
      return `Offer to join ${first} at the at-risk client`;
    case 'losses':
      return `Go through the lost deals with ${first}`;
    case 'new_rep':
      return `Offer ${first} a ride-along`;
    case 'assist_waiting':
      return `Answer ${first}'s request for help`;
    default:
      return `Check in with ${first}`;
  }
};

const line = (r: RepReport): SummaryLine => {
  const top = r.open[0];
  // A request waiting on the manager is the manager's job; lead with it.
  const waiting = r.open.find(f => f.id === 'assist_waiting');
  return {
    repId: r.rep.id,
    name: `${r.rep.firstName} ${r.rep.lastName}`,
    reason: top ? top.title : 'Several small things at once',
    more: Math.max(0, r.open.length - 1),
    action: firstMove(waiting ?? top, r.rep.firstName)
  };
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function weekSummary(
  reports: RepReport[],
  opts: {
    today: string;
    /** Each rep's status the last time a summary was taken (previous week). */
    lastWeek?: Record<string, RepStatus> | null;
    /** When each rep last had a check-in (ISO), if ever. */
    lastCheckIn: Record<string, string | undefined>;
    checkInDueDays?: number;
  }
): WeekSummary {
  const due = opts.checkInDueDays ?? 10;
  const counts: Record<RepStatus, number> = { help: 0, watch: 0, good: 0 };
  reports.forEach(r => counts[r.status]++);

  const parts = [
    counts.help ? `${counts.help} need${counts.help === 1 ? 's' : ''} help` : null,
    counts.watch ? `${counts.watch} to keep an eye on` : null,
    counts.good ? `${counts.good} on track` : null
  ].filter(Boolean);
  const headline = reports.length ? `${parts.join(', ')}.` : 'No reps on your team yet.';

  const changes: string[] = [];
  if (opts.lastWeek) {
    const rank: Record<RepStatus, number> = { good: 0, watch: 1, help: 2 };
    for (const r of reports) {
      const before = opts.lastWeek[r.rep.id];
      if (!before || before === r.status) continue;
      const first = r.rep.firstName;
      if (r.status === 'good') changes.push(`${first} is back on track`);
      else if (rank[r.status] > rank[before]) changes.push(`${first} has moved to ${STATUS_LABEL[r.status].toLowerCase()} (was ${STATUS_LABEL[before].toLowerCase()})`);
      else changes.push(`${first} has improved to ${STATUS_LABEL[r.status].toLowerCase()}`);
    }
    const stillHelp = reports.filter(r => r.status === 'help' && opts.lastWeek![r.rep.id] === 'help').map(r => r.rep.firstName);
    if (stillHelp.length) changes.push(`${stillHelp.join(' and ')} still need${stillHelp.length === 1 ? 's' : ''} help, two weeks running`);
  }

  const order = (a: RepReport, b: RepReport) => b.open.filter(f => f.level === 'help').length - a.open.filter(f => f.level === 'help').length || b.open.length - a.open.length;
  const needsHelp = reports.filter(r => r.status === 'help').sort(order).map(line);
  const keepAnEye = reports.filter(r => r.status === 'watch').sort(order).map(line);

  const today = new Date(`${opts.today}T12:00:00`).getTime();
  const checkInsDue = reports
    .map(r => {
      const at = opts.lastCheckIn[r.rep.id];
      const days = at ? Math.floor((today - new Date(at).getTime()) / 86400000) : null;
      return { repId: r.rep.id, name: r.rep.firstName, days };
    })
    .filter(x => x.days === null || x.days >= due)
    .sort((a, b) => (b.days ?? 999) - (a.days ?? 999));

  const waitingOnYou = reports.flatMap(r => r.flags.filter(f => f.id === 'assist_waiting').map(f => ({ repId: r.rep.id, name: r.rep.firstName, text: f.title })));

  const wins = reports.flatMap(r => r.wins.slice(0, 1).map(w => `${r.rep.firstName}: ${w.charAt(0).toLowerCase()}${w.slice(1)}`)).slice(0, 4);

  return { weekOf: weekStart(opts.today), counts, headline, changes, needsHelp, keepAnEye, checkInsDue, waitingOnYou, wins };
}

/** Plain text, ready to paste into an email or a team chat. */
export function summaryText(s: WeekSummary, managerFirst?: string): string {
  const day = new Date(`${s.weekOf}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const out: string[] = [`Team summary, week of ${day}${managerFirst ? ` (${managerFirst})` : ''}`, '', s.headline];
  if (s.changes.length) out.push('', 'Since last week:', ...s.changes.map(c => `- ${c}`));
  if (s.needsHelp.length) out.push('', 'Needs help:', ...s.needsHelp.map(l => `- ${l.name}: ${l.reason}${l.more ? ` (+${plural(l.more, 'more thing')})` : ''}. First move: ${l.action.charAt(0).toLowerCase()}${l.action.slice(1)}.`));
  if (s.keepAnEye.length) out.push('', 'Keep an eye on:', ...s.keepAnEye.map(l => `- ${l.name}: ${l.reason}`));
  if (s.waitingOnYou.length) out.push('', 'Waiting on you:', ...s.waitingOnYou.map(w => `- ${w.name}: ${w.text}`));
  if (s.checkInsDue.length) out.push('', 'Check-ins due:', ...s.checkInsDue.map(c => `- ${c.name}: ${c.days === null ? 'no check-in yet' : `last one ${c.days} days ago`}`));
  if (s.wins.length) out.push('', 'Going well:', ...s.wins.map(w => `- ${w}`));
  return out.join('\n');
}
