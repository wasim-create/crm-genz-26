import React from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, GripVertical, Lock, MinusCircle, Pencil, Star, UserRound } from 'lucide-react';
import { PlanSlot } from '../types';
import { distanceBand, milesBetween } from '../engine/geo';
import { estimatePoints } from '../services/writeback';
import { BandChip, Card, HowLabel, TargetIcon, WORK_STYLE, WorkChip } from './primitives';
import { useMyPlan } from './context';
import { taskSummary, timeText } from './slotHelpers';
import { ZONE_SHORT } from '../engine/timezones';
import { format12h } from '../engine/time';
import { Clock3, Info } from 'lucide-react';

export interface SlotCardProps {
  slot: PlanSlot;
  start?: number;
  end?: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement> & { ref?: (el: HTMLButtonElement | null) => void };
  compact?: boolean;
  highlight?: boolean;
  onOpen?: () => void;
  footer?: React.ReactNode;
  /** Hide the small "Details / Change time" row (e.g. on the NEXT card, which has its own buttons). */
  hideActions?: boolean;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  start,
  end,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  dragHandle,
  compact,
  highlight,
  onOpen,
  footer,
  hideActions
}) => {
  const { home, engine, catalog, gameRules, readOnly, openSheet, tzDiffFor } = useMyPlan();
  const tz = slot.date && start !== undefined ? tzDiffFor(slot, slot.date) : 0;
  const dealerZone = ZONE_SHORT[slot.target.timeZone ?? ''] ?? '';
  const miles = slot.target.coords ? milesBetween(home, slot.target.coords) : undefined;
  const band = miles !== undefined ? distanceBand(miles, engine) : undefined;
  const done = slot.status === 'done';
  const skipped = slot.status === 'skipped';
  const tasks = taskSummary(slot, catalog);
  const points = done ? slot.pointsAwarded : estimatePoints(slot, gameRules);
  const showArrows = !readOnly && !done && !skipped && (onMoveUp || onMoveDown);
  const open = onOpen ?? (() => openSheet(done || skipped ? { kind: 'outcome', slotId: slot.id } : { kind: 'edit', slotId: slot.id }));

  return (
    <Card
      className={`border-l-[6px] ${WORK_STYLE[slot.workType].edge} ${highlight ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${
        done || skipped ? 'bg-slate-50/80' : ''
      }`}
    >
      <div className="flex gap-2 p-3 sm:p-4">
        <button type="button" onClick={open} className="min-w-0 flex-1 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label={`Open ${slot.target.name}`}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-[18px] font-bold tabular-nums ${done || skipped ? 'text-slate-500' : 'text-slate-900'}`}>
              {timeText(slot, start, end)}
            </span>
            {tz !== 0 && start !== undefined && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[13px] font-semibold text-sky-800">
                {format12h(start + tz)} {dealerZone || 'dealership'} time
              </span>
            )}
            {slot.locked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[13px] font-semibold text-indigo-800">
                <Lock className="h-3.5 w-3.5" /> Locked
              </span>
            )}
            {done && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[13px] font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Done
              </span>
            )}
            {skipped && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[13px] font-semibold text-slate-700">
                <MinusCircle className="h-4 w-4" /> Skipped
              </span>
            )}
            {slot.status === 'in_progress' && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[13px] font-semibold text-white">You're here</span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <TargetIcon kind={slot.target.kind} className="h-5 w-5 shrink-0 text-slate-400" />
            <span className={`line-clamp-2 text-[19px] font-bold leading-snug ${done || skipped ? 'text-slate-600' : 'text-slate-900'}`}>{slot.target.name}</span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px]">
            {slot.target.kind !== 'block' && <WorkChip workType={slot.workType} />}
            <HowLabel how={slot.how} />
            {slot.how === 'in_person' && band && miles !== undefined && <BandChip band={band} miles={miles} />}
          </div>

          {!compact && (slot.contactNames.length > 0 || slot.target.rooftopIds?.length) && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[15px] text-slate-600">
              <UserRound className="h-4 w-4 text-slate-400" />
              <span className="truncate">
                {(slot.spokeWithNames?.length ? slot.spokeWithNames : slot.contactNames).join(', ') || 'No contact chosen'}
                {slot.target.kind === 'group' && slot.target.rooftopIds?.length ? ` · covers ${slot.target.rooftopIds.length} rooftop${slot.target.rooftopIds.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          )}

          {tasks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tasks.map(t => (
                <span key={t} className="rounded-lg bg-slate-100 px-2 py-1 text-[14px] font-medium text-slate-700">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
            {slot.source === 'assist' && slot.assistManagerName && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800">Manager Assist with {slot.assistManagerName}</span>
            )}
            {slot.managerPriorityFrom && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
                <Star className="h-3.5 w-3.5" /> From {slot.managerPriorityFrom}
              </span>
            )}
            {slot.source === 'calendar' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                <CalendarClock className="h-3.5 w-3.5" /> From Google Calendar
              </span>
            )}
            {points ? <span className="font-semibold text-amber-700">{done ? `+${points} pts earned` : `+${points} pts`}</span> : null}
            {slot.notes && !compact && <span className="text-slate-500">· {slot.notes}</span>}
            {skipped && slot.skippedReason && <span className="text-slate-500">· {slot.skippedReason}</span>}
          </div>
        </button>

        {showArrows ? (
          <div className="flex shrink-0 flex-col items-center gap-1">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp || slot.locked}
              aria-label={`Move ${slot.target.name} earlier`}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-25"
            >
              <ChevronUp className="h-6 w-6" />
            </button>
            {dragHandle && !slot.locked && (
              <button
                type="button"
                aria-label={`Drag ${slot.target.name} to a new position`}
                className="flex h-9 w-12 cursor-grab touch-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
                {...dragHandle}
              >
                <GripVertical className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown || slot.locked}
              aria-label={`Move ${slot.target.name} later`}
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-25"
            >
              <ChevronDown className="h-6 w-6" />
            </button>
          </div>
        ) : (
          !readOnly &&
          !done &&
          !skipped && (
            <button
              type="button"
              onClick={open}
              aria-label={`Change ${slot.target.name}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-5 w-5" />
            </button>
          )
        )}
      </div>
      {!hideActions && (slot.target.kind !== 'block' || (!readOnly && slot.status === 'planned')) && (
        <div className="flex flex-wrap gap-1 border-t border-slate-100 px-2 py-1.5">
          {slot.target.kind !== 'block' && (
            <button
              type="button"
              onClick={() => openSheet(slot.target.kind === 'group' ? { kind: 'details', groupId: slot.target.id } : { kind: 'details', dealershipId: slot.target.id })}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Info className="h-4 w-4" /> Details
            </button>
          )}
          {!readOnly && slot.status === 'planned' && (
            <button
              type="button"
              onClick={() => openSheet({ kind: 'time', slotId: slot.id })}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[15px] font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Clock3 className="h-4 w-4" /> Earlier / later
            </button>
          )}
        </div>
      )}
      {footer && <div className="border-t border-slate-100 px-3 pb-3 pt-2 sm:px-4">{footer}</div>}
    </Card>
  );
};
