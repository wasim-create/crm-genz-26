import React, { useState } from 'react';
import { Dealership, Activity, ManagerAssist, IntroductionIncentive, User } from '../../types/crm';
import { formatUSDate } from '../../utils/territory';
import { AIService } from '../../services/aiService';
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
}

export const ExecutiveDeskView: React.FC<ExecutiveDeskViewProps> = ({
  dealerships,
  activities,
  assists,
  incentives,
  users,
  onOpenDealership
}) => {
  const [period, setPeriod] = useState<'Weekly' | 'Monthly' | 'Quarterly'>('Weekly');
  const [isTvMode, setIsTvMode] = useState(false);

  // Strictly Non-Monetary Calculations (Section 1 & 9)
  const totalClients = dealerships.filter(d => d.stage === 'Client' || d.stage === 'Onboarding').length;
  const activePipelineDeals = dealerships.filter(d => d.stage !== 'Pool' && d.stage !== 'Client' && d.stage !== 'Lost');
  const wonDeals = dealerships.filter(d => d.stage === 'Won' || d.stage === 'Signed' || d.stage === 'Client');
  
  // Good window compliance
  const goodTimeVisits = activities.filter(a => a.isGoodWindow !== false).length;
  const badTimeVisits = activities.filter(a => a.isGoodWindow === false).length;
  const totalVisits = goodTimeVisits + badTimeVisits;
  const goodTimePercent = totalVisits > 0 ? Math.round((goodTimeVisits / totalVisits) * 100) : 100;

  // Keyfetch units topped up
  const totalUnitsToppedUp = dealerships.reduce((acc, d) => acc + (d.topups || []).reduce((s, t) => s + t.quantity, 0), 0);

  // Solo vs Assisted Closes
  const assistedWon = assists.filter(a => a.status === 'Completed').length;
  const soloWon = Math.max(0, wonDeals.length - assistedWon);

  // Catalog Upsells Won
  const totalUpsellsWon = dealerships.reduce((acc, d) => acc + (d.upsells || []).filter(u => u.stage === 'Won').length, 0);

  // Dynamic AI Narrative digest (strictly non-monetary)
  const aiSummary = AIService.generateExecutiveSummary(period, {
    clientsSignedCount: 6,
    activeDealsCount: activePipelineDeals.length,
    badTimeVisitCount: badTimeVisits,
    goodTimeVisitCount: goodTimeVisits,
    keyfetchUnitsRestocked: totalUnitsToppedUp,
    upsellsWonCount: totalUpsellsWon,
    topRepName: 'Kevin Houk (Midwest)'
  });

  return (
    <div className={`space-y-6 ${isTvMode ? 'bg-slate-950 text-white min-h-screen p-8 rounded-3xl' : ''}`}>
      {/* Header & Controls */}
      <div className={`p-5 rounded-2xl border shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div>
          <h2 className={`text-xl font-bold tracking-tight flex items-center gap-2 ${isTvMode ? 'text-white' : 'text-slate-900'}`}>
            <TrendingUp className="w-5 h-5 text-blue-500" />
            <span>Executive Desk & Operational Storytelling</span>
          </h2>
          <p className={`text-xs mt-0.5 ${isTvMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Counts, penetration, velocity, and territory compliance. All financial projections removed.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* TV Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsTvMode(!isTvMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              isTvMode ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>{isTvMode ? 'Exit TV Mode' : 'Presentation / TV Mode'}</span>
          </button>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            {(['Weekly', 'Monthly', 'Quarterly'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  period === p ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Narrative Headline & 3x3 Grid (Section 9) */}
      <div className={`p-5 rounded-2xl border shadow-2xs space-y-4 ${
        isTvMode ? 'bg-slate-900 border-indigo-900/60' : 'bg-linear-to-br from-indigo-50/70 via-white to-blue-50/70 border-indigo-200/80'
      }`}>
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 font-mono">
              AI Storytelling Narrative ({period})
            </span>
            <h3 className={`text-base font-bold mt-0.5 ${isTvMode ? 'text-white' : 'text-slate-900'}`}>
              {aiSummary.headline}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Highlights */}
          <div className={`p-3.5 rounded-xl border ${isTvMode ? 'bg-slate-800/80 border-emerald-900/50' : 'bg-emerald-50/60 border-emerald-200'}`}>
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Key Highlights
            </span>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {aiSummary.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] leading-tight">
                  <span className="text-emerald-600 font-bold">•</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Concerns */}
          <div className={`p-3.5 rounded-xl border ${isTvMode ? 'bg-slate-800/80 border-amber-900/50' : 'bg-amber-50/60 border-amber-200'}`}>
            <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1 mb-2">
              <AlertOctagon className="w-3.5 h-3.5" /> Operational Concerns
            </span>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {aiSummary.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] leading-tight">
                  <span className="text-amber-600 font-bold">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommendations */}
          <div className={`p-3.5 rounded-xl border ${isTvMode ? 'bg-slate-800/80 border-indigo-900/50' : 'bg-indigo-50/60 border-indigo-200'}`}>
            <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1 mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Recommended Actions
            </span>
            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {aiSummary.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] leading-tight">
                  <span className="text-indigo-600 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* KPI Tiles (Strictly Counts & Quantities) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Clients Signed</span>
          <div className="text-3xl font-black font-mono text-emerald-600 mt-1">{totalClients}</div>
          <span className="text-[10px] text-slate-500">Active contracted rooftops</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Golden Window Ratio</span>
          <div className="text-3xl font-black font-mono text-blue-600 mt-1">{goodTimePercent}%</div>
          <span className="text-[10px] text-slate-500">{goodTimeVisits} of {totalVisits} visits inside 10a-4p</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Keyfetch Units Restocked</span>
          <div className="text-3xl font-black font-mono text-indigo-600 mt-1">{totalUnitsToppedUp.toLocaleString()}</div>
          <span className="text-[10px] text-slate-500">Physical fobs fulfilled YTD</span>
        </div>

        <div className={`p-4 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] font-bold text-slate-400 uppercase block">Catalog Upsells Won</span>
          <div className="text-3xl font-black font-mono text-purple-600 mt-1">{totalUpsellsWon}</div>
          <span className="text-[10px] text-slate-500">Ceramic Pro, VSC & GAP expansions</span>
        </div>
      </div>

      {/* Visual Charts Grid (Counts & Rates) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Solo vs Assisted Closes */}
        <div className={`p-5 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <Users2 className="w-4 h-4 text-blue-600" />
              <span>Solo vs. Assisted Closing Ratio</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">{wonDeals.length} Total Won</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span>Solo Rep Closes</span>
                <span>{soloWon} deals ({wonDeals.length > 0 ? Math.round((soloWon / wonDeals.length) * 100) : 0}%)</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 rounded-full" 
                  style={{ width: `${wonDeals.length > 0 ? (soloWon / wonDeals.length) * 100 : 0}%` }} 
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-semibold">
                <span>Manager Assisted Closes</span>
                <span>{assistedWon} deals ({wonDeals.length > 0 ? Math.round((assistedWon / wonDeals.length) * 100) : 0}%)</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 rounded-full" 
                  style={{ width: `${wonDeals.length > 0 ? (assistedWon / wonDeals.length) * 100 : 0}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Penetration across Active Clients */}
        <div className={`p-5 rounded-2xl border ${isTvMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} space-y-4`}>
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>Product Adoption Across Clients</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">{totalClients} Clients</span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { name: 'Keyfetch Smart Key Hardware', count: 18, color: 'bg-blue-600' },
              { name: 'Vehicle Service Contract (VSC)', count: 12, color: 'bg-emerald-600' },
              { name: 'Certified Limited Warranty', count: 8, color: 'bg-teal-600' },
              { name: 'Ceramic Pro (NEW Launch)', count: 6, color: 'bg-purple-600' },
              { name: 'GAP Protection', count: 5, color: 'bg-amber-600' }
            ].map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium">
                  <span>{item.name}</span>
                  <span className="font-mono font-bold">{item.count} lots ({Math.round((item.count / Math.max(1, totalClients)) * 100)}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${(item.count / Math.max(1, totalClients)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
