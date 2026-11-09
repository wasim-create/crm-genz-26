import React, { useMemo, useState } from 'react';
import { AlertTriangle, Car, Compass, FileSpreadsheet, LayoutGrid, Map as MapIcon, MapPin, Plus, Radar, Upload, X } from 'lucide-react';
import { Dealership, User } from '../../types/crm';
import { NextStepState, needsNextStep } from '../../utils/nextStepStatus';
import { calculateDistanceMiles, isWithinTerritory } from '../../utils/territory';
import { RouteMap } from '../common/RouteMap';
import { BackLayer, Badge, Btn, EmptyState, Page, PageHeader, Panel, Switch, Toolbar, useSticky } from '../ui/kit';
import { NextStepPill, nextStepSortKey } from '../ui/NextStepPill';
import { stageLabel, stageTone } from '../../utils/stages';
import { daysSince, lastContactText, matches, plural } from '../../utils/format';

interface ProspectPoolViewProps {
  dealerships: Dealership[];
  currentUser: User;
  onClaimDealership: (dealership: Dealership, reason?: string) => void;
  onOpenDealership: (dealership: Dealership) => void;
  /** Opens the shared Add New Prospect form (optionally straight into Open Radar). */
  onAddNewProspect: (opts?: { radar?: boolean }) => void;
  isPoolOnly?: boolean;
  /** What happens next with each dealership (Bench only). */
  nextSteps?: Map<string, NextStepState>;
  onPlanNextStep?: (dealership: Dealership) => void;
}

const REP_ROLES = ['new_rep', 'veteran_rep', 'team_lead'];
const STUCK_DAYS = 14;
const BENCH_STAGES = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding', 'Not Now', 'Lost', 'Disqualified'];

type Row = { d: Dealership; miles: number; inside: boolean };

export const ProspectPoolView: React.FC<ProspectPoolViewProps> = ({ dealerships, currentUser, onClaimDealership, onOpenDealership, onAddNewProspect, isPoolOnly = false, nextSteps, onPlanNextStep }) => {
  const isRep = REP_ROLES.includes(currentUser.role);
  const key = `${isPoolOnly ? 'pool' : 'bench'}_${currentUser.id}`;
  const [q, setQ] = useState('');
  const [stage, setStage] = useState(isPoolOnly ? 'all' : 'open');
  const [dist, setDist] = useState(isPoolOnly && isRep ? '100' : 'all');
  const [group, setGroup] = useState('all');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useSticky(`${key}_sort`, isPoolOnly ? 'near' : 'next');
  const [mode, setMode] = useSticky<'list' | 'map'>(`${key}_mode`, 'list');
  const [showImport, setShowImport] = useState(false);
  const [imported, setImported] = useState(false);
  const [farDeal, setFarDeal] = useState<Dealership | null>(null);
  const [farReason, setFarReason] = useState('');

  const ns = (d: Dealership) => nextSteps?.get(d.id);

  const base: Row[] = useMemo(
    () =>
      dealerships
        .filter(d => (isPoolOnly ? d.stage === 'Pool' || !d.assignedRepId : d.assignedRepId === currentUser.id && d.stage !== 'Client' && d.stage !== 'Pool'))
        .map(d => {
          const miles = calculateDistanceMiles(currentUser.homeCoords.lat, currentUser.homeCoords.lng, d.coordinates.lat, d.coordinates.lng);
          return { d, miles, inside: isWithinTerritory(miles) };
        }),
    [dealerships, isPoolOnly, currentUser]
  );

  const CHIP_TESTS: Record<string, (r: Row) => boolean> = {
    missing: r => !!ns(r.d) && needsNextStep(ns(r.d)!),
    stuck: r => (daysSince(r.d.lastTouchpointDate) ?? 999) >= STUCK_DAYS,
    hot: r => r.d.heatLevel === 'Hot' || r.d.stage === 'HOT',
    inside: r => r.inside,
    radar: r => r.d.source === 'Radar'
  };

  const rows = useMemo(() => {
    const list = base.filter(r => {
      const d = r.d;
      if (stage === 'open' && ['Lost', 'Disqualified', 'Not Now'].includes(d.stage)) return false;
      if (stage !== 'all' && stage !== 'open' && d.stage !== stage) return false;
      if (dist !== 'all' && r.miles > Number(dist) && !q) return false;
      if (group === 'group' && !d.groupId) return false;
      if (group === 'standalone' && d.groupId) return false;
      if (!matches(q, d.dealershipName, d.city, d.state, d.zipCode, d.groupName, d.address)) return false;
      return Object.entries(chips).every(([id, on]) => !on || CHIP_TESTS[id](r));
    });
    const cmp: Record<string, (a: Row, b: Row) => number> = {
      next: (a, b) => nextStepSortKey(ns(a.d)).localeCompare(nextStepSortKey(ns(b.d))),
      near: (a, b) => a.miles - b.miles,
      stale: (a, b) => (a.d.lastTouchpointDate ?? '').localeCompare(b.d.lastTouchpointDate ?? ''),
      lot: (a, b) => b.d.usedCarsOnLot - a.d.usedCarsOnLot,
      name: (a, b) => a.d.dealershipName.localeCompare(b.d.dealershipName)
    };
    return [...list].sort((a, b) => (cmp[sort] ?? cmp.near)(a, b) || a.miles - b.miles);
  }, [base, stage, dist, group, q, chips, sort, nextSteps]);

  const count = (id: string) => base.filter(CHIP_TESTS[id]).length;
  const toggle = (id: string) => setChips(c => ({ ...c, [id]: !c[id] }));
  const clear = () => {
    setQ('');
    setStage(isPoolOnly ? 'all' : 'open');
    setDist(isPoolOnly && isRep ? '100' : 'all');
    setGroup('all');
    setChips({});
  };

  const claim = (d: Dealership, miles: number) => {
    if (!isWithinTerritory(miles)) {
      setFarDeal(d);
      setFarReason('');
    } else onClaimDealership(d);
  };

  const stageOptions = isPoolOnly
    ? []
    : [
        { value: 'open', label: 'Open deals' },
        ...BENCH_STAGES.map(s => ({ value: s, label: stageLabel(s), count: base.filter(r => r.d.stage === s).length })).filter(o => o.count > 0)
      ];

  return (
    <Page>
      <PageHeader
        icon={<Compass className="h-6 w-6" />}
        title={isPoolOnly ? 'Prospect pool' : 'My prospects'}
        subtitle={
          isPoolOnly
            ? `Unclaimed dealerships, nearest first. Your territory is 60 miles from ${currentUser.homeZipCode}.`
            : `Dealerships you’ve claimed and are working. Your territory is 60 miles from ${currentUser.homeZipCode}.`
        }
        actions={
          <>
            <Btn icon={<Radar className="h-4 w-4" />} onClick={() => onAddNewProspect({ radar: true })}>
              Open Radar
            </Btn>
            {isPoolOnly && (
              <Btn icon={<Upload className="h-4 w-4" />} onClick={() => setShowImport(true)}>
                Import list
              </Btn>
            )}
            <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => onAddNewProspect()}>
              Add prospect
            </Btn>
          </>
        }
      />

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search name, city, ZIP or group' }}
        filters={[
          ...(isPoolOnly ? [] : [{ id: 'stage', allLabel: 'All stages, incl. closed', defaultValue: 'open', value: stage, onChange: setStage, options: stageOptions }]),
          {
            id: 'dist',
            allLabel: 'Any distance',
            defaultValue: isPoolOnly && isRep ? '100' : 'all',
            value: dist,
            onChange: setDist,
            options: [
              { value: '30', label: 'Within 30 miles', count: base.filter(r => r.miles <= 30).length },
              { value: '60', label: 'Within 60 miles (territory)', count: base.filter(r => r.miles <= 60).length },
              { value: '100', label: 'Within 100 miles', count: base.filter(r => r.miles <= 100).length }
            ]
          },
          { id: 'group', allLabel: 'Groups and standalone', value: group, onChange: setGroup, options: [{ value: 'group', label: 'Dealer groups only' }, { value: 'standalone', label: 'Standalone only' }] }
        ]}
        chips={
          isPoolOnly
            ? [
                { id: 'inside', label: 'Inside my territory', count: count('inside'), active: !!chips.inside, onClick: () => toggle('inside') },
                { id: 'radar', label: 'Radar finds', count: count('radar'), active: !!chips.radar, onClick: () => toggle('radar') }
              ]
            : [
                ...(nextSteps ? [{ id: 'missing', label: 'No next step', count: count('missing'), active: !!chips.missing, onClick: () => toggle('missing'), tone: 'attention' as const }] : []),
                { id: 'stuck', label: `No contact in ${STUCK_DAYS}+ days`, count: count('stuck'), active: !!chips.stuck, onClick: () => toggle('stuck') },
                { id: 'hot', label: 'Hot', count: count('hot'), active: !!chips.hot, onClick: () => toggle('hot') }
              ]
        }
        sort={{
          value: sort,
          onChange: setSort,
          options: [
            ...(isPoolOnly ? [] : [{ value: 'next', label: 'Next step (soonest)' }, { value: 'stale', label: 'Last contact (oldest first)' }]),
            { value: 'near', label: 'Distance (nearest)' },
            { value: 'lot', label: 'Lot size (largest first)' },
            { value: 'name', label: 'Name (A–Z)' }
          ]
        }}
        count={`${plural(rows.length, 'dealership')}${rows.length !== base.length ? ` of ${base.length}` : ''}`}
        onClear={clear}
        right={
          <Switch
            label="View"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'list', label: <><LayoutGrid className="h-4 w-4" /> List</> },
              { value: 'map', label: <><MapIcon className="h-4 w-4" /> Map</> }
            ]}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title={base.length === 0 ? (isPoolOnly ? 'The pool is empty' : 'You haven’t claimed any dealerships yet') : 'No dealerships match'}
          hint={base.length === 0 ? 'Use Open Radar or Add prospect to find new ones.' : 'Try clearing a filter.'}
        />
      ) : mode === 'map' ? (
        <Panel className="space-y-2 p-3">
          <RouteMap stops={rows.slice(0, 40).map(r => r.d)} currentUser={currentUser} onSelectDealership={onOpenDealership} height="560px" showRadius />
          <p className="px-1 text-[13px] text-slate-500">Showing the first {Math.min(rows.length, 40)}. The circle is your 60-mile territory.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ d, miles, inside }) => (
            <Panel key={d.id} interactive onClick={() => onOpenDealership(d)} className="flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold leading-snug text-slate-900">{d.dealershipName}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {d.city}, {d.state} {d.zipCode}
                  </p>
                </div>
                <Badge tone={inside ? 'neutral' : 'amber'} title={inside ? 'Inside your 60-mile territory' : 'Outside your 60-mile territory'}>
                  {!inside && <AlertTriangle className="h-3 w-3" />}
                  {Math.round(miles)} mi
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {!isPoolOnly && <Badge tone={stageTone(d.stage)}>{stageLabel(d.stage)}</Badge>}
                {d.groupName ? <Badge tone="violet">{d.groupName}</Badge> : <Badge>Standalone</Badge>}
                {d.source === 'Radar' && <Badge tone="blue">Radar find</Badge>}
                <span className="inline-flex items-center gap-1 text-[13px] text-slate-600">
                  <Car className="h-3.5 w-3.5 text-slate-400" />
                  {d.usedCarsOnLot} cars
                </span>
              </div>
              {!isPoolOnly && <NextStepPill state={ns(d)} onPlan={onPlanNextStep ? () => onPlanNextStep(d) : undefined} />}
              <div className="mt-auto flex items-center justify-between gap-2 text-[13px] text-slate-500">
                {isPoolOnly ? (
                  <>
                    <span>{d.fiSystem ? `F&I: ${d.fiSystem}` : ''}</span>
                    <span onClick={e => e.stopPropagation()}>
                      <Btn size="sm" variant={inside ? 'primary' : 'secondary'} onClick={() => claim(d, miles)}>
                        {inside ? 'Claim' : 'Claim with reason'}
                      </Btn>
                    </span>
                  </>
                ) : (
                  <span>{lastContactText(d.lastTouchpointDate)}</span>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {farDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4" role="dialog" aria-modal="true" aria-label="Claim outside your territory">
          <BackLayer onBack={() => setFarDeal(null)} />
          <Panel className="w-full max-w-md space-y-4 p-6 shadow-2xl">
            <div>
              <h2 className="text-[18px] font-bold text-slate-900">Claim outside your territory?</h2>
              <p className="mt-1 text-[14px] text-slate-600">{farDeal.dealershipName} is more than 60 miles from your home ZIP. Say why, so your manager can see it.</p>
            </div>
            <textarea
              value={farReason}
              onChange={e => setFarReason(e.target.value)}
              placeholder="e.g. I know the GM, or it’s part of a dealer group I already work with"
              rows={3}
              className="w-full rounded-xl border border-slate-300 p-3 text-[14px] focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setFarDeal(null)}>
                Cancel
              </Btn>
              <Btn
                variant="primary"
                disabled={!farReason.trim()}
                onClick={() => {
                  onClaimDealership(farDeal, farReason.trim());
                  setFarDeal(null);
                }}
              >
                Claim with reason
              </Btn>
            </div>
          </Panel>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4" role="dialog" aria-modal="true" aria-label="Import a list">
          <BackLayer onBack={() => setShowImport(false)} />
          <Panel className="w-full max-w-lg space-y-4 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-[18px] font-bold text-slate-900">Import a list of dealerships</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setShowImport(false)} className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[14px] text-slate-600">Upload a CSV or paste a Google Sheet link. We match the columns and skip dealerships already in the system.</p>
            <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
              <Upload className="mx-auto h-8 w-8 text-slate-400" />
              <div className="mt-2 text-[14px] font-semibold text-slate-800">Drop a CSV file here</div>
              <p className="mt-1 text-[13px] text-slate-500">Columns: name, address, city, state, ZIP, used cars, F&I system</p>
            </div>
            {imported && <p className="rounded-xl bg-emerald-50 p-3 text-[14px] text-emerald-800">This is a demo, so nothing was imported. In the live system the new dealerships appear here.</p>}
            <div className="flex justify-end gap-2">
              <Btn variant="ghost" onClick={() => setShowImport(false)}>
                Close
              </Btn>
              <Btn variant="primary" onClick={() => setImported(true)}>
                Try the sample list
              </Btn>
            </div>
          </Panel>
        </div>
      )}
    </Page>
  );
};
