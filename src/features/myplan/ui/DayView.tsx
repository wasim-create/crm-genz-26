import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  Home,
  Inbox,
  ListTodo,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Timer,
  Video,
  X,
  ClipboardCheck
} from 'lucide-react';
import { PlanSlot } from '../types';
import { DayLayout, dragIntent, holdRestOfDay, layoutDay, nudgedTime, replanPreview } from '../engine/schedule';
import { addDays, format12h, formatDayLong, formatDuration, toHHMM } from '../engine/time';
import { isClockChangeDay } from '../engine/timezones';
import { arrowMove, updateActionPoint, updateSlot, upsertSlots, useMyPlanState } from '../data/store';
import { Button, Card, EmptyState, SectionTitle } from './primitives';
import { SlotCard } from './SlotCard';
import { useMyPlan } from './context';
import { mapsUrl } from './slotHelpers';

const FULLNESS_TEXT: Record<DayLayout['fullness'], { label: string; tone: string; width: string }> = {
  empty: { label: 'Nothing planned', tone: 'bg-slate-200', width: 'w-0' },
  light: { label: 'Light day', tone: 'bg-sky-400', width: 'w-1/4' },
  good: { label: 'Good day', tone: 'bg-emerald-500', width: 'w-3/5' },
  full: { label: 'Full day', tone: 'bg-amber-500', width: 'w-[88%]' },
  too_much: { label: 'Too much', tone: 'bg-rose-500', width: 'w-full' }
};

const TIP_KEY = 'apexdrive_myplan_drag_tip_seen';

interface DragState {
  id: string;
  startY: number;
  dy: number;
  aboveId?: string;
  belowId?: string;
  aboveH: number;
  belowH: number;
}

export const DayView: React.FC = () => {
  const ctx = useMyPlan();
  const { date, today, daySlots, layout, readOnly, openSheet, viewUser, basket, repZone } = ctx;
  const slots = daySlots(date);
  const lay = layout(date);
  const byId = new Map(slots.map(s => [s.id, s]));
  const sequence = lay.sequence.map(id => byId.get(id)!).filter(Boolean);
  const messages = lay.messages.map(m => byId.get(m.slotId)!).filter(Boolean);
  const skipped = slots.filter(s => s.status === 'skipped');
  const isPast = date < today;
  const isToday = date === today;
  const editable = !readOnly && !isPast;

  const refs = useRef(new Map<string, HTMLLIElement>());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [tipSeen, setTipSeen] = useState(() => {
    try {
      return localStorage.getItem(TIP_KEY) === '1';
    } catch {
      return true;
    }
  });
  const dismissTip = () => {
    setTipSeen(true);
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  // ----- smart drag -----
  const intentFor = (d: DragState) => {
    const neighbourH = d.dy < 0 ? d.aboveH : d.belowH;
    const hasNeighbour = d.dy < 0 ? !!d.aboveId : !!d.belowId;
    return dragIntent(d.dy, neighbourH / 2, hasNeighbour);
  };

  const nudgePreview = (slot: PlanSlot, minutes: number) => {
    const start = lay.timings[slot.id]?.start ?? 600;
    const desired = nudgedTime(start, minutes);
    const trialSlots = slots.map(s => (s.id === slot.id ? { ...s, timeMode: 'exact' as const, fixedTime: toHHMM(desired), autoPinned: false } : s));
    const trial = layoutDay(trialSlots, ctx.layoutCtx(date));
    const actual = trial.timings[slot.id]?.start ?? desired;
    const pushed = lay.sequence.filter(id => id !== slot.id && (trial.timings[id]?.start ?? 0) - (lay.timings[id]?.start ?? 0) >= 5).length;
    const late = trial.warnings.some(w => w.code === 'late_for_fixed' && !lay.warnings.some(b => b.code === w.code && b.slotId === w.slotId));
    return { desired, actual, pushed, late };
  };

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>, slot: PlanSlot) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = lay.sequence.indexOf(slot.id);
    const aboveId = lay.sequence[idx - 1];
    const belowId = lay.sequence[idx + 1];
    const h = (id?: string) => (id ? refs.current.get(id)?.offsetHeight ?? 180 : 180);
    setDrag({ id: slot.id, startY: e.clientY, dy: 0, aboveId, belowId, aboveH: h(aboveId), belowH: h(belowId) });
    if (!tipSeen) dismissTip();
  };

  const moveDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const limit = Math.max(drag.aboveH, drag.belowH) * 0.75;
    setDrag({ ...drag, dy: Math.max(-limit, Math.min(limit, e.clientY - drag.startY)) });
  };

  const endDrag = () => {
    if (!drag) return;
    const slot = byId.get(drag.id);
    const intent = intentFor(drag);
    setDrag(null);
    if (!slot) return;
    if (intent.mode === 'swap') {
      const other = byId.get((intent.direction === 'up' ? drag.aboveId : drag.belowId)!);
      arrowMove(viewUser.id, date, slot.id, intent.direction, `Swapped ${slot.target.name} with ${other?.target.name ?? 'the next stop'}. Times updated.`);
    } else if (intent.mode === 'nudge') {
      const p = nudgePreview(slot, intent.minutes);
      updateSlot(
        slot.id,
        { timeMode: 'exact', fixedTime: toHHMM(p.actual), autoPinned: false },
        { message: `${slot.target.name} now ${format12h(p.actual)}${p.pushed ? ` · ${p.pushed} later stop${p.pushed === 1 ? '' : 's'} moved` : ''}` }
      );
    }
  };

  const dragLabel = (slot: PlanSlot): { text: string; tone: string } | null => {
    if (!drag || drag.id !== slot.id) return null;
    const intent = intentFor(drag);
    if (intent.mode === 'none') return { text: 'Drag a little to change the time · further to swap', tone: 'bg-ink-2' };
    if (intent.mode === 'swap') {
      const other = byId.get((intent.direction === 'up' ? drag.aboveId : drag.belowId)!);
      return { text: `↕ Release to swap with ${other?.target.name ?? 'the next stop'}`, tone: 'bg-solid-violet' };
    }
    const p = nudgePreview(slot, intent.minutes);
    const mins = Math.abs(intent.minutes);
    const what = `${mins >= 60 && mins % 60 === 0 ? `${mins / 60} hr` : `${mins} min`} ${intent.minutes < 0 ? 'earlier' : 'later'}`;
    if (p.actual !== p.desired) return { text: `Earliest possible: ${format12h(p.actual)}`, tone: 'bg-solid-amber' };
    return {
      text: `${format12h(p.actual)} · ${what}${p.pushed ? ` · moves ${p.pushed} later stop${p.pushed === 1 ? '' : 's'}` : ''}${p.late ? ' · overlaps a set time' : ''}`,
      tone: p.late ? 'bg-solid-amber' : 'bg-brand-hover'
    };
  };

  const arrow = (slot: PlanSlot, dir: 'up' | 'down') =>
    arrowMove(viewUser.id, date, slot.id, dir, `Moved ${slot.target.name} ${dir === 'up' ? 'earlier' : 'later'}. Times updated.`);

  // ----- banners -----
  const replan = isToday && !readOnly ? replanPreview(slots, ctx.layoutCtx(date)) : { changes: [] as unknown[] };
  const clockToday = isClockChangeDay(repZone, date);
  const clockTomorrow = isClockChangeDay(repZone, addDays(date, 1));

  // ----- timeline rows (with "+ Add here" between stops) -----
  const items: React.ReactNode[] = [];
  const rows = lay.rows;
  let lastSlotK = -1;
  rows.forEach((row, i) => {
    if (row.kind === 'travel') {
      if (row.minutes > 0)
        items.push(
          <li key={`t${i}`} className="flex items-center gap-2 py-1.5 pl-6 text-[15px] text-slate-500">
            <span className="h-6 border-l-2 border-dashed border-slate-300" />
            <Car className="h-4 w-4" />
            <span>
              {row.fromHome ? 'Drive from home' : 'Drive'} · {formatDuration(row.minutes - ctx.engine.parkingMin)}
              {row.miles > 0 ? ` (${Math.round(row.miles * 1.3)} mi)` : ''} + parking
            </span>
          </li>
        );
      return;
    }
    if (row.kind === 'lunch') {
      items.push(
        <li key={`l${i}`} className="py-1 pl-6">
          <button
            type="button"
            disabled={!editable}
            onClick={() => openSheet({ kind: 'lunch', date })}
            className="flex min-h-[44px] items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 text-[15px] text-slate-600 hover:border-blue-400 disabled:hover:border-slate-300"
          >
            <Coffee className="h-4 w-4" />
            Lunch {format12h(row.start)} – {format12h(row.end)}
            {editable && <span className="font-semibold text-blue-700">· Change</span>}
          </button>
        </li>
      );
      return;
    }
    if (row.kind === 'home') {
      items.push(
        <li key={`h${i}`} className="flex items-center gap-2 py-1.5 pl-6 text-[15px] text-slate-500">
          <span className="h-6 border-l-2 border-dashed border-slate-300" />
          <Home className="h-4 w-4" />
          <span>
            Drive home · {formatDuration(row.minutes)} · home around {format12h(row.at)}
          </span>
        </li>
      );
    } else {
      const slot = byId.get(row.slotId);
      if (!slot) return;
      const idx = lay.sequence.indexOf(slot.id);
      const canDrag = editable && !slot.locked && slot.status === 'planned';
      const label = dragLabel(slot);
      const dragging = drag?.id === slot.id;
      items.push(
        <li
          key={slot.id}
          ref={el => {
            if (el) refs.current.set(slot.id, el);
            else refs.current.delete(slot.id);
          }}
          className="relative"
          style={dragging ? { transform: `translateY(${drag!.dy}px)`, zIndex: 30 } : undefined}
        >
          {label && (
            <div className={`pointer-events-none absolute -top-11 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-xl px-3 py-2 text-[15px] font-semibold text-onaccent shadow-lg ${label.tone}`} role="status">
              {label.text}
            </div>
          )}
          <div className={dragging ? 'rounded-2xl shadow-2xl ring-2 ring-blue-400' : ''}>
            <SlotCard
              slot={slot}
              start={row.start}
              end={row.end}
              canMoveUp={idx > 0}
              canMoveDown={idx < lay.sequence.length - 1}
              onMoveUp={editable ? () => arrow(slot, 'up') : undefined}
              onMoveDown={editable ? () => arrow(slot, 'down') : undefined}
              dragHandle={
                canDrag
                  ? {
                      onPointerDown: e => startDrag(e, slot),
                      onPointerMove: moveDrag,
                      onPointerUp: endDrag,
                      onPointerCancel: () => setDrag(null)
                    }
                  : undefined
              }
            />
          </div>
        </li>
      );
    }
    // "+ Add here" after a stop (and its drive home), when another stop follows.
    const next = rows[i + 1];
    const lastIdx = row.kind === 'slot' ? lay.sequence.indexOf(row.slotId) : -1;
    const isEndOfGroup = row.kind === 'home' || (row.kind === 'slot' && next?.kind !== 'home');
    if (row.kind === 'slot') lastSlotK = lastIdx;
    const k = lastSlotK;
    if (editable && isEndOfGroup && k >= 0 && k < lay.sequence.length - 1) {
      const nextId = lay.sequence[k + 1];
      const free = lay.timings[nextId].start - lay.timings[nextId].travelBefore - (row.kind === 'home' ? row.at : lay.timings[lay.sequence[k]].end);
      items.push(
        <li key={`add${i}`} className="py-1 pl-6">
          <button
            type="button"
            onClick={() => openSheet({ kind: 'add', preset: { date, insertIndex: k + 1, nonce: Date.now() } })}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-dashed border-blue-300 bg-blue-50/60 px-3 text-[14px] font-semibold text-blue-800 hover:bg-blue-100"
          >
            <Plus className="h-4 w-4" /> Add here{free >= 10 ? ` · ${formatDuration(free)} free` : ''}
          </button>
        </li>
      );
    }
  });

  return (
    <div className="pb-32">
      {(clockToday || clockTomorrow) && (
        <Card className="mb-3 flex items-center gap-2 border-sky-200 bg-sky-50 p-3 text-[15px] text-sky-950">
          <Clock className="h-5 w-5 text-sky-700" />
          {clockToday
            ? `Clocks ${clockToday === 'back' ? 'went back' : 'went forward'} an hour last night. The times shown are already the new time.`
            : `Clocks ${clockTomorrow === 'back' ? 'go back' : 'go forward'} an hour tonight. Tomorrow's times are already adjusted.`}
        </Card>
      )}

      {replan.changes.length > 0 && (
        <Card className="mb-3 flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-[16px] text-amber-950">
            <RefreshCw className="h-5 w-5 text-amber-700" />
            Your day has changed since you planned it — {replan.changes.length} stop{replan.changes.length === 1 ? '' : 's'} could move.
          </div>
          <Button variant="primary" onClick={() => openSheet({ kind: 'replan', date })}>
            Re-plan the rest of my day
          </Button>
        </Card>
      )}

      <DaySummary layout={lay} slots={slots} />

      {isToday && !readOnly && <NextCard sequence={sequence} messages={messages} layout={lay} />}

      {(sequence.length > 0 || messages.length > 0) && (
        <>
          <SectionTitle>Visits, calls &amp; meetings</SectionTitle>
          {editable && !tipSeen && sequence.length > 1 && (
            <Card className="mb-3 flex items-start gap-3 border-blue-200 bg-blue-50 p-3 text-[15px] text-blue-950">
              <span className="flex-1">
                <span className="font-bold">Tip:</span> use ▲ ▼ to swap the order. Or hold the ⋮⋮ handle and drag: a little to change the time (5, 10 or 30 minutes), further to swap with the next stop.
              </span>
              <button type="button" aria-label="Dismiss tip" onClick={dismissTip} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-blue-100">
                <X className="h-5 w-5" />
              </button>
            </Card>
          )}
          {sequence.length === 0 ? (
            <Card className="p-4 text-[16px] text-slate-600">No visits or calls on this day — only messages.</Card>
          ) : (
            <ol className="space-y-0" aria-label="Day timeline">
              {items}
            </ol>
          )}

          {messages.length > 0 && (
            <>
              <SectionTitle>Emails &amp; texts</SectionTitle>
              <p className="-mt-1 mb-2 text-[15px] text-slate-500">These don’t take time out of 10–4. Write them when it suits you; they go out at the time shown.</p>
              <div className="space-y-3">
                {messages.map(m => (
                  <SlotCard key={m.id} slot={m} compact />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {skipped.length > 0 && (
        <>
          <SectionTitle>Skipped</SectionTitle>
          <div className="space-y-3">
            {skipped.map(s => (
              <SlotCard key={s.id} slot={s} compact />
            ))}
          </div>
        </>
      )}

      <DayTodo />

      {editable && basket.length > 0 && sequence.length + messages.length > 0 && (
        <Card className="mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Inbox className="h-6 w-6 text-slate-500" />
            <div>
              <div className="text-[17px] font-semibold text-slate-900">Plan-later basket</div>
              <div className="text-[15px] text-slate-600">{basket.length} dealerships waiting to be planned</div>
            </div>
          </div>
          <Button variant="secondary" onClick={() => openSheet({ kind: 'basket' })}>
            Open basket
          </Button>
        </Card>
      )}

      {editable && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 md:hidden">
          {date === ctx.today && viewUser.id === ctx.user.id && (
            <button
              type="button"
              onClick={() => openSheet({ kind: 'logpick' })}
              className="flex h-14 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-[16px] font-bold text-slate-900 shadow-xl active:scale-95"
            >
              <ClipboardCheck className="h-5 w-5 text-blue-600" /> Log a visit
            </button>
          )}
          <button
            type="button"
            aria-label="Add to my plan"
            onClick={() => openSheet({ kind: 'add', preset: { date, nonce: Date.now() } })}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-onaccent shadow-xl active:scale-95"
          >
            <Plus className="h-8 w-8" />
          </button>
        </div>
      )}
    </div>
  );
};

const DaySummary: React.FC<{ layout: DayLayout; slots: PlanSlot[] }> = ({ layout, slots }) => {
  const { date, today, readOnly, openSheet, basket } = useMyPlan();
  const scheduled = slots.filter(s => s.status !== 'skipped');
  const visits = scheduled.filter(s => s.how === 'in_person' && s.target.kind !== 'block').length;
  const calls = scheduled.filter(s => s.how === 'phone' || s.how === 'meet').length;
  const msgs = scheduled.filter(s => s.how === 'email' || s.how === 'text').length;
  const isPast = date < today;
  const f = FULLNESS_TEXT[layout.fullness];

  if (scheduled.length === 0) {
    if (isPast) {
      return <EmptyState icon={<Clock className="h-7 w-7" />} title="Nothing was planned on this day" />;
    }
    return (
      <EmptyState
        icon={<CalendarPlus className="h-7 w-7" />}
        title={`Nothing planned for ${date === today ? 'today' : formatDayLong(date)}`}
        text="Add a dealership, or pull something in from your plan-later basket."
        action={
          readOnly ? undefined : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="primary" size="lg" icon={<Plus className="h-5 w-5" />} onClick={() => openSheet({ kind: 'add', preset: { date } })}>
                Add to my plan
              </Button>
              {basket.length > 0 && (
                <Button variant="secondary" size="lg" icon={<Inbox className="h-5 w-5" />} onClick={() => openSheet({ kind: 'basket' })}>
                  From basket ({basket.length})
                </Button>
              )}
            </div>
          )
        }
      />
    );
  }

  const parts = [
    visits ? `${visits} visit${visits === 1 ? '' : 's'}` : '',
    calls ? `${calls} call${calls === 1 ? '' : 's'} / Meet${calls === 1 ? '' : 's'}` : '',
    msgs ? `${msgs} email${msgs === 1 ? '' : 's'} / text${msgs === 1 ? '' : 's'}` : ''
  ].filter(Boolean);

  return (
    <Card className="p-4 sm:p-5">
      {layout.hasInPerson && layout.leaveBy !== undefined && !isPast ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-onaccent">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[15px] font-medium text-slate-500">Leave home by</div>
              <div className="text-[26px] font-extrabold leading-tight text-slate-900 tabular-nums">{format12h(layout.leaveBy)}</div>
            </div>
          </div>
          <div className="text-right text-[15px] text-slate-600">
            {layout.homeAt !== undefined && (
              <div>
                Home around <span className="font-bold text-slate-900">{format12h(layout.homeAt)}</span>
              </div>
            )}
            <div>{formatDuration(layout.driveMin)} driving in total</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            {isPast ? <CheckCircle2 className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
          </div>
          <div>
            <div className="text-[17px] font-bold text-slate-900">{isPast ? 'How this day went' : 'No driving today'}</div>
            <div className="text-[15px] text-slate-600">
              {layout.finish !== undefined ? `Finishes around ${format12h(layout.finish)}` : 'Messages only'}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-center justify-between text-[15px]">
          <span className="font-semibold text-slate-700">{parts.join(' · ')}</span>
          <span className="font-bold text-slate-900">{f.label}</span>
        </div>
        <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className={`h-full rounded-full ${f.tone} ${f.width}`} />
        </div>
      </div>

      {!isPast && layout.warnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {layout.warnings.slice(0, 3).map((w, i) => (
            <div key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2 text-[15px] text-amber-950">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <span>{w.message}</span>
              </div>
              {!readOnly && w.slotId && (
                <div className="mt-2 flex flex-wrap gap-2 pl-7">
                  <Button variant="secondary" onClick={() => openSheet({ kind: 'move', slotId: w.slotId! })}>
                    Move or change
                  </Button>
                  <Button variant="ghost" onClick={() => openSheet({ kind: 'edit', slotId: w.slotId! })}>
                    Edit
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

const NextCard: React.FC<{ sequence: PlanSlot[]; messages: PlanSlot[]; layout: DayLayout }> = ({ sequence, messages, layout }) => {
  const ctx = useMyPlan();
  const { openSheet, contacts } = ctx;
  const inProgress = sequence.find(s => s.status === 'in_progress');
  const next = inProgress ?? sequence.find(s => s.status === 'planned');
  const dueMessage = messages.find(m => m.status === 'planned');
  const target = next ?? dueMessage;
  if (!target) {
    return (
      <Card className="mt-4 flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        <div className="text-[17px] font-semibold text-emerald-900">All done for today. Nice work!</div>
      </Card>
    );
  }
  const timing = layout.timings[target.id];
  const contact = contacts.find(c => c.id === target.contactIds[0]);

  // "I've arrived": the real time becomes this slot's start. Everything still
  // to come keeps its time (nothing moves by itself) until the rep re-plans.
  const checkIn = () => {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const planned = timing?.start ?? nowMin;
    const diff = nowMin - planned;
    const held = holdRestOfDay(ctx.daySlots(ctx.date), layout, target.id).map(s =>
      s.id === target.id ? { ...s, status: 'in_progress' as const, checkInAt: now.toISOString() } : s
    );
    const msg =
      diff > 5
        ? `Checked in — ${formatDuration(diff)} later than planned. The rest of your day stays put until you re-plan.`
        : diff < -5
          ? `Checked in — ${formatDuration(-diff)} early.`
          : `Checked in at ${target.target.name}, on time.`;
    upsertSlots(held, msg);
  };

  const extend = (minutes: number) => {
    const extended = ctx.daySlots(ctx.date).map(s => (s.id === target.id ? { ...s, durationMin: s.durationMin + minutes } : s));
    const after = layoutDay(extended, ctx.layoutCtx(ctx.date));
    const newWarning = after.warnings.find(w => !layout.warnings.some(b => b.code === w.code && b.slotId === w.slotId));
    const finish = after.homeAt ?? after.finish;
    const msg = newWarning
      ? `Added ${minutes} min. Everything after this moves later. ${newWarning.message}`
      : `Added ${minutes} min. Everything after this moves later${finish ? ` — you'll finish around ${format12h(finish)}` : ''}.`;
    updateSlot(target.id, { durationMin: target.durationMin + minutes, durationOverridden: true }, { message: msg });
  };

  let actions: React.ReactNode;
  if (target.how === 'in_person') {
    actions =
      target.status === 'in_progress' ? (
        <>
          <Button variant="primary" size="lg" onClick={() => openSheet({ kind: 'outcome', slotId: target.id })} icon={<CheckCircle2 className="h-5 w-5" />}>
            Done — how did it go?
          </Button>
          <Button variant="secondary" size="lg" onClick={() => extend(15)} icon={<Timer className="h-5 w-5" />}>
            I need 15 more min
          </Button>
          <Button variant="ghost" onClick={() => extend(30)}>
            +30 min
          </Button>
        </>
      ) : (
        <>
          <a
            href={mapsUrl(target)}
            target="_blank"
            rel="noreferrer"
            onClick={() => updateSlot(target.id, { leftAt: new Date().toISOString() }, { undoable: false })}
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-semibold text-onaccent shadow-sm hover:bg-brand-hover"
          >
            <MapPin className="h-5 w-5" /> Start driving
          </a>
          <Button variant="secondary" size="lg" onClick={checkIn}>
            I've arrived
          </Button>
        </>
      );
  } else if (target.how === 'phone') {
    actions = (
      <>
        <a
          href={`tel:${contact?.phone ?? ''}`}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-semibold text-onaccent shadow-sm hover:bg-brand-hover"
        >
          <Phone className="h-5 w-5" /> Call now
        </a>
        <Button variant="secondary" size="lg" onClick={() => openSheet({ kind: 'outcome', slotId: target.id })}>
          How did it go?
        </Button>
      </>
    );
  } else if (target.how === 'meet') {
    actions = (
      <>
        <a
          href="https://meet.google.com/new"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-semibold text-onaccent shadow-sm hover:bg-brand-hover"
        >
          <Video className="h-5 w-5" /> Join meeting
        </a>
        <Button variant="secondary" size="lg" onClick={() => openSheet({ kind: 'outcome', slotId: target.id })}>
          How did it go?
        </Button>
      </>
    );
  } else {
    const body = encodeURIComponent((target.message ?? '').replace('{first name}', contact?.firstName ?? 'there'));
    const href =
      target.how === 'email'
        ? `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact?.email ?? '')}&body=${body}`
        : `sms:${contact?.phone ?? ''}?body=${body}`;
    actions = (
      <>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[17px] font-semibold text-onaccent shadow-sm hover:bg-brand-hover"
        >
          {target.how === 'email' ? <Mail className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          {target.how === 'email' ? 'Review & send' : 'Send text'}
        </a>
        <Button variant="secondary" size="lg" onClick={() => openSheet({ kind: 'outcome', slotId: target.id })}>
          Mark as sent
        </Button>
      </>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-2 text-[15px] font-bold uppercase tracking-wide text-blue-700">{target.status === 'in_progress' ? 'Now' : 'Next'}</div>
      <SlotCard
        slot={target}
        start={timing?.start}
        end={timing?.end}
        highlight
        hideActions
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions}
            <Button variant="ghost" onClick={() => openSheet({ kind: 'move', slotId: target.id })}>
              Can't do it?
            </Button>
          </div>
        }
      />
    </div>
  );
};

const DayTodo: React.FC = () => {
  const { date, today, viewUser, openSheet, readOnly } = useMyPlan();
  const state = useMyPlanState();
  const items = state.actionPoints.filter(
    a => a.userId === viewUser.id && !a.done && a.dueDate && (a.dueDate === date || (date === today && a.dueDate < today))
  );
  if (items.length === 0) return null;
  return (
    <>
      <SectionTitle
        right={
          <Button variant="ghost" onClick={() => openSheet({ kind: 'todo' })} icon={<ListTodo className="h-5 w-5" />}>
            All to-dos
          </Button>
        }
      >
        To do {date === today ? 'today' : 'on this day'}
      </SectionTitle>
      <Card className="divide-y divide-slate-100">
        {items.map(a => (
          <label key={a.id} className="flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-3">
            <input
              type="checkbox"
              className="h-6 w-6 accent-emerald-600"
              disabled={readOnly}
              checked={a.done}
              onChange={() => updateActionPoint(a.id, { done: true, doneAt: new Date().toISOString() }, 'Ticked off — synced to Google Tasks')}
            />
            <span className="flex-1 text-[16px] text-slate-800">{a.title}</span>
            {a.dueDate && a.dueDate < today && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[13px] font-semibold text-rose-700">Overdue</span>}
          </label>
        ))}
      </Card>
    </>
  );
};
