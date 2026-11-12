// Settings → Team rules: the numbers behind "Needs help" and "Keep an eye".
// Owners, executives and admins can change them; managers can read them.

import React from 'react';
import { RotateCcw } from 'lucide-react';
import type { PipelineStage } from '../../types/crm';
import { Btn, Panel } from '../../components/ui/kit';
import { DEFAULT_RULES, NEW_REP_MILESTONES, TeamRules } from './signals';
import { resetRules, setRules, useTeamState } from './store';

const STUCK_STAGES: { stage: PipelineStage; label: string }[] = [
  { stage: 'Visited', label: 'Visited' },
  { stage: 'Follow-up', label: 'Follow-up' },
  { stage: 'In Progress', label: 'In progress' },
  { stage: 'HOT', label: 'Hot' },
  { stage: 'Negotiation', label: 'Negotiation' },
  { stage: 'Contract', label: 'Contract' }
];

const Num: React.FC<{ value: number; onChange: (n: number) => void; min?: number; max?: number; disabled?: boolean; label: string; suffix?: string }> = ({ value, onChange, min = 0, max = 999, disabled, label, suffix }) => (
  <span className="inline-flex items-center gap-1.5">
    <input
      type="number"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={e => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, Math.round(n))));
      }}
      className="min-h-[36px] w-20 rounded-lg border border-slate-300 bg-white px-2 text-[14px] font-semibold text-slate-900 disabled:bg-slate-100 disabled:text-slate-600"
    />
    {suffix && <span className="text-[14px] text-slate-600">{suffix}</span>}
  </span>
);

export const TeamRulesPanel: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { rules } = useTeamState();
  const changed = JSON.stringify(rules) !== JSON.stringify(DEFAULT_RULES);
  const row = (text: React.ReactNode, control: React.ReactNode) => (
    <div className="flex flex-col gap-1.5 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[14px] text-slate-700">{text}</span>
      {control}
    </div>
  );
  const set = (patch: Partial<TeamRules>) => canEdit && setRules(patch);

  return (
    <div className="space-y-4">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">Team rules</h3>
            <p className="mt-1 max-w-2xl text-[14px] text-slate-600">
              These decide who shows as <b>Needs help</b> or <b>Keep an eye</b> on My team, and what reps see in their own "Worth a look" card. A rep needs help if any rule says so, or if three or more things need an eye at once.
              {!canEdit && ' Only an owner or admin can change them.'}
            </p>
          </div>
          {canEdit && changed && (
            <Btn size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={resetRules}>
              Back to defaults
            </Btn>
          )}
        </div>

        <h4 className="mt-5 text-[14px] font-bold text-slate-900">Effort</h4>
        {row('Needs help after this many working days with nothing logged', <Num label="Quiet days" value={rules.quietDays} min={1} max={10} disabled={!canEdit} onChange={n => set({ quietDays: n })} suffix="days" />)}
        {row(
          <>
            Keep an eye when visits and calls fall below this share of the rep's <i>own</i> usual week (needs help below half of it)
          </>,
          <Num label="Drop percent" value={rules.dropPct} min={10} max={100} disabled={!canEdit} onChange={n => set({ dropPct: n })} suffix="%" />
        )}
        {row('Only compare with usual when the rep normally logs at least', <Num label="Minimum usual per week" value={rules.minUsualPerWeek} min={1} max={50} disabled={!canEdit} onChange={n => set({ minUsualPerWeek: n })} suffix="a week" />)}
        {row('Keep an eye when nothing is planned for the next', <Num label="Plan-ahead days" value={rules.planAheadDays} min={1} max={5} disabled={!canEdit} onChange={n => set({ planAheadDays: n })} suffix="working days" />)}

        <h4 className="mt-5 text-[14px] font-bold text-slate-900">Deals</h4>
        {row('Deals with no next step: keep an eye from the first; needs help at', <Num label="No next step for needs help" value={rules.noNextStepHelp} min={1} max={20} disabled={!canEdit} onChange={n => set({ noNextStepHelp: n })} suffix="deals" />)}
        {row('Clients count as at risk when health is below', <Num label="At-risk health" value={rules.atRiskHealth} min={10} max={90} disabled={!canEdit} onChange={n => set({ atRiskHealth: n })} />)}
        <div className="py-3">
          <div className="text-[14px] text-slate-700">A deal is stuck after this many days in one stage (needs help at twice that, or two stuck deals)</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STUCK_STAGES.map(s => (
              <label key={s.stage} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-[14px] text-slate-700">{s.label}</span>
                <Num label={`${s.label} days`} value={rules.stuckDays[s.stage] ?? 30} min={3} max={180} disabled={!canEdit} onChange={n => set({ stuckDays: { [s.stage]: n } })} />
              </label>
            ))}
          </div>
        </div>

        <h4 className="mt-5 text-[14px] font-bold text-slate-900">Skill</h4>
        {row(
          <>
            Needs help after losing this many deals at the <i>same</i> stage (one fewer is keep an eye)
          </>,
          <Num label="Losses at the same stage" value={rules.lossesSameStage} min={2} max={10} disabled={!canEdit} onChange={n => set({ lossesSameStage: n })} suffix="deals" />
        )}
        {row('…within the last', <Num label="Loss window" value={rules.lossesWindowDays} min={7} max={120} disabled={!canEdit} onChange={n => set({ lossesWindowDays: n })} suffix="days" />)}

        <h4 className="mt-5 text-[14px] font-bold text-slate-900">Support and follow-through</h4>
        {row("Flag a rep's request for help that's had no answer after", <Num label="Assist wait days" value={rules.assistWaitDays} min={1} max={10} disabled={!canEdit} onChange={n => set({ assistWaitDays: n })} suffix="working days" />)}
        {row('Once a manager acts on a flag, keep it quiet for (unless it gets worse)', <Num label="Handled quiet days" value={rules.handledQuietDays} min={1} max={30} disabled={!canEdit} onChange={n => set({ handledQuietDays: n })} suffix="days" />)}
      </Panel>

      <Panel className="p-6">
        <h3 className="text-[16px] font-bold text-slate-900">New starter milestones</h3>
        <p className="mt-1 text-[14px] text-slate-600">For a rep's first 60 working days. Missing one is keep an eye; missing two is needs help.</p>
        <ul className="mt-3 space-y-1.5">
          {NEW_REP_MILESTONES.map(m => (
            <li key={m.day} className="flex gap-3 text-[14px]">
              <span className="w-16 shrink-0 font-semibold text-slate-900">Day {m.day}</span>
              <span className="text-slate-700">{m.label.charAt(0).toUpperCase() + m.label.slice(1)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
};
