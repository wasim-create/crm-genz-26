import React, { useMemo, useState } from 'react';
import { Briefcase, Car, Columns3, Flame, MapPin, Table } from 'lucide-react';
import { Dealership, PipelineStage, User } from '../../types/crm';
import { NextStepState, needsNextStep } from '../../utils/nextStepStatus';
import { Badge, EmptyState, Page, PageHeader, Panel, Switch, Toolbar, useSticky } from '../ui/kit';
import { NextStepPill, nextStepSortKey } from '../ui/NextStepPill';
import { PIPELINE_STAGES, STAGE_META, stageLabel, stageTone } from '../../utils/stages';
import { daysSince, formatRelative, lastContactText, matches, plural } from '../../utils/format';

interface PipelineViewProps {
  dealerships: Dealership[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onMoveStage: (dealership: Dealership, newStage: PipelineStage, note?: string) => void;
  onInitiateAssist: (dealership: Dealership) => void;
  allUsers?: User[];
  nextSteps?: Map<string, NextStepState>;
  onPlanNextStep?: (dealership: Dealership) => void;
}

const REP_ROLES = ['new_rep', 'veteran_rep', 'team_lead'];
const STUCK_DAYS = 14;

const SORTS = [
  { value: 'next', label: 'Next step (soonest)' },
  { value: 'stale', label: 'Last contact (oldest first)' },
  { value: 'temp', label: 'Temperature (warmest first)' },
  { value: 'lot', label: 'Lot size (largest first)' },
  { value: 'name', label: 'Name (A–Z)' }
];

export const PipelineView: React.FC<PipelineViewProps> = ({ dealerships, currentUser, onOpenDealership, onInitiateAssist, allUsers = [], nextSteps, onPlanNextStep }) => {
  const isRep = REP_ROLES.includes(currentUser.role);
  const key = `pipeline_${currentUser.id}`;
  const [q, setQ] = useState('');
  const defaultRep = isRep ? currentUser.id : currentUser.role === 'manager' ? 'team' : 'all';
  const [rep, setRep] = useSticky(`${key}_rep`, defaultRep);
  const [stage, setStage] = useState('all');
  const [group, setGroup] = useState('all');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useSticky(`${key}_sort`, 'next');
  const [mode, setMode] = useSticky<'board' | 'table'>(`${key}_mode`, 'board');

  const ns = (d: Dealership) => nextSteps?.get(d.id);
  const userName = (id?: string | null) => {
    const u = allUsers.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };
  const team = useMemo(() => {
    const reps = allUsers.filter(u => REP_ROLES.includes(u.role) && u.active !== false);
    return currentUser.role === 'manager' ? reps.filter(u => u.managerId === currentUser.id) : reps;
  }, [allUsers, currentUser]);

  // Everything live on the Pipeline, before the user's filters.
  const live = useMemo(() => dealerships.filter(d => PIPELINE_STAGES.includes(d.stage)), [dealerships]);
  const byRep = useMemo(() => {
    if (rep === 'all') return live;
    if (rep === 'team') return live.filter(d => team.some(u => u.id === d.assignedRepId));
    return live.filter(d => d.assignedRepId === rep);
  }, [live, rep, team]);

  const CHIP_TESTS: Record<string, (d: Dealership) => boolean> = {
    missing: d => !!ns(d) && needsNextStep(ns(d)!),
    hot: d => d.heatLevel === 'Hot' || d.stage === 'HOT',
    assist: d => !!d.hasActiveAssist,
    stuck: d => (daysSince(d.lastTouchpointDate) ?? 999) >= STUCK_DAYS
  };

  const filtered = useMemo(() => {
    const list = byRep.filter(d => {
      if (stage !== 'all' && d.stage !== stage) return false;
      if (group === 'group' && !d.groupId) return false;
      if (group === 'standalone' && d.groupId) return false;
      if (!matches(q, d.dealershipName, d.city, d.state, d.zipCode, d.groupName)) return false;
      return Object.entries(chips).every(([id, on]) => !on || CHIP_TESTS[id](d));
    });
    const cmp: Record<string, (a: Dealership, b: Dealership) => number> = {
      next: (a, b) => nextStepSortKey(ns(a)).localeCompare(nextStepSortKey(ns(b))),
      stale: (a, b) => (a.lastTouchpointDate ?? '').localeCompare(b.lastTouchpointDate ?? ''),
      temp: (a, b) => (b.relationshipTemperature?.score ?? 0) - (a.relationshipTemperature?.score ?? 0),
      lot: (a, b) => b.usedCarsOnLot - a.usedCarsOnLot,
      name: (a, b) => a.dealershipName.localeCompare(b.dealershipName)
    };
    return [...list].sort((a, b) => cmp[sort](a, b) || a.dealershipName.localeCompare(b.dealershipName));
  }, [byRep, stage, group, q, chips, sort, nextSteps]);

  const count = (id: string) => byRep.filter(CHIP_TESTS[id]).length;
  const toggle = (id: string) => setChips(c => ({ ...c, [id]: !c[id] }));
  const clear = () => {
    setQ('');
    setRep(defaultRep);
    setStage('all');
    setGroup('all');
    setChips({});
  };

  const repOptions = [
    ...(isRep ? [{ value: currentUser.id, label: 'My deals' }] : []),
    ...(currentUser.role === 'manager' ? [{ value: 'team', label: 'My team' }] : []),
    ...team.filter(u => u.id !== currentUser.id).map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, count: live.filter(d => d.assignedRepId === u.id).length }))
  ];
  const columns = PIPELINE_STAGES.filter(s => (stage === 'all' || s === stage) && filtered.some(d => d.stage === s));
  const hiddenEmpty = stage === 'all' ? PIPELINE_STAGES.filter(s => s !== 'Not Now' && !columns.includes(s)).length : 0;

  return (
    <Page>
      <PageHeader
        title="Pipeline"
        subtitle="Every live deal by stage. Click a deal to open it."
        actions={
          <Switch
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'board', label: <><Columns3 className="h-4 w-4" /> Board</> },
              { value: 'table', label: <><Table className="h-4 w-4" /> Table</> }
            ]}
          />
        }
      />

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search name, city, ZIP or group' }}
        filters={[
          { id: 'rep', allLabel: isRep ? 'Everyone’s deals' : 'All reps', defaultValue: defaultRep, value: rep, onChange: setRep, options: repOptions },
          { id: 'stage', allLabel: 'All stages', value: stage, onChange: setStage, options: PIPELINE_STAGES.map(s => ({ value: s, label: stageLabel(s), count: byRep.filter(d => d.stage === s).length })) },
          { id: 'group', allLabel: 'Groups and standalone', value: group, onChange: setGroup, options: [{ value: 'group', label: 'Dealer groups only' }, { value: 'standalone', label: 'Standalone only' }] }
        ]}
        chips={[
          ...(nextSteps ? [{ id: 'missing', label: 'No next step', count: count('missing'), active: !!chips.missing, onClick: () => toggle('missing'), tone: 'attention' as const }] : []),
          { id: 'hot', label: 'Hot', count: count('hot'), active: !!chips.hot, onClick: () => toggle('hot') },
          { id: 'assist', label: 'Manager assist', count: count('assist'), active: !!chips.assist, onClick: () => toggle('assist') },
          { id: 'stuck', label: `No contact in ${STUCK_DAYS}+ days`, count: count('stuck'), active: !!chips.stuck, onClick: () => toggle('stuck') }
        ]}
        sort={{ value: sort, onChange: setSort, options: SORTS }}
        count={`${plural(filtered.length, 'deal')}${filtered.length !== byRep.length ? ` of ${byRep.length}` : ''}`}
        onClear={clear}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No deals match" hint="Try clearing a filter." />
      ) : mode === 'board' ? (
        <>
        {hiddenEmpty > 0 && <p className="-mt-2 text-[13px] text-slate-500">{plural(hiddenEmpty, 'empty stage')} hidden.</p>}
        <div className="flex snap-x gap-3 overflow-x-auto pb-4">
          {columns.map(s => {
            const deals = filtered.filter(d => d.stage === s);
            return (
              <section key={s} aria-label={stageLabel(s)} className={`flex max-h-[calc(100vh-17rem)] w-[272px] shrink-0 snap-start flex-col rounded-2xl border border-slate-200 ${STAGE_META[s].column}`}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-[14px] font-bold text-slate-900">{stageLabel(s)}</span>
                  <Badge tone={stageTone(s)}>{deals.length}</Badge>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {deals.map(d => (
                    <DealCard key={d.id} d={d} state={ns(d)} repName={!isRep || rep !== currentUser.id ? userName(d.assignedRepId) : undefined} onOpen={() => onOpenDealership(d)} onPlan={onPlanNextStep ? () => onPlanNextStep(d) : undefined} onAssist={() => onInitiateAssist(d)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        </>
      ) : (
        <Panel className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                <th className="px-4 py-3">Dealership</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3">Next step</th>
                <th className="px-4 py-3">Last contact</th>
                <th className="px-4 py-3 text-right">Temp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr key={d.id} onClick={() => onOpenDealership(d)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{d.dealershipName}</div>
                    <div className="text-[13px] text-slate-500">
                      {d.city}, {d.state}
                      {d.groupName ? ` · ${d.groupName}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex flex-wrap gap-1">
                      <Badge tone={stageTone(d.stage)}>{stageLabel(d.stage)}</Badge>
                      {d.hasActiveAssist && <Badge tone="violet">Assist</Badge>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{userName(d.assignedRepId)}</td>
                  <td className="max-w-[320px] px-4 py-3">
                    <NextStepPill state={ns(d)} onPlan={onPlanNextStep ? () => onPlanNextStep(d) : undefined} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatRelative(d.lastTouchpointDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700">{d.relationshipTemperature ? `${d.relationshipTemperature.score}°` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </Page>
  );
};

const DealCard: React.FC<{ d: Dealership; state?: NextStepState; repName?: string; onOpen: () => void; onPlan?: () => void; onAssist: () => void }> = ({ d, state, repName, onOpen, onPlan, onAssist }) => {
  return (
    <Panel interactive onClick={onOpen} className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-bold leading-snug text-slate-900">{d.dealershipName}</span>
        {(d.heatLevel === 'Hot' || d.stage === 'HOT') && <Flame aria-label="Hot" className="h-4 w-4 shrink-0 fill-current text-orange-500" />}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-600">
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          {d.city}, {d.state}
        </span>
        <span className="inline-flex items-center gap-1">
          <Car className="h-3.5 w-3.5 text-slate-400" />
          {d.usedCarsOnLot} cars
        </span>
      </div>
      <NextStepPill state={state} onPlan={onPlan} />
      <div className="flex flex-wrap items-center justify-between gap-1 text-[12px] text-slate-500">
        <span>{repName ? `${repName} · ` : ''}{lastContactText(d.lastTouchpointDate)}</span>
        {d.hasActiveAssist ? (
          <Badge tone="violet">
            <Briefcase className="h-3 w-3" /> Assist
          </Badge>
        ) : (
          (d.stage === 'HOT' || d.stage === 'Negotiation') && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onAssist();
              }}
              className="cursor-pointer font-semibold text-violet-700 hover:underline"
            >
              Ask for assist
            </button>
          )
        )}
      </div>
    </Panel>
  );
};
