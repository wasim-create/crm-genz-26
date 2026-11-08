// "What happens next" line on a finished card in My Plan.

import React, { useMemo } from 'react';
import { ArrowRight, CalendarCheck2, CalendarX2, Hourglass } from 'lucide-react';
import { needsNextStep, nextStepFor, nextStepText, PlannedRef } from '../../../utils/nextStepStatus';
import { HOW_SHORT, TASK_BY_ID } from '../engine/tasks';
import { useMyPlan } from './context';

export const NextStepLine: React.FC<{ dealershipId: string }> = ({ dealershipId }) => {
  const { dealershipById, activities, allSlots, today, openSheet, readOnly } = useMyPlan();
  const d = dealershipById.get(dealershipId);
  const state = useMemo(() => {
    if (!d) return null;
    const planned: PlannedRef[] = allSlots
      .filter(s => (s.status === 'planned' || s.status === 'basket') && (s.target.id === d.id || s.target.rooftopIds?.includes(d.id)))
      .map(s => ({ targetId: s.target.id, rooftopIds: s.target.rooftopIds, date: s.date, time: s.timeMode === 'exact' ? s.fixedTime : undefined, status: s.status, label: `${HOW_SHORT[s.how]}${s.tasks[0] ? `: ${TASK_BY_ID[s.tasks[0].taskId]?.label ?? ''}` : ''}` }));
    return nextStepFor(d, activities.filter(a => a.dealershipId === d.id), planned, [], today);
  }, [d, activities, allSlots, today]);
  if (!state || state.kind === 'not_applicable') return null;
  const missing = needsNextStep(state);
  const tone = missing ? 'bg-rose-50 text-rose-800 border-rose-200' : state.kind === 'waiting' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
  const Icon = missing ? CalendarX2 : state.kind === 'waiting' ? Hourglass : CalendarCheck2;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-[14px] ${tone}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-semibold">{state.kind === 'planned' ? 'Next: ' : ''}</span>
      <span className="min-w-0 flex-1">{nextStepText(state)}</span>
      {missing && !readOnly && (
        <button type="button" onClick={() => openSheet({ kind: 'nextstep', dealershipId })} className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-rose-600 px-3 text-[13px] font-bold text-white">
          Plan it <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
