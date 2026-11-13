// The weekly summary at the top of My team. Opens by itself the first time
// the manager visits in a new week (Monday morning for most), then folds into
// one line. "Copy" gives plain text for an email or team chat.

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronDown, ChevronUp, Copy, LifeBuoy, Sparkles, Trophy } from 'lucide-react';
import type { User } from '../../types/crm';
import { Btn, Panel } from '../../components/ui/kit';
import type { RepReport, RepStatus } from './signals';
import { SummaryLine, summaryText, weekStart, weekSummary } from './summary';
import { lastCheckIn, markSummarySeen, previousSnapshot, takeSnapshot, useTeamState } from './store';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const WeeklySummary: React.FC<{ reports: RepReport[]; currentUser: User; onOpenRep: (repId: string) => void }> = ({ reports, currentUser, onOpenRep }) => {
  const team = useTeamState();
  const today = todayISO();
  const week = weekStart(today);
  const [open, setOpen] = useState(() => team.summarySeen[currentUser.id] !== week);
  const [copied, setCopied] = useState(false);

  // First visit this week: remember how the team looks, for next week's "since last week".
  useEffect(() => {
    if (!reports.length) return;
    takeSnapshot(week, Object.fromEntries(reports.map(r => [r.rep.id, r.status])) as Record<string, RepStatus>);
    markSummarySeen(currentUser.id, week);
  }, [week, currentUser.id, reports.length]);

  const summary = useMemo(
    () =>
      weekSummary(reports, {
        today,
        lastWeek: previousSnapshot(team, week),
        lastCheckIn: Object.fromEntries(reports.map(r => [r.rep.id, lastCheckIn(team, r.rep.id)?.at]))
      }),
    [reports, team, today, week]
  );

  if (!reports.length) return null;
  const weekLabel = new Date(`${week}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const copy = async () => {
    const text = summaryText(summary, currentUser.firstName);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[14px] transition hover:border-slate-400"
      >
        <CalendarClock className="h-4 w-4 shrink-0 text-blue-600" />
        <span className="min-w-0 flex-1 text-slate-700">
          <span className="font-semibold text-slate-900">This week:</span> {summary.headline}
          {summary.changes.length > 0 && <span className="text-slate-500"> {summary.changes.length} change{summary.changes.length === 1 ? '' : 's'} since last week.</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-semibold text-blue-700">
          Weekly summary <ChevronDown className="h-4 w-4" />
        </span>
      </button>
    );
  }

  const Rep: React.FC<{ l: SummaryLine; tone: 'help' | 'watch' }> = ({ l, tone }) => (
    <li className="py-2.5">
      <button type="button" onClick={() => onOpenRep(l.repId)} className="cursor-pointer text-left text-[15px] font-bold text-slate-900 hover:text-blue-700 hover:underline">
        {l.name}
      </button>
      <div className="text-[14px] text-slate-700">
        {l.reason}
        {l.more > 0 && <span className="text-slate-500"> (and {l.more} more)</span>}
      </div>
      {tone === 'help' && <div className="mt-0.5 text-[13px] font-semibold text-blue-700">First move: {l.action.charAt(0).toLowerCase() + l.action.slice(1)}</div>}
    </li>
  );

  return (
    <Panel className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarClock className="h-4 w-4 text-blue-600" /> Week of {weekLabel}
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold text-slate-900">{summary.headline}</h2>
        </div>
        <div className="flex gap-1.5">
          <Btn size="sm" icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} onClick={copy}>
            {copied ? 'Copied' : 'Copy'}
          </Btn>
          <Btn size="sm" variant="ghost" icon={<ChevronUp className="h-4 w-4" />} onClick={() => setOpen(false)}>
            Hide
          </Btn>
        </div>
      </div>

      {summary.changes.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5">
          <div className="text-[13px] font-semibold text-slate-500">Since last week</div>
          <ul className="mt-1 space-y-0.5">
            {summary.changes.map(c => (
              <li key={c} className="flex items-start gap-2 text-[14px] text-slate-800">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid gap-x-6 md:grid-cols-2">
        {summary.needsHelp.length > 0 && (
          <section>
            <h3 className="text-[14px] font-bold text-rose-700">Needs help</h3>
            <ul className="divide-y divide-slate-100">
              {summary.needsHelp.map(l => (
                <Rep key={l.repId} l={l} tone="help" />
              ))}
            </ul>
          </section>
        )}
        {summary.keepAnEye.length > 0 && (
          <section>
            <h3 className="text-[14px] font-bold text-amber-700">Keep an eye on</h3>
            <ul className="divide-y divide-slate-100">
              {summary.keepAnEye.map(l => (
                <Rep key={l.repId} l={l} tone="watch" />
              ))}
            </ul>
          </section>
        )}
      </div>

      {(summary.waitingOnYou.length > 0 || summary.checkInsDue.length > 0 || summary.wins.length > 0) && (
        <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 md:grid-cols-3">
          {summary.waitingOnYou.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
                <LifeBuoy className="h-4 w-4 text-violet-600" /> Waiting on you
              </h3>
              <ul className="mt-1 space-y-1">
                {summary.waitingOnYou.map(w => (
                  <li key={w.repId + w.text} className="text-[14px] text-slate-700">
                    <button type="button" onClick={() => onOpenRep(w.repId)} className="cursor-pointer font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                      {w.name}
                    </button>
                    : {w.text.replace(/^Asked for your help on /, 'help on ')}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {summary.checkInsDue.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
                <CalendarClock className="h-4 w-4 text-amber-600" /> Check-ins due
              </h3>
              <ul className="mt-1 space-y-1">
                {summary.checkInsDue.map(c => (
                  <li key={c.repId} className="text-[14px] text-slate-700">
                    <button type="button" onClick={() => onOpenRep(c.repId)} className="cursor-pointer font-semibold text-slate-900 hover:text-blue-700 hover:underline">
                      {c.name}
                    </button>
                    : {c.days === null ? 'no check-in yet' : `last one ${c.days} days ago`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {summary.wins.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-slate-900">
                <Trophy className="h-4 w-4 text-emerald-600" /> Going well
              </h3>
              <ul className="mt-1 space-y-1">
                {summary.wins.map(w => (
                  <li key={w} className="text-[14px] text-slate-700">
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  );
};
