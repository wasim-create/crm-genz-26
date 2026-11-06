// "Plan my week" — the plan-later basket on one side, the working days on the
// other. Drag between them (mouse or touch), or tap "Put on a day".

import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Car, ChevronRight, GripVertical, Inbox, Lock, Plus } from 'lucide-react';
import { PlanSlot } from '../types';
import { isMessage } from '../engine/tasks';
import { format12h, formatWeekday, parseISODate, relativeDayLabel, weekDates } from '../engine/time';
import { moveSlotToDay, reorderWithinDay } from '../data/store';
import { Button, Card, HOW_ICON, TargetIcon, WORK_STYLE } from './primitives';
import { useMyPlan } from './context';

const FULL_LABEL = { empty: 'Free', light: 'Light', good: 'Good', full: 'Full', too_much: 'Too much' } as const;
const FULL_TONE = {
  empty: 'bg-slate-100 text-slate-600',
  light: 'bg-sky-50 text-sky-800',
  good: 'bg-emerald-50 text-emerald-800',
  full: 'bg-amber-50 text-amber-900',
  too_much: 'bg-rose-100 text-rose-800'
} as const;

export const WeekView: React.FC = () => {
  const { date, today, daySlots, layout, basket, readOnly, viewUser, openSheet, setDate, setView } = useMyPlan();
  const days = weekDates(date);
  const [dragging, setDragging] = useState<PlanSlot | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const containerOf = (id: string): string | undefined => {
    if (id === 'basket' || id.startsWith('day:')) return id;
    const s = [...basket, ...days.flatMap(d => daySlots(d))].find(x => x.id === id);
    if (!s) return undefined;
    return s.status === 'basket' ? 'basket' : `day:${s.date}`;
  };

  const ordered = (d: string) => {
    const lay = layout(d);
    const byId = new Map(daySlots(d).map(s => [s.id, s]));
    return [...lay.sequence, ...lay.messages.map(m => m.slotId)].map(id => byId.get(id)!).filter(Boolean);
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging([...basket, ...days.flatMap(d => daySlots(d))].find(s => s.id === id) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    if (!e.over) return;
    const activeId = String(e.active.id);
    const overId = String(e.over.id);
    const from = containerOf(activeId);
    const to = containerOf(overId);
    if (!from || !to) return;
    const slot = [...basket, ...days.flatMap(d => daySlots(d))].find(s => s.id === activeId);
    if (!slot) return;

    if (to === 'basket') {
      if (from !== 'basket') moveSlotToDay(activeId, undefined, { message: `${slot.target.name} is back in your basket` });
      return;
    }
    const targetDate = to.slice(4);
    const sequence = layout(targetDate).sequence;
    const overIndex = sequence.indexOf(overId);
    if (from === to) {
      if (overIndex >= 0 && !isMessage(slot.how)) reorderWithinDay(viewUser.id, targetDate, activeId, overIndex, `Moved ${slot.target.name}. Times updated.`);
      return;
    }
    moveSlotToDay(activeId, targetDate, {
      index: overIndex >= 0 ? overIndex : undefined,
      message: `${slot.target.name} → ${formatWeekday(targetDate)}. Tap it to change the time or tasks.`
    });
  };

  return (
    <div className="pb-24">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Basket */}
          <Column id="basket" disabled={readOnly} className="lg:w-[290px] lg:shrink-0">
            <Card className="p-3 lg:sticky lg:top-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-slate-600" />
                  <span className="text-[17px] font-bold text-slate-900">Plan-later basket</span>
                  <span className="rounded-full bg-slate-100 px-2 text-[14px] font-semibold">{basket.length}</span>
                </div>
              </div>
              <p className="mb-3 text-[14px] text-slate-600">Drag onto a day, or tap “Put on a day”.</p>
              <SortableContext items={basket.map(b => b.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {basket.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-4 text-center text-[15px] text-slate-500">
                      Empty. Tap “Plan later” on any dealership during the week to drop it here.
                    </div>
                  )}
                  {basket.map(s => (
                    <MiniCard
                      key={s.id}
                      slot={s}
                      disabled={readOnly}
                      action={
                        readOnly ? undefined : (
                          <Button variant="soft" className="mt-2 w-full" onClick={() => openSheet({ kind: 'add', preset: { basketSlotId: s.id, nonce: Date.now() } })}>
                            Put on a day
                          </Button>
                        )
                      }
                    />
                  ))}
                </div>
              </SortableContext>
              {!readOnly && (
                <Button variant="ghost" className="mt-3 w-full" icon={<Plus className="h-5 w-5" />} onClick={() => openSheet({ kind: 'add', preset: { planLater: true, nonce: Date.now() } })}>
                  Add to basket
                </Button>
              )}
            </Card>
          </Column>

          {/* Days */}
          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {days.map(d => {
              const lay = layout(d);
              const items = ordered(d);
              const past = d < today;
              return (
                <Column key={d} id={`day:${d}`} disabled={readOnly || past} className="min-w-0">
                  <Card className={`flex h-full min-h-[220px] flex-col p-3 ${d === today ? 'ring-2 ring-blue-500' : ''} ${past ? 'bg-slate-50' : ''}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(d);
                        setView('day');
                      }}
                      className="mb-2 flex items-start justify-between gap-1 rounded-lg text-left hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-[17px] font-bold text-slate-900">{formatWeekday(d)}</div>
                        <div className="text-[14px] text-slate-500">
                          {relativeDayLabel(d, today) !== formatWeekday(d) && relativeDayLabel(d, today).length < 10 ? `${relativeDayLabel(d, today)} · ` : ''}
                          {parseISODate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-5 w-5 text-slate-400" />
                    </button>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[13px] font-semibold ${FULL_TONE[lay.fullness]}`}>{FULL_LABEL[lay.fullness]}</span>
                      {lay.hasInPerson && lay.leaveBy !== undefined && !past && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[13px] font-semibold text-blue-800">
                          <Car className="h-3.5 w-3.5" /> Leave {format12h(lay.leaveBy)}
                        </span>
                      )}
                      {lay.warnings.some(w => w.code === 'out_of_town') && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[13px] font-semibold text-rose-800">Trip day</span>
                      )}
                    </div>
                    <SortableContext items={items.map(s => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex-1 space-y-2">
                        {items.map(s => (
                          <MiniCard key={s.id} slot={s} time={lay.timings[s.id]?.start ?? (s.sendTime ? undefined : undefined)} disabled={readOnly || past || s.locked || s.status === 'done'} />
                        ))}
                        {items.length === 0 && (
                          <div className="rounded-xl border-2 border-dashed border-slate-200 p-3 text-center text-[14px] text-slate-500">
                            {past ? 'Nothing logged' : 'Drop here'}
                          </div>
                        )}
                      </div>
                    </SortableContext>
                    {!readOnly && !past && (
                      <Button variant="ghost" className="mt-2" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ kind: 'add', preset: { date: d, nonce: Date.now() } })}>
                        Add
                      </Button>
                    )}
                  </Card>
                </Column>
              );
            })}
          </div>
        </div>
        <DragOverlay>{dragging ? <MiniCard slot={dragging} overlay /> : null}</DragOverlay>
      </DndContext>
      <WeekTotals days={days} />
    </div>
  );
};

const Column: React.FC<{ id: string; disabled?: boolean; className?: string; children: React.ReactNode }> = ({ id, disabled, className = '', children }) => {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} className={`rounded-2xl transition ${className} ${isOver ? 'outline outline-2 outline-offset-2 outline-blue-400' : ''}`}>
      {children}
    </div>
  );
};

const MiniCard: React.FC<{ slot: PlanSlot; time?: number; disabled?: boolean; overlay?: boolean; action?: React.ReactNode }> = ({ slot, time, disabled, overlay, action }) => {
  const { openSheet } = useMyPlan();
  const sortable = useSortable({ id: slot.id, disabled: disabled || overlay });
  const Icon = HOW_ICON[slot.how];
  const done = slot.status === 'done';
  return (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={overlay ? undefined : { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition, opacity: sortable.isDragging ? 0.4 : 1 }}
      className={`rounded-xl border border-l-4 border-slate-200 bg-white p-2 ${WORK_STYLE[slot.workType].edge} ${overlay ? 'shadow-xl' : ''} ${done ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={() => openSheet(done || slot.status === 'skipped' ? { kind: 'outcome', slotId: slot.id } : { kind: 'edit', slotId: slot.id })}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-x-1.5 text-[13px] font-semibold text-slate-500">
            <Icon className="h-4 w-4" />
            {isMessage(slot.how) ? (slot.sendTime ? format12h(slot.sendTime) : 'Message') : time !== undefined ? format12h(time) : slot.status === 'basket' ? 'Not scheduled' : ''}
            {slot.locked && <Lock className="h-3.5 w-3.5 text-indigo-600" />}
            {done && <span className="text-emerald-700">· Done</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <TargetIcon kind={slot.target.kind} className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="line-clamp-2 text-[15px] font-bold leading-snug text-slate-900">{slot.target.name}</span>
          </div>
          {slot.basketNote && <div className="mt-0.5 text-[13px] text-slate-500">“{slot.basketNote}”</div>}
          {slot.managerPriorityFrom && <div className="mt-0.5 text-[13px] font-semibold text-rose-700">From {slot.managerPriorityFrom}</div>}
        </button>
        {!disabled && !overlay && (
          <button
            type="button"
            aria-label={`Drag ${slot.target.name}`}
            className="flex h-9 w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
      </div>
      {action}
    </div>
  );
};

const WeekTotals: React.FC<{ days: string[] }> = ({ days }) => {
  const { daySlots, home, engine } = useMyPlan();
  void home;
  void engine;
  const all = days.flatMap(d => daySlots(d)).filter(s => s.status !== 'skipped');
  const count = (w: PlanSlot['workType']) => all.filter(s => s.workType === w).length;
  const visits = all.filter(s => s.how === 'in_person' && s.target.kind !== 'block').length;
  const remote = all.length - visits - all.filter(s => s.target.kind === 'block').length;
  return (
    <Card className="mt-4 flex flex-wrap gap-x-6 gap-y-2 p-4 text-[15px] text-slate-700">
      <span className="font-bold text-slate-900">This week</span>
      <span>{count('prospect')} prospect</span>
      <span>{count('signup')} sign-up &amp; onboarding</span>
      <span>{count('client')} client</span>
      <span>{count('group')} group</span>
      <span>
        · {visits} in person, {remote} calls / messages
      </span>
    </Card>
  );
};
