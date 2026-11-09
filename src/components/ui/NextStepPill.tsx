import React from 'react';
import { CalendarClock } from 'lucide-react';
import { NextStepState, needsNextStep, nextStepText } from '../../utils/nextStepStatus';

/** "Next: Visit · Wed, Nov 11" in green, or a red "No next step" with Plan it. */
export const NextStepPill: React.FC<{ state?: NextStepState; onPlan?: () => void; className?: string }> = ({ state, onPlan, className = '' }) => {
  if (!state || state.kind === 'not_applicable') return null;
  const bad = needsNextStep(state);
  const tone = bad ? 'bg-rose-50 text-rose-800' : state.kind === 'waiting' || state.kind === 'nurture' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800';
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${tone} ${className}`}>
      <span className="flex min-w-0 items-start gap-1.5">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
        <span className="line-clamp-2">
          {state.kind === 'planned' ? 'Next: ' : ''}
          {nextStepText(state)}
        </span>
      </span>
      {bad && onPlan && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onPlan();
          }}
          className="shrink-0 cursor-pointer rounded-md bg-rose-600 px-2 py-0.5 text-[12px] font-bold text-white hover:bg-rose-700"
        >
          Plan it
        </button>
      )}
    </div>
  );
};

/** Sort key: missing first, then soonest date; nothing planned last. */
export function nextStepSortKey(s?: NextStepState): string {
  if (!s) return '9';
  if (needsNextStep(s)) return '0';
  if (s.kind === 'planned') return s.date ? `1${s.date}${s.time ?? ''}` : '2';
  if (s.kind === 'waiting') return `1${s.since}`;
  if (s.kind === 'nurture') return `1${s.date}`;
  return '8';
}
