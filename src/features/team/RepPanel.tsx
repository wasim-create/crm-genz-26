// One rep, opened from My team: their week, what needs attention (with one-tap
// actions), notes for the next check-in, and past check-ins. Slides in on the
// right on a computer, full screen on a phone.

import React, { useMemo, useState } from 'react';
import { Check, Handshake, LifeBuoy, NotebookPen, Send, Trophy, Undo2, X } from 'lucide-react';
import type { Activity, Dealership, User } from '../../types/crm';
import { Badge, Btn, Dialog, Panel, SectionTitle } from '../../components/ui/kit';
import { useBackLayer } from '../../utils/backStack';
import { formatDay, formatRelative, plural } from '../../utils/format';
import { Flag, PlannedContact, RepReport, workdaysAfter, workdaysBefore } from './signals';
import { FlagGlyph, flagColour, initials, StatusBadge } from './flagUi';
import { addNote, markHandled, recordCheckIn, removeNote, undoHandled, useTeamState } from './store';

export interface RepPanelActions {
  currentUser: User;
  dealerships: Dealership[];
  activities: Activity[];
  planned: PlannedContact[];
  onOpenDealership: (d: Dealership) => void;
  onOfferVisit: (rep: User, deal: Dealership, date: string, time: string, note: string) => void;
  onNudge: (rep: User, message: string, reason: string, dealershipId?: string) => void;
  onOpenAssists: () => void;
}

const LIVE = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding'];
const CONTACT = ['In-Person Visit', 'Phone Call', 'Google Meet'];
const TIMES = ['10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dayShort = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const clock = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const RepPanel: React.FC<RepPanelActions & { report: RepReport; onClose: () => void }> = props => {
  const { report: r, currentUser, dealerships, activities, planned, onClose } = props;
  const rep = r.rep;
  const me = `${currentUser.firstName} ${currentUser.lastName}`;
  const team = useTeamState();
  const [dialog, setDialog] = useState<null | { kind: 'offer' | 'nudge'; flag: Flag }>(null);
  const [noteText, setNoteText] = useState('');
  const [toast, setToast] = useState('');
  const isTop = useBackLayer(true, onClose);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !dialog && isTop() && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const say = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(''), 2600);
  };

  const today = todayISO();
  const week = useMemo(() => {
    const past = workdaysBefore(today, 5).reverse();
    const ahead = workdaysAfter(today, 2);
    const done = (d: string) => activities.filter(a => a.userId === rep.id && a.status === 'completed' && CONTACT.includes(a.activityType) && (a.plannedDate ?? a.completedAt ?? '').slice(0, 10) === d).length;
    const plan = (d: string) => planned.filter(p => p.userId === rep.id && p.date === d && p.how !== 'email' && p.how !== 'text').length;
    return [...past.map(d => ({ d, n: done(d), kind: 'done' as const })), { d: today, n: done(today) + plan(today), kind: 'today' as const }, ...ahead.map(d => ({ d, n: plan(d), kind: 'plan' as const }))];
  }, [activities, planned, rep.id, today]);
  const max = Math.max(4, ...week.map(w => w.n));

  const notes = (team.notes[rep.id] ?? []).filter(n => !n.discussedAt);
  const checkIns = team.checkIns[rep.id] ?? [];
  const open = r.flags.filter(f => !f.handled);
  const handled = r.flags.filter(f => f.handled);
  const dealsOf = (f: Flag) => f.dealershipIds.map(id => dealerships.find(d => d.id === id)).filter(Boolean) as Dealership[];
  const live = dealerships.filter(d => d.assignedRepId === rep.id && LIVE.includes(d.stage));

  const noteFlag = (f: Flag) => {
    addNote(rep.id, f.title + (f.detail ? ` (${f.detail})` : ''), me, f.id);
    markHandled(rep.id, f, 'Added to check-in notes', me);
    say('Added to your check-in notes');
  };
  const fine = (f: Flag) => {
    markHandled(rep.id, f, 'Looked at it: fine for now', me);
    say('Marked as fine for now');
  };

  return (
    <div className="fixed inset-0 z-[45] flex justify-end" role="dialog" aria-modal="true" aria-label={`${rep.firstName} ${rep.lastName}`}>
      <div className="hidden flex-1 bg-scrim/50 md:block" onClick={onClose} aria-hidden />
      <div className="sheet-panel relative flex h-full w-full flex-col bg-slate-50 md:w-[720px] md:max-w-[94vw] md:border-l md:border-slate-200 md:shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[15px] font-bold text-slate-700">{initials(rep.firstName, rep.lastName)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-extrabold text-slate-900">
                {rep.firstName} {rep.lastName}
              </h2>
              <StatusBadge status={r.status} />
            </div>
            <div className="text-[14px] text-slate-600">
              {rep.region} ·{' '}
              {r.stats.workingDaysSinceHire <= 60 ? `New starter, day ${r.stats.workingDaysSinceHire}` : `Rep since ${new Date(`${rep.hireDate}T12:00:00`).getFullYear()}`} · Last check-in {checkIns[0] ? formatRelative(checkIns[0].at).toLowerCase() : 'not yet'}
            </div>
          </div>
          <Btn variant="ghost" icon={<X className="h-5 w-5" />} onClick={onClose} aria-label="Close">
            Close
          </Btn>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5">
          {/* Their week */}
          <section>
            <SectionTitle>Their week</SectionTitle>
            <Panel className="mt-2 p-4">
              <div className="flex items-end gap-1.5" aria-label="Visits and calls per day">
                {week.map(w => (
                  <div key={w.d} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[13px] font-bold text-slate-800">{w.n}</span>
                    <span
                      className={`w-full max-w-[44px] rounded-md ${w.kind === 'plan' ? 'border-2 border-dashed border-blue-300 bg-transparent' : w.kind === 'today' ? 'bg-blue-600' : w.n === 0 ? 'bg-rose-200' : 'bg-slate-300'}`}
                      style={{ height: `${8 + (w.n / max) * 56}px` }}
                    />
                    <span className={`text-[12px] ${w.kind === 'today' ? 'font-bold text-blue-700' : 'text-slate-500'}`}>{w.kind === 'today' ? 'Today' : dayShort(w.d)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[13px] text-slate-600">
                Visits and calls logged, then what's planned (dashed). {r.stats.usualPerWeek !== null ? `Usually about ${r.stats.usualPerWeek} a week; ${r.stats.contactsLastWeek} in the last week.` : `${r.stats.contactsLastWeek} in the last week.`} {plural(r.stats.liveDeals, 'live deal')}.
              </p>
            </Panel>
          </section>

          {/* Needs attention */}
          <section>
            <SectionTitle>{open.length ? 'Needs attention' : 'Nothing needs attention'}</SectionTitle>
            <div className="mt-2 space-y-2.5">
              {open.map(f => (
                <Panel key={f.id} className="p-4">
                  <div className="flex items-start gap-2.5">
                    <span className={`mt-0.5 ${flagColour(f)}`}>
                      <FlagGlyph flag={f} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-slate-900">{f.title}</span>
                        <Badge tone={f.level === 'help' ? 'red' : 'amber'}>{f.level === 'help' ? 'Needs help' : 'Keep an eye'}</Badge>
                      </div>
                      {f.detail && <div className="mt-0.5 text-[14px] text-slate-600">{f.detail}</div>}
                      {dealsOf(f).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {dealsOf(f)
                            .slice(0, 5)
                            .map(d => (
                              <button key={d.id} type="button" onClick={() => props.onOpenDealership(d)} className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[13px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700">
                                {d.dealershipName}
                              </button>
                            ))}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {f.kind === 'support' ? (
                          <Btn size="sm" icon={<LifeBuoy className="h-4 w-4" />} onClick={props.onOpenAssists}>
                            Answer the request
                          </Btn>
                        ) : (
                          <>
                            {(f.kind === 'deals' || f.kind === 'skill' || f.kind === 'new' || f.id === 'quiet') && live.length > 0 && (
                              <Btn size="sm" icon={<Handshake className="h-4 w-4" />} onClick={() => setDialog({ kind: 'offer', flag: f })}>
                                {f.kind === 'new' ? 'Offer a ride-along' : 'Offer to join a visit'}
                              </Btn>
                            )}
                            {f.repTitle && (
                              <Btn size="sm" icon={<Send className="h-4 w-4" />} onClick={() => setDialog({ kind: 'nudge', flag: f })}>
                                Send a nudge
                              </Btn>
                            )}
                            <Btn size="sm" icon={<NotebookPen className="h-4 w-4" />} onClick={() => noteFlag(f)}>
                              Add to check-in notes
                            </Btn>
                          </>
                        )}
                        <Btn size="sm" variant="ghost" icon={<Check className="h-4 w-4" />} onClick={() => fine(f)}>
                          It's fine
                        </Btn>
                      </div>
                    </div>
                  </div>
                </Panel>
              ))}
              {!open.length && <p className="text-[14px] text-slate-600">{rep.firstName} is on track. Nothing to act on.</p>}
            </div>
            {handled.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-[13px] font-semibold text-slate-500">Handled recently (comes back if it gets worse)</div>
                {handled.map(f => (
                  <div key={f.id} className="flex items-start gap-2 text-[14px] text-slate-600">
                    <span className="mt-0.5 text-slate-400">
                      <FlagGlyph flag={f} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {f.title}
                      <span className="block text-[13px] text-slate-500">
                        {f.handled!.action}, {f.handled!.by.split(' ')[0]}, {formatRelative(f.handled!.at).toLowerCase()}
                      </span>
                    </span>
                    <Btn size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} onClick={() => undoHandled(rep.id, f.id)}>
                      Undo
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </section>

          {r.wins.length > 0 && (
            <section>
              <SectionTitle>Going well</SectionTitle>
              <ul className="mt-2 space-y-1">
                {r.wins.map(w => (
                  <li key={w} className="flex items-start gap-2 text-[14px] text-slate-700">
                    <Trophy className="mt-0.5 h-4 w-4 text-emerald-600" />
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Check-in */}
          <section>
            <SectionTitle>Next check-in</SectionTitle>
            <Panel className="mt-2 space-y-3 p-4">
              {notes.length ? (
                <ul className="space-y-1.5">
                  {notes.map(n => (
                    <li key={n.id} className="flex items-start gap-2 text-[14px] text-slate-800">
                      <NotebookPen className="mt-0.5 h-4 w-4 text-slate-400" />
                      <span className="min-w-0 flex-1">{n.text}</span>
                      <button type="button" onClick={() => removeNote(rep.id, n.id)} className="cursor-pointer rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Remove note">
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-slate-600">Nothing noted yet. Add things to talk about, here or from the flags above.</p>
              )}
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  if (!noteText.trim()) return;
                  addNote(rep.id, noteText, me);
                  setNoteText('');
                }}
              >
                <input
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Something to talk about"
                  aria-label="Add a note for the next check-in"
                  className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                />
                <Btn type="submit">Add</Btn>
              </form>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                <Btn
                  variant="primary"
                  icon={<Check className="h-4 w-4" />}
                  onClick={() => {
                    recordCheckIn(rep.id, me, open);
                    say(`Check-in with ${rep.firstName} recorded`);
                  }}
                >
                  Checked in today
                </Btn>
                <span className="text-[13px] text-slate-500">Marks the notes as talked through and quietens the flags above for a week.</span>
              </div>
            </Panel>
            {checkIns.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-[13px] font-semibold text-slate-500">Past check-ins</div>
                {checkIns.slice(0, 5).map(c => (
                  <div key={c.id} className="text-[14px] text-slate-700">
                    <span className="font-medium">{formatDay(c.at)}</span>
                    <span className="text-slate-500"> · {c.byName.split(' ')[0]}</span>
                    {c.notesDiscussed.length > 0 && <span className="text-slate-600">: {c.notesDiscussed.join('; ')}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {toast && (
          <div role="status" className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-onaccent shadow-lg md:left-auto md:right-6 md:translate-x-0">
            {toast}
          </div>
        )}
      </div>

      {dialog?.kind === 'offer' && (
        <OfferDialog
          rep={rep}
          flag={dialog.flag}
          deals={dealsOf(dialog.flag).filter(d => LIVE.includes(d.stage)).length ? dealsOf(dialog.flag).filter(d => LIVE.includes(d.stage)) : live}
          onClose={() => setDialog(null)}
          onSend={(deal, date, time, note) => {
            props.onOfferVisit(rep, deal, date, time, note);
            markHandled(rep.id, dialog.flag, `Offered to join at ${deal.dealershipName}`, me);
            setDialog(null);
            say(`Offer sent to ${rep.firstName}`);
          }}
        />
      )}
      {dialog?.kind === 'nudge' && (
        <NudgeDialog
          rep={rep}
          flag={dialog.flag}
          onClose={() => setDialog(null)}
          onSend={msg => {
            props.onNudge(rep, msg, dialog.flag.title, dialog.flag.dealershipIds[0]);
            markHandled(rep.id, dialog.flag, 'Sent a nudge', me);
            setDialog(null);
            say(`Nudge sent to ${rep.firstName}`);
          }}
        />
      )}
    </div>
  );
};

const field = 'min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20';

const OfferDialog: React.FC<{ rep: User; flag: Flag; deals: Dealership[]; onClose: () => void; onSend: (deal: Dealership, date: string, time: string, note: string) => void }> = ({ rep, flag, deals, onClose, onSend }) => {
  const [dealId, setDealId] = useState(deals[0]?.id ?? '');
  const [date, setDate] = useState(workdaysAfter(todayISO(), 1)[0]);
  const [time, setTime] = useState('11:00');
  const [note, setNote] = useState(flag.kind === 'new' ? `Happy to ride along and do the first part of the visit with you.` : `Saw this on My team. Happy to join and help move it on.`);
  const deal = deals.find(d => d.id === dealId);
  return (
    <Dialog title={flag.kind === 'new' ? `Offer ${rep.firstName} a ride-along` : `Offer to join ${rep.firstName} on a visit`} onClose={onClose}>
      <p className="text-[14px] text-slate-600">It's booked as a manager assist, so {rep.firstName} sees it in their assist requests and as the next step on that dealership.</p>
      <label className="block space-y-1">
        <span className="text-[13px] font-semibold text-slate-700">Dealership</span>
        <select value={dealId} onChange={e => setDealId(e.target.value)} className={field}>
          {deals.map(d => (
            <option key={d.id} value={d.id}>
              {d.dealershipName} · {d.stage}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[13px] font-semibold text-slate-700">Day</span>
          <input type="date" value={date} min={todayISO()} onChange={e => setDate(e.target.value)} className={field} />
        </label>
        <label className="block space-y-1">
          <span className="text-[13px] font-semibold text-slate-700">Time</span>
          <select value={time} onChange={e => setTime(e.target.value)} className={field}>
            {TIMES.map(t => (
              <option key={t} value={t}>
                {clock(t)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[13px] font-semibold text-slate-700">Message to {rep.firstName}</span>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={`${field} py-2`} />
      </label>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" disabled={!deal || !date} onClick={() => deal && onSend(deal, date, time, note)}>
          Send offer
        </Btn>
      </div>
    </Dialog>
  );
};

const NudgeDialog: React.FC<{ rep: User; flag: Flag; onClose: () => void; onSend: (message: string) => void }> = ({ rep, flag, onClose, onSend }) => {
  const [msg, setMsg] = useState(() => {
    const base = (flag.repTitle ?? flag.title).replace(/[.?!]+$/, '');
    return `${rep.firstName}, ${base.charAt(0).toLowerCase() + base.slice(1)}. Can you take a look today?`;
  });
  return (
    <Dialog title={`Send ${rep.firstName} a nudge`} onClose={onClose}>
      <p className="text-[14px] text-slate-600">It shows at the top of {rep.firstName}'s My Plan until they tick it off.</p>
      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={4} aria-label="Message" className={`${field} py-2`} />
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn variant="primary" disabled={!msg.trim()} onClick={() => onSend(msg.trim())}>
          Send nudge
        </Btn>
      </div>
    </Dialog>
  );
};
