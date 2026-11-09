import React, { useRef, useState } from 'react';
import { Dealership, Activity, ManagerAssist, IntroductionIncentive, User } from '../../types/crm';
import { formatUSDate } from '../../utils/territory';
import { NextStepState, needsNextStep } from '../../utils/nextStepStatus';
import { AIService } from '../../services/aiService';
import { Badge, Btn, Page, PageHeader, Panel, SectionTitle, Stat, Switch } from '../ui/kit';
import { STAGE_META } from '../../utils/stages';
import { formatRelative, plural } from '../../utils/format';
import {
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  PhoneCall,
  Calendar,
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  ShieldCheck,
  Building,
  Tv,
  Trophy,
  Flame,
  PieChart,
  Users2
} from 'lucide-react';

interface ExecutiveDeskViewProps {
  dealerships: Dealership[];
  activities: Activity[];
  assists: ManagerAssist[];
  incentives: IntroductionIncentive[];
  users: User[];
  onOpenDealership: (dealership: Dealership) => void;
  nextSteps?: Map<string, NextStepState>;
}

export const ExecutiveDeskView: React.FC<ExecutiveDeskViewProps> = ({
  dealerships: allDealerships,
  activities: allActivities,
  assists: allAssists,
  incentives,
  users: allUsers,
  onOpenDealership,
  nextSteps
}) => {
  const [period, setPeriod] = useState<'Weekly' | 'Monthly' | 'Quarterly'>('Weekly');
  const [region, setRegion] = useState('all');
  const [repSort, setRepSort] = useState<'live' | 'contacts' | 'signed' | 'gaps' | 'points'>('contacts');
  const pageRef = useRef<HTMLDivElement>(null);
  const regions = [...new Set(allUsers.filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role)).map(u => u.region))];
  const inRegion = (userId?: string | null) => region === 'all' || allUsers.find(u => u.id === userId)?.region === region;
  const users = region === 'all' ? allUsers : allUsers.filter(u => u.region === region || !['new_rep', 'veteran_rep', 'team_lead'].includes(u.role));
  const dealerships = region === 'all' ? allDealerships : allDealerships.filter(d => inRegion(d.assignedRepId));
  const activities = region === 'all' ? allActivities : allActivities.filter(a => inRegion(a.userId));
  const assists = region === 'all' ? allAssists : allAssists.filter(a => inRegion(a.originRepId));

  // Strictly non-monetary. Everything is worked out from the data for the chosen period.
  const periodDays = period === 'Weekly' ? 7 : period === 'Monthly' ? 30 : 90;
  const since = Date.now() - periodDays * 86400000;
  const inPeriod = (iso?: string | null) => !!iso && new Date(iso).getTime() >= since;
  const repIds = new Set(users.filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role)).map(u => u.id));

  const totalClients = dealerships.filter(d => d.stage === 'Client' || d.stage === 'Onboarding').length;
  const activePipelineDeals = dealerships.filter(d => !['Pool', 'Client', 'Lost', 'Disqualified', 'Not Now'].includes(d.stage));
  const periodActs = activities.filter(a => a.status === 'completed' && inPeriod(a.completedAt));

  // Golden window: live contact only (visits, calls, Meets)
  const live = periodActs.filter(a => ['In-Person Visit', 'Phone Call', 'Google Meet'].includes(a.activityType));
  const goodTimeVisits = live.filter(a => a.isGoodWindow !== false).length;
  const badTimeVisits = live.filter(a => a.isGoodWindow === false).length;
  const totalVisits = goodTimeVisits + badTimeVisits;
  const goodTimePercent = totalVisits > 0 ? Math.round((goodTimeVisits / totalVisits) * 100) : 100;

  // Keyfetch units delivered in the period
  const totalUnitsToppedUp = dealerships.reduce((acc, d) => acc + (d.topups || []).filter(t => inPeriod(`${t.date}T12:00:00`)).reduce((s2, t) => s2 + t.quantity, 0), 0);

  // Deals signed in the period: solo vs with a Manager Assist
  const signedActs = periodActs.filter(a => a.tags?.includes('signed'));
  const wonDeals = Array.from(new Set(signedActs.map(a => a.dealershipId)));
  const assistedWon = signedActs.filter(a => a.tags?.includes('assist_meet') || assists.some(x => x.dealershipId === a.dealershipId && x.status === 'Completed')).length;
  const soloWon = Math.max(0, wonDeals.length - assistedWon);

  // Upsells won in the period
  const totalUpsellsWon = dealerships.reduce((acc, d) => acc + (d.upsells || []).filter(u => u.stage === 'Won' && inPeriod(u.wonDate)).length, 0);

  // Top rep by points earned in the period
  const pointsByRep: Record<string, number> = {};
  periodActs.filter(a => repIds.has(a.userId)).forEach(a => (pointsByRep[a.userId] = (pointsByRep[a.userId] ?? 0) + (a.pointsEarned ?? 0)));
  const topRepId = Object.entries(pointsByRep).sort((x, y) => y[1] - x[1])[0]?.[0];
  const topRep = users.find(u => u.id === topRepId);
  const visitsByRegion: Record<string, number> = {};
  live.filter(a => a.activityType === 'In-Person Visit').forEach(a => {
    const r = users.find(u => u.id === a.userId)?.region;
    if (r) visitsByRegion[r] = (visitsByRegion[r] ?? 0) + 1;
  });
  const topRegion = Object.entries(visitsByRegion).sort((x, y) => y[1] - x[1])[0];
  const pendingAssists = assists.filter(a => a.status === 'Pending' || a.status === 'Reschedule Proposed');
  const stalledGroupDeals = dealerships.filter(d => d.groupId && ['Negotiation', 'Contract', 'HOT'].includes(d.stage) && !d.hasActiveAssist);
  const atRiskClients = dealerships.filter(d => d.stage === 'Client' && (d.clientHealthScore ?? 100) < 70);
  const noNextStep = dealerships.filter(d => nextSteps && needsNextStep(nextSteps.get(d.id) ?? { kind: 'not_applicable' }));
  const noNextByRep = Object.entries(
    noNextStep.reduce<Record<string, number>>((acc, d) => {
      const u = users.find(x => x.id === d.assignedRepId);
      if (u) acc[`${u.firstName} ${u.lastName[0]}.`] = (acc[`${u.firstName} ${u.lastName[0]}.`] ?? 0) + 1;
      return acc;
    }, {})
  ).map(([n, c]) => `${n} ${c}`);

  // Product adoption across clients (from what each client actually signed)
  const clientList = dealerships.filter(d => d.stage === 'Client' || d.stage === 'Onboarding');
  const ADOPTION = [
    { id: 'prod_3', name: 'Keyfetch', color: 'bg-brand' },
    { id: 'prod_1', name: 'Vehicle Service Contract (VSC)', color: 'bg-success' },
    { id: 'prod_4', name: 'GAP', color: 'bg-amber-600' },
    { id: 'prod_10', name: 'Ceramic Pro (new launch)', color: 'bg-purple-600' },
    { id: 'prod_5', name: 'Tire & Wheel Protection', color: 'bg-teal-600' },
    { id: 'prod_9', name: 'EV Solutions / ChargeClub', color: 'bg-sky-600', also: 'prod_8' }
  ].map(p => ({ ...p, count: clientList.filter(d => d.signedProducts.includes(p.id) || (p.also ? d.signedProducts.includes(p.also) : false)).length }));

  const aiSummary = AIService.generateExecutiveSummary(period, {
    clientsSignedCount: wonDeals.length,
    activeDealsCount: activePipelineDeals.length,
    badTimeVisitCount: badTimeVisits,
    goodTimeVisitCount: goodTimeVisits,
    keyfetchUnitsRestocked: totalUnitsToppedUp,
    upsellsWonCount: totalUpsellsWon,
    topRepName: topRep ? `${topRep.firstName} ${topRep.lastName} (${topRep.region})` : 'No activity yet',
    topRepPoints: topRepId ? pointsByRep[topRepId] : 0,
    topRegion: topRegion ? `${topRegion[0]} (${topRegion[1]} visits)` : undefined,
    pendingAssistCount: pendingAssists.length,
    pendingAssistManagers: Array.from(new Set(pendingAssists.map(a => a.assignedManagerName))),
    stalledGroupDealCount: stalledGroupDeals.length,
    atRiskClientNames: atRiskClients.map(d => d.dealershipName),
    noNextStepCount: noNextStep.length,
    noNextStepByRep: noNextByRep
  });

  // Per-rep table: the quickest way to see who needs help.
  const repRows = users
    .filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role) && u.active !== false)
    .map(u => {
      const mine = activePipelineDeals.filter(d => d.assignedRepId === u.id);
      const contacts = live.filter(a => a.userId === u.id).length;
      const outside = live.filter(a => a.userId === u.id && a.isGoodWindow === false).length;
      const signed = new Set(signedActs.filter(a => a.userId === u.id).map(a => a.dealershipId)).size;
      const gaps = noNextStep.filter(d => d.assignedRepId === u.id).length;
      return { u, live: mine.length, contacts, outside, signed, gaps, points: pointsByRep[u.id] ?? 0 };
    })
    .sort((a, b) => b[repSort] - a[repSort]);

  const PERIOD_WORD = period === 'Weekly' ? 'this week' : period === 'Monthly' ? 'in the last 30 days' : 'in the last 90 days';
  const present = () => {
    const el = pageRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.().catch(() => undefined);
  };

  const attention: { title: string; tone: 'red' | 'amber' | 'violet'; items: Dealership[]; why: (d: Dealership) => string }[] = [
    { title: 'Live deals with no next step', tone: 'red', items: noNextStep, why: d => { const u = users.find(x => x.id === d.assignedRepId); return u ? `${u.firstName} ${u.lastName} · ${STAGE_META[d.stage]?.label ?? d.stage}` : d.stage; } },
    { title: 'Clients at risk', tone: 'red', items: atRiskClients, why: d => `Health ${d.clientHealthScore} · last contact ${formatRelative(d.lastTouchpointDate).toLowerCase()}` },
    { title: 'Group stores close to signing, no manager booked', tone: 'violet', items: stalledGroupDeals, why: d => `${d.groupName ?? ''} · ${STAGE_META[d.stage]?.label ?? d.stage}` }
  ];

  return (
    <div ref={pageRef} className="overflow-y-auto bg-slate-50 [&:fullscreen]:p-8">
      <Page>
        <PageHeader
          icon={<TrendingUp className="h-6 w-6" />}
          title="Executive desk"
          subtitle="How the team is doing: deals, field work, products and gaps. Counts only, no money forecasts."
          actions={
            <>
              <select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)} className="min-h-[40px] cursor-pointer rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-medium">
                <option value="all">All regions</option>
                {regions.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <Switch
                label="Period"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 'Weekly', label: 'Week' },
                  { value: 'Monthly', label: '30 days' },
                  { value: 'Quarterly', label: '90 days' }
                ]}
              />
              <Btn icon={<Tv className="h-4 w-4" />} onClick={present}>
                Present
              </Btn>
            </>
          }
        />

        <Panel className="space-y-4 p-5">
          <div className="text-[19px] font-bold text-slate-900">{aiSummary.headline}</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: 'Going well', items: aiSummary.highlights, icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
              { title: 'Needs attention', items: aiSummary.concerns, icon: <AlertOctagon className="h-4 w-4 text-amber-600" /> },
              { title: 'Do next', items: aiSummary.recommendations, icon: <Sparkles className="h-4 w-4 text-blue-600" /> }
            ].map(col => (
              <div key={col.title}>
                <div className="mb-1.5 flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                  {col.icon} {col.title}
                </div>
                <ul className="list-disc space-y-1 pl-5 text-[14px] text-slate-700">
                  {col.items.map((t, k) => (
                    <li key={k}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label={`Signed ${PERIOD_WORD}`} value={wonDeals.length} hint={`${assistedWon} with a manager · ${soloWon} alone`} tone="green" />
          <Stat label="Live deals" value={activePipelineDeals.length} hint={`${totalClients} clients in total`} />
          <Stat label="Visits, calls & Meets" value={totalVisits} hint={`${goodTimePercent}% between 10 and 4`} tone={goodTimePercent < 90 ? 'amber' : 'neutral'} />
          <Stat label="Keyfetch tags delivered" value={totalUnitsToppedUp.toLocaleString()} />
          <Stat label="Upsells won" value={totalUpsellsWon} hint="On existing clients" tone="violet" />
        </div>

        <Panel className="overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <SectionTitle>By rep, {PERIOD_WORD}</SectionTitle>
            <label className="inline-flex items-center gap-1.5 text-[14px] text-slate-600">
              Sort by
              <select value={repSort} onChange={e => setRepSort(e.target.value as typeof repSort)} className="min-h-[36px] cursor-pointer rounded-xl border border-slate-300 bg-white px-2 text-[14px]">
                <option value="contacts">Visits & calls</option>
                <option value="live">Live deals</option>
                <option value="signed">Signed</option>
                <option value="gaps">No next step</option>
                <option value="points">Points</option>
              </select>
            </label>
          </div>
          <table className="mt-2 w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                <th className="px-4 py-2.5">Rep</th>
                <th className="px-4 py-2.5 text-right">Live deals</th>
                <th className="px-4 py-2.5 text-right">Visits & calls</th>
                <th className="px-4 py-2.5 text-right">Signed</th>
                <th className="px-4 py-2.5 text-right">No next step</th>
                <th className="px-4 py-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {repRows.map(r => (
                <tr key={r.u.id}>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900">
                      {r.u.firstName} {r.u.lastName}
                    </div>
                    <div className="text-[13px] text-slate-500">{r.u.region}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.live}</td>
                  <td className="px-4 py-2.5 text-right">
                    {r.contacts}
                    {r.outside > 0 && <div className="text-[12px] text-amber-700">{r.outside} outside 10–4</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right">{r.signed}</td>
                  <td className={`px-4 py-2.5 text-right ${r.gaps ? 'font-semibold text-rose-700' : ''}`}>{r.gaps}</td>
                  <td className="px-4 py-2.5 text-right">{r.points.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {attention.map(block => (
            <Panel key={block.title} className="space-y-2 p-4">
              <SectionTitle right={<Badge tone={block.items.length ? block.tone : 'neutral'}>{block.items.length}</Badge>}>{block.title}</SectionTitle>
              {block.items.length === 0 ? (
                <p className="text-[14px] text-slate-500">None. Good.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {block.items.slice(0, 6).map(d => (
                    <li key={d.id}>
                      <button type="button" onClick={() => onOpenDealership(d)} className="w-full cursor-pointer py-2 text-left hover:text-blue-700">
                        <div className="text-[14px] font-semibold text-slate-900">{d.dealershipName}</div>
                        <div className="text-[13px] text-slate-500">{block.why(d)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {block.items.length > 6 && <p className="text-[13px] text-slate-500">and {block.items.length - 6} more</p>}
            </Panel>
          ))}
        </div>

        <Panel className="space-y-3 p-5">
          <SectionTitle right={<span className="text-[13px] text-slate-500">{plural(totalClients, 'client')}</span>}>Products across clients</SectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2">
            {ADOPTION.map(item => {
              const pct = Math.round((item.count / Math.max(1, totalClients)) * 100);
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-[14px]">
                    <span className="text-slate-800">{item.name}</span>
                    <span className="font-semibold text-slate-900">
                      {item.count} · {pct}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </Page>
    </div>
  );
};
