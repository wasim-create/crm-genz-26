// "Next step" — the last part of "How did it go?", and the "Plan it" sheet
// used everywhere a dealership has no next step. Pre-filled from the rep's
// note (or a sensible default for the stage); the week strip shows each
// working day's load and the best free times, including Google Calendar
// busy blocks, so the rep never has to leave this screen.

import React, { useMemo, useState } from 'react';
import { CalendarDays, CalendarX2, Clock3, Quote, Sparkles } from 'lucide-react';
import type { Activity, Dealership } from '../../../types/crm';
import type { HowType, PlanSlot, SlotTarget, SlotTask, WorkType } from '../types';
import { NEXT_SKIP_REASONS, NextSkipReason, NoteReading, describeNext, readNote } from '../engine/nextStep';
import { HOW_LABEL, TASK_BY_ID, durationFor, tasksForWorkType, workTypeForStage } from '../engine/tasks';
import { addDays, format12h, formatDayShort, isWeekend, nextWeekday, parseISODate, toHHMM } from '../engine/time';
import { indexForTime, insertAt, layoutDay, suggestPlacements } from '../engine/schedule';
import { addSlots, submitWriteback, upsertSlots } from '../data/store';
import { hasKeyfetch } from '../services/suggestions';
import { Button, Card, Segmented, Sheet } from './primitives';
import { useMyPlan } from './context';
import { newId } from './slotHelpers';

export interface NextStepValue {
  mode: 'plan' | 'later' | 'skip';
  how: HowType;
  taskIds: string[];
  date: string;
  /** Exact time, when the rep (or the note) chose one. */
  time?: string;
  /** Position in the day from the best-time suggestion (flow placement). */
  index?: number;
  label: string;
  from: string[];
  contactIds?: string[];
  skipReason?: NextSkipReason;
  nurtureDate?: string;
}

export const valueFromReading = (r: NoteReading, today: string): NextStepValue => {
  if (r.noFurtherAction || !r.next) return { mode: 'skip', how: 'phone', taskIds: ['p_followup'], date: nextWeekday(today), label: 'Follow-up call', from: r.stage ? [r.stage.from] : [], skipReason: 'none' };
  return { mode: 'plan', how: r.next.how, taskIds: r.next.taskIds, date: r.next.date, time: r.next.time, label: r.next.label, from: r.next.from, contactIds: r.next.contactIds };
};

const HOW_OPTIONS: { value: HowType; label: string }[] = [
  { value: 'in_person', label: 'Visit' },
  { value: 'phone', label: 'Call' },
  { value: 'meet', label: 'Meet' },
  { value: 'email', label: 'Email' }
];

const workTypeOfTasks = (taskIds: string[], fallback: WorkType): WorkType => (taskIds.length ? (TASK_BY_ID[taskIds[0]]?.workType ?? fallback) : fallback);

function tasksFor(taskIds: string[], d?: Dealership): SlotTask[] {
  return taskIds.map(taskId => {
    const def = TASK_BY_ID[taskId];
    if (def?.products === 'not_owned') return { taskId, productIds: ['prod_10', 'prod_4', 'prod_5'].filter(p => !(d?.signedProducts ?? []).includes(p)).slice(0, 1) };
    if (def?.products) return { taskId, productIds: (d?.productInterests ?? []).map(p => p.productId).slice(0, 2) };
    return { taskId };
  });
}

/** Build the planned (or basket) slot for a chosen next step. */
export function buildNextSlot(v: NextStepValue, base: { userId: string; target: SlotTarget; workType: WorkType; contactIds: string[]; contactNames: string[]; contacts?: { id: string; firstName: string; lastName: string }[] }, d?: Dealership): PlanSlot {
  const named = v.contactIds?.length && base.contacts ? base.contacts.filter(c => v.contactIds!.includes(c.id)) : [];
  if (named.length) base = { ...base, contactIds: named.map(c => c.id), contactNames: named.map(c => `${c.firstName} ${c.lastName}`) };
  const nowISO = new Date().toISOString();
  const tasks = tasksFor(v.taskIds, d);
  const work = workTypeOfTasks(v.taskIds, base.workType);
  const later = v.mode === 'later';
  return {
    id: newId('slot'),
    userId: base.userId,
    date: later ? undefined : v.date,
    orderIndex: v.index ?? 50,
    status: later ? 'basket' : 'planned',
    how: v.how,
    workType: work,
    target: base.target,
    tasks,
    contactIds: base.contactIds.slice(0, 1),
    contactNames: base.contactNames.slice(0, 1),
    timeMode: v.time && !later ? 'exact' : 'flow',
    fixedTime: later ? undefined : v.time,
    durationMin: durationFor(v.how, tasks),
    sendTime: v.how === 'email' || v.how === 'text' ? v.time ?? '10:00' : undefined,
    notes: v.label,
    basketNote: later ? v.label : undefined,
    source: 'manual',
    createdAt: nowISO,
    updatedAt: nowISO
  };
}

/** Put the next-step slot into its day at the chosen place (or the basket). */
export function placeNextSlot(ctx: { daySlots: (d: string) => PlanSlot[]; layoutCtx: (d: string) => import('../engine/schedule').LayoutContext }, slot: PlanSlot, index: number | undefined, message: string, justLoggedId?: string) {
  if (!slot.date || slot.status === 'basket' || slot.how === 'email' || slot.how === 'text') {
    addSlots([slot], message);
    return;
  }
  const day = ctx.daySlots(slot.date);
  const lc = ctx.layoutCtx(slot.date);
  const at = slot.timeMode === 'exact' && slot.fixedTime ? indexForTime(day, lc, slot.fixedTime) : index ?? layoutDay(day, lc).sequence.length;
  // Never write back a stale copy of the slot that was just logged.
  upsertSlots(insertAt(day, slot, at).filter(x => x.id !== justLoggedId), message);
}

/** The six working days the strip shows: from tomorrow, always including the chosen day. */
function stripDays(today: string, chosen: string): string[] {
  let start = nextWeekday(today);
  if (chosen > addDays(start, 7)) {
    start = chosen;
    for (let i = 0; i < 2; i++) {
      let d = addDays(start, -1);
      while (isWeekend(d)) d = addDays(d, -1);
      if (d > today) start = d;
    }
  }
  const out: string[] = [];
  let d = start;
  while (out.length < 6) {
    if (!isWeekend(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export const NextStepCard: React.FC<{
  value: NextStepValue;
  onChange: (v: NextStepValue) => void;
  target: SlotTarget;
  workType: WorkType;
  dealership?: Dealership;
  /** Excluded from the day load (the slot being logged). */
  ignoreSlotId?: string;
  defaultLabel?: string;
  fromLabel?: string;
}> = ({ value, onChange, target, workType, dealership, ignoreSlotId, fromLabel = 'From your note' }) => {
  const ctx = useMyPlan();
  const { today, catalog } = ctx;
  const set = (patch: Partial<NextStepValue>) => onChange({ ...value, ...patch });
  const work = workTypeOfTasks(value.taskIds, workType);
  const taskOptions = tasksForWorkType(work === 'block' || work === 'group' ? workType : work, !!dealership && hasKeyfetch(dealership, catalog));
  const days = stripDays(today, value.date);
  const [showDate, setShowDate] = useState(false);

  const candidate = useMemo(() => buildNextSlot({ ...value, mode: 'plan', time: undefined }, { userId: ctx.viewUser.id, target, workType, contactIds: [], contactNames: [] }, dealership), [value, ctx.viewUser.id, target, workType, dealership]);
  const dayInfo = useMemo(
    () =>
      days.map(date => {
        const daySlots = ctx.daySlots(date).filter(s => s.id !== ignoreSlotId);
        const stops = daySlots.filter(s => s.how !== 'email' && s.how !== 'text' && s.target.kind !== 'block').length;
        const busy = daySlots.filter(s => s.source === 'calendar' && s.target.kind === 'block');
        const best = value.how === 'email' ? [] : suggestPlacements(daySlots, { ...candidate, date }, ctx.layoutCtx(date), 3);
        return { date, stops, busy, best, fits: best.some(b => b.fits) };
      }),
    [days.join(), candidate, ignoreSlotId, ctx]
  );
  const chosen = dayInfo.find(d => d.date === value.date);

  return (
    <Card className="space-y-4 border-blue-200 p-4">
      <div>
        <div className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
          <CalendarDays className="h-5 w-5 text-blue-600" /> Next step
        </div>
        {value.from.length > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-blue-900">
            <Quote className="h-3.5 w-3.5" /> {fromLabel}:
            {value.from.map(f => (
              <span key={f} className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold">“{f}”</span>
            ))}
          </div>
        ) : (
          <div className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-600">
            <Sparkles className="h-3.5 w-3.5" /> Suggested for {dealership?.stage ?? 'this stage'} — change anything.
          </div>
        )}
      </div>

      <Segmented
        ariaLabel="Next step"
        value={value.mode}
        onChange={mode => set({ mode, skipReason: mode === 'skip' ? value.skipReason ?? 'waiting' : value.skipReason })}
        options={[
          { value: 'plan', label: 'Plan it' },
          { value: 'later', label: 'Plan later' },
          { value: 'skip', label: 'No next step' }
        ]}
      />

      {value.mode !== 'skip' && (
        <>
          <div>
            <div className="mb-1 text-[15px] font-semibold text-slate-800">How</div>
            <Segmented ariaLabel="How" value={value.how} onChange={how => set({ how, index: undefined })} options={HOW_OPTIONS} />
          </div>
          <div>
            <div className="mb-1 text-[15px] font-semibold text-slate-800">What</div>
            <div className="flex flex-wrap gap-2">
              {taskOptions.map(t => {
                const on = value.taskIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ taskIds: on ? value.taskIds.filter(x => x !== t.id) : [...value.taskIds, t.id] })}
                    className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {value.mode === 'plan' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold text-slate-800">When — your week at a glance</div>
            <button type="button" className="text-[13px] font-semibold text-blue-700 underline" onClick={() => setShowDate(s => !s)}>
              {showDate ? 'Hide date' : 'Another date'}
            </button>
          </div>
          {showDate && <input type="date" className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-[16px]" value={value.date} min={nextWeekday(today)} onChange={e => e.target.value && set({ date: isWeekend(e.target.value) ? nextWeekday(e.target.value) : e.target.value, index: undefined })} />}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {dayInfo.map(d => {
              const sel = d.date === value.date;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => set({ date: d.date, index: undefined, time: value.from.length && value.time && d.date === value.date ? value.time : undefined })}
                  aria-pressed={sel}
                  className={`rounded-xl border-2 p-2 text-left ${sel ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className="text-[13px] font-bold text-slate-900">{parseISODate(d.date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</div>
                  <div className="text-[12px] text-slate-600">{d.stops ? `${d.stops} stop${d.stops > 1 ? 's' : ''}` : 'Free'}</div>
                  <div className={`text-[11px] font-semibold ${d.fits || value.how === 'email' ? 'text-emerald-700' : 'text-amber-700'}`}>{value.how === 'email' ? 'Send' : d.fits ? 'Fits' : 'Tight'}</div>
                  {d.busy.length > 0 && <div className="mt-0.5 truncate text-[11px] text-slate-500" title={d.busy.map(b => b.target.name).join(', ')}>Busy: {d.busy[0].target.name}</div>}
                </button>
              );
            })}
          </div>
          {value.how !== 'email' && chosen && (
            <div className="space-y-2">
              <div className="text-[14px] text-slate-600">Best times on {formatDayShort(value.date)}</div>
              <div className="flex flex-wrap gap-2">
                {value.time && (
                  <button type="button" className="min-h-[44px] rounded-xl border-2 border-blue-600 bg-blue-600 px-3 text-[15px] font-semibold text-white">
                    {format12h(value.time)}
                    {value.from.length ? ' (from your note)' : ''}
                  </button>
                )}
                {chosen.best.map(b => {
                  const t = b.fixedTime ?? toHHMM(b.start);
                  const sel = !value.time && value.index === b.index;
                  return (
                    <button
                      key={`${b.index}-${t}`}
                      type="button"
                      onClick={() => set({ time: undefined, index: b.index })}
                      title={b.reason}
                      className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold ${sel ? 'border-blue-600 bg-blue-600 text-white' : b.fits ? 'border-slate-200 bg-white text-slate-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                    >
                      ~{format12h(b.start)}
                      {b.fits ? '' : ' · tight'}
                    </button>
                  );
                })}
                <label className="flex items-center gap-1.5 text-[14px] text-slate-700">
                  <Clock3 className="h-4 w-4" /> Exact time
                  <input type="time" className="min-h-[44px] rounded-xl border border-slate-300 px-2 text-[15px]" value={value.time ?? ''} onChange={e => set({ time: e.target.value || undefined })} />
                </label>
              </div>
            </div>
          )}
          {value.contactIds?.length ? (
            <div className="text-[14px] text-slate-700">
              With: <strong>{ctx.contacts.filter(c => value.contactIds!.includes(c.id)).map(c => `${c.firstName} ${c.lastName}`).join(', ')}</strong>
              {value.from.length ? ' (from your note)' : ''}
            </div>
          ) : null}
          <div className="rounded-xl bg-slate-50 p-2.5 text-[14px] text-slate-700">
            Will add: <strong>{HOW_LABEL[value.how]}</strong> — {describeNext({ label: value.label, date: value.date, time: value.time })}
          </div>
        </div>
      )}

      {value.mode === 'later' && <p className="text-[14px] text-slate-600">It goes into your plan-later basket so you can drop it into a day when you plan your week.</p>}

      {value.mode === 'skip' && (
        <div className="space-y-2">
          <div className="text-[15px] font-semibold text-slate-800">Why is there no next step?</div>
          <Segmented ariaLabel="Reason" value={value.skipReason ?? 'waiting'} onChange={r => set({ skipReason: r, nurtureDate: r === 'not_now' ? value.nurtureDate ?? addDays(today, 60) : value.nurtureDate })} options={NEXT_SKIP_REASONS.map(r => ({ value: r.id, label: r.label }))} />
          {value.skipReason === 'not_now' && (
            <label className="flex items-center gap-2 text-[15px] text-slate-700">
              Follow up on
              <input type="date" className="min-h-[44px] rounded-xl border border-slate-300 px-3 text-[16px]" value={value.nurtureDate ?? ''} onChange={e => set({ nurtureDate: e.target.value })} />
            </label>
          )}
          {value.skipReason === 'waiting' && <p className="text-[14px] text-slate-600">It will show as “Waiting on them” and remind you in 5 working days if nothing is planned.</p>}
        </div>
      )}
    </Card>
  );
};

/** Plain-text summary used after saving and on cards. */
export const nextStepSummary = (v: NextStepValue) =>
  v.mode === 'skip' ? `No next step — ${NEXT_SKIP_REASONS.find(r => r.id === v.skipReason)?.label ?? ''}` : v.mode === 'later' ? `In your plan-later basket: ${v.label}` : `${HOW_LABEL[v.how]} — ${describeNext(v)}`;

/** "Plan it" sheet for a dealership with no next step (from cards, Bench, Pipeline or the record). */
export const NextStepSheet: React.FC<{ dealershipId: string; onClose: () => void }> = ({ dealershipId, onClose }) => {
  const ctx = useMyPlan();
  const d = ctx.dealershipById.get(dealershipId);
  const last: Activity | undefined = ctx.activities
    .filter(a => a.dealershipId === dealershipId && a.status === 'completed' && a.activityType !== 'System Note')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
  const work = (d ? workTypeForStage(d.stage) : null) ?? 'prospect';
  const reading = useMemo(
    () => readNote({ note: last?.notes ?? '', today: ctx.today, stage: d?.stage, workType: work, dealershipName: d?.dealershipName ?? '', contacts: ctx.contacts.filter(c => c.dealershipId === dealershipId) }),
    [last?.id, ctx.today, d?.stage, work, d?.dealershipName, ctx.contacts, dealershipId]
  );
  const [value, setValue] = useState<NextStepValue>(() => ({ ...valueFromReading(reading, ctx.today), mode: reading.noFurtherAction ? 'skip' : 'plan' }));
  const [done, setDone] = useState<string | null>(null);
  if (!d) return null;
  const contacts = ctx.contacts.filter(c => c.dealershipId === d.id);
  const target: SlotTarget = { kind: 'dealership', id: d.id, name: d.dealershipName, city: d.city, state: d.state, coords: d.coordinates, address: [d.address, d.city, `${d.state} ${d.zipCode}`].filter(Boolean).join(', ') };

  const save = () => {
    if (value.mode === 'skip') {
      const now = new Date().toISOString();
      const label = NEXT_SKIP_REASONS.find(r => r.id === value.skipReason)?.label ?? '';
      submitWriteback({
        activities: [
          {
            id: newId('act'),
            dealershipId: d.id,
            dealershipName: d.dealershipName,
            userId: ctx.viewUser.id,
            userName: `${ctx.viewUser.firstName} ${ctx.viewUser.lastName}`,
            activityType: 'System Note',
            communicationType: 'System',
            status: 'completed',
            plannedDate: ctx.today,
            plannedTime: toHHMM(ctx.now.getHours() * 60 + ctx.now.getMinutes()),
            completedAt: now,
            notes: `No next step: ${label}${value.skipReason === 'not_now' && value.nurtureDate ? ` — follow up ${value.nurtureDate}` : ''}.`,
            productsDiscussed: [],
            nextAction: value.skipReason !== 'none' ? label : undefined,
            nextActionDate: value.skipReason === 'not_now' ? value.nurtureDate : undefined,
            tags: [`next_skipped_${value.skipReason}`]
          }
        ],
        dealershipUpdates: value.skipReason === 'not_now' && value.nurtureDate ? [{ ...d, nurtureFollowUpDate: value.nurtureDate }] : [],
        newContacts: [],
        actionPoints: [],
        points: [],
        audit: [],
        totalPoints: 0
      });
      setDone(nextStepSummary(value));
      return;
    }
    const slot = buildNextSlot(value, { userId: ctx.viewUser.id, target, workType: work, contactIds: contacts.slice(0, 1).map(c => c.id), contactNames: contacts.slice(0, 1).map(c => `${c.firstName} ${c.lastName}`), contacts }, d);
    placeNextSlot(ctx, slot, value.index, value.mode === 'later' ? 'Added to your plan-later basket' : 'Next step added to your plan');
    setDone(nextStepSummary(value));
  };

  return (
    <Sheet
      title={`Next step — ${d.dealershipName}`}
      summary={d.stage}
      onClose={onClose}
      footer={
        done ? (
          <Button variant="primary" size="lg" block onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={save} disabled={value.mode !== 'skip' && value.taskIds.length === 0}>
            {value.mode === 'skip' ? 'Save — no next step' : value.mode === 'later' ? 'Add to plan-later basket' : 'Add to my plan'}
          </Button>
        )
      }
    >
      {done ? (
        <Card className="p-5 text-center text-[17px] font-semibold text-emerald-900">✓ {done}</Card>
      ) : (
        <div className="space-y-4">
          {last && (
            <Card className="p-3 text-[14px] text-slate-700">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-900">
                <CalendarX2 className="h-4 w-4 text-rose-600" /> Last contact {new Date(last.completedAt!).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {last.activityType}
              </div>
              {last.notes}
            </Card>
          )}
          <NextStepCard value={value} onChange={setValue} target={target} workType={work} dealership={d} fromLabel="From your last note" />
        </div>
      )}
    </Sheet>
  );
};
