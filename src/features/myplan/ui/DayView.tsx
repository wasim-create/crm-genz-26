import React from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  Send,
  Timer,
  Video
} from 'lucide-react';
import { PlanSlot } from '../types';
import { DayLayout, layoutDay } from '../engine/schedule';
import { format12h, formatDayLong, formatDuration } from '../engine/time';
import { arrowMove, reorderWithinDay, updateActionPoint, updateSlot, useMyPlanState } from '../data/store';
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

export const DayView: React.FC = () => {
  const ctx = useMyPlan();
  const { date, today, daySlots, layout, readOnly, openSheet, viewUser, basket } = ctx;
  const slots = daySlots(date);
  const lay = layout(date);
  const byId = new Map(slots.map(s => [s.id, s]));
  const sequence = lay.sequence.map(id => byId.get(id)!).filter(Boolean);
  const messages = lay.messages.map(m => byId.get(m.slotId)!).filter(Boolean);
  const skipped = slots.filter(s => s.status === 'skipped');
  const isPast = date < today;
  const isToday = date === today;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const toIndex = lay.sequence.indexOf(String(e.over.id));
    const moving = byId.get(String(e.active.id));
    if (toIndex < 0 || !moving) return;
    reorderWithinDay(viewUser.id, date, moving.id, toIndex, `Moved ${moving.target.name}. Times updated.`);
  };

  const arrow = (slot: PlanSlot, dir: 'up' | 'down') =>
    arrowMove(viewUser.id, date, slot.id, dir, `Moved ${slot.target.name} ${dir === 'up' ? 'earlier' : 'later'}. Times updated.`);

  return (
    <div className="pb-32">
      <DaySummary layout={lay} slots={slots} />

      {isToday && !readOnly && <NextCard sequence={sequence} messages={messages} layout={lay} />}

      {(sequence.length > 0 || messages.length > 0) && (
        <>
          <SectionTitle
            right={
              !readOnly && !isPast && sequence.length > 1 ? (
                <span className="text-[14px] text-slate-500">Use ▲ ▼ or drag to change the order</span>
              ) : undefined
            }
          >
            Visits, calls &amp; meetings
          </SectionTitle>
          {sequence.length === 0 ? (
            <Card className="p-4 text-[16px] text-slate-600">No visits or calls on this day — only messages.</Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={lay.sequence} strategy={verticalListSortingStrategy}>
                <ol className="space-y-0" aria-label="Day timeline">
                  {lay.rows.map((row, i) => {
                    if (row.kind === 'travel') {
                      if (row.minutes === 0) return null;
                      return (
                        <li key={`t${i}`} className="flex items-center gap-2 py-1.5 pl-6 text-[15px] text-slate-500">
                          <span className="h-6 border-l-2 border-dashed border-slate-300" />
                          <Car className="h-4 w-4" />
                          <span>
                            {row.fromHome ? 'Drive from home' : 'Drive'} · {formatDuration(row.minutes - ctx.engine.parkingMin)}
                            {row.miles > 0 ? ` (${Math.round(row.miles * 1.3)} mi)` : ''} + parking
                          </span>
                        </li>
                      );
                    }
                    if (row.kind === 'lunch') {
                      return (
                        <li key={`l${i}`} className="flex items-center gap-2 py-1.5 pl-6 text-[15px] text-slate-500">
                          <span className="h-6 border-l-2 border-dashed border-slate-300" />
                          <Coffee className="h-4 w-4" />
                          <span>Lunch break · {format12h(row.start)}</span>
                        </li>
                      );
                    }
                    if (row.kind === 'home') {
                      return (
                        <li key={`h${i}`} className="flex items-center gap-2 py-1.5 pl-6 text-[15px] text-slate-500">
                          <span className="h-6 border-l-2 border-dashed border-slate-300" />
                          <Home className="h-4 w-4" />
                          <span>
                            Drive home · {formatDuration(row.minutes)} · home around {format12h(row.at)}
                          </span>
                        </li>
                      );
                    }
                    const slot = byId.get(row.slotId);
                    if (!slot) return null;
                    const idx = lay.sequence.indexOf(slot.id);
                    return (
                      <SortableSlot
                        key={slot.id}
                        slot={slot}
                        start={row.start}
                        end={row.end}
                        disabled={readOnly || isPast || slot.locked || slot.status === 'done'}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < lay.sequence.length - 1}
                        onMoveUp={isPast ? undefined : () => arrow(slot, 'up')}
                        onMoveDown={isPast ? undefined : () => arrow(slot, 'down')}
                      />
                    );
                  })}
                </ol>
              </SortableContext>
            </DndContext>
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

      {!readOnly && !isPast && basket.length > 0 && sequence.length + messages.length > 0 && (
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

      {!readOnly && !isPast && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 md:static md:mt-8 md:justify-start md:px-0">
          <Button
            variant="primary"
            size="lg"
            className="w-full max-w-md rounded-2xl shadow-lg md:w-auto"
            onClick={() => openSheet({ kind: 'add', preset: { date } })}
            icon={<Plus className="h-6 w-6" />}
          >
            Add to my plan
          </Button>
        </div>
      )}
    </div>
  );
};

const SortableSlot: React.FC<{
  slot: PlanSlot;
  start: number;
  end: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}> = ({ slot, start, end, disabled, ...rest }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, position: 'relative' }}
      className={isDragging ? 'opacity-90 shadow-xl' : ''}
    >
      <SlotCard
        slot={slot}
        start={start}
        end={end}
        dragHandle={disabled ? undefined : { ...attributes, ...listeners, ref: setActivatorNodeRef }}
        {...rest}
      />
    </li>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
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

  const extend = (minutes: number) => {
    const extended = ctx.daySlots(ctx.date).map(s => (s.id === target.id ? { ...s, durationMin: s.durationMin + minutes } : s));
    const after = layoutDay(extended, { home: ctx.home, settings: ctx.engine });
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
            className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-[17px] font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <MapPin className="h-5 w-5" /> Start driving
          </a>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => updateSlot(target.id, { status: 'in_progress', checkInAt: new Date().toISOString() }, { message: `Checked in at ${target.target.name}` })}
          >
            I've arrived
          </Button>
        </>
      );
  } else if (target.how === 'phone') {
    actions = (
      <>
        <a
          href={`tel:${contact?.phone ?? ''}`}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-[17px] font-semibold text-white shadow-sm hover:bg-blue-700"
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
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-[17px] font-semibold text-white shadow-sm hover:bg-blue-700"
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
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-[17px] font-semibold text-white shadow-sm hover:bg-blue-700"
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
