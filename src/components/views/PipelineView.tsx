import React, { useState } from 'react';
import { Dealership, PipelineStage, User } from '../../types/crm';
import { 
  Building2, 
  MapPin, 
  Car, 
  Flame, 
  Search, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Table,
  Columns3,
  CalendarCheck,
  Briefcase,
  Users
} from 'lucide-react';
import { formatUSDate } from '../../utils/territory';

interface PipelineViewProps {
  dealerships: Dealership[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onMoveStage: (dealership: Dealership, newStage: PipelineStage, note?: string) => void;
  onInitiateAssist: (dealership: Dealership) => void;
  allUsers?: User[];
}

// Section 3: "Handed Off" is removed as a stage. Assist is a badge across HOT, Negotiation, or Contract.
const ORDERED_STAGES: { id: PipelineStage; label: string; color: string; badge: string }[] = [
  { id: 'Claimed', label: 'Claimed / Assigned', color: 'border-slate-300 bg-slate-50', badge: 'bg-slate-100 text-slate-700' },
  { id: 'Visit Planned', label: 'Visit Planned', color: 'border-blue-200 bg-blue-50/30', badge: 'bg-blue-100 text-blue-700' },
  { id: 'Visited', label: 'Visited / Met', color: 'border-indigo-200 bg-indigo-50/30', badge: 'bg-indigo-100 text-indigo-700' },
  { id: 'Follow-up', label: 'Active Follow-up', color: 'border-sky-200 bg-sky-50/30', badge: 'bg-sky-100 text-sky-700' },
  { id: 'HOT', label: 'HOT Deals 🔥', color: 'border-rose-300 bg-rose-50/30', badge: 'bg-rose-100 text-rose-800' },
  { id: 'Negotiation', label: 'Negotiation', color: 'border-purple-300 bg-purple-50/30', badge: 'bg-purple-100 text-purple-800' },
  { id: 'Won', label: 'Verbal Won', color: 'border-emerald-300 bg-emerald-50/30', badge: 'bg-emerald-100 text-emerald-800' },
  { id: 'Signed', label: 'Signed Contract', color: 'border-teal-300 bg-teal-50/30', badge: 'bg-teal-100 text-teal-800' },
  { id: 'Onboarding', label: 'Onboarding', color: 'border-indigo-300 bg-indigo-50/30', badge: 'bg-indigo-100 text-indigo-800' }
];

export const PipelineView: React.FC<PipelineViewProps> = ({
  dealerships,
  currentUser,
  onOpenDealership,
  onMoveStage,
  onInitiateAssist,
  allUsers = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [selectedHeat, setSelectedHeat] = useState<string>('all');

  // Filter dealerships (strictly non-monetary)
  const filtered = dealerships.filter(d => {
    if (d.stage === 'Pool' || d.stage === 'Lost' || d.stage === 'Client') return false;
    if (selectedRep === 'my' && d.assignedRepId !== currentUser.id && d.originRepId !== currentUser.id) return false;
    if (selectedHeat !== 'all' && d.heatLevel !== selectedHeat) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        d.dealershipName.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.state.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter deals..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>

          <select
            value={selectedRep}
            onChange={(e) => setSelectedRep(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Reps (Full Visibility)</option>
            <option value="my">Just My Accounts</option>
          </select>

          <select
            value={selectedHeat}
            onChange={(e) => setSelectedHeat(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="all">All Heat Levels</option>
            <option value="Hot">🔥 Hot Deals Only</option>
            <option value="Warm">Warm Leads</option>
            <option value="Cold">Cold</option>
          </select>
        </div>

        {/* View Mode & Pipeline Count */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold font-mono text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            {filtered.length} Active Deals
          </span>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Kanban Board"
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <Table className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x">
          {ORDERED_STAGES.map(stageObj => {
            const stageDeals = filtered.filter(d => d.stage === stageObj.id);

            return (
              <div
                key={stageObj.id}
                className={`w-72 shrink-0 rounded-2xl border p-3 flex flex-col max-h-[calc(100vh-14rem)] ${stageObj.color}`}
              >
                {/* Stage Header */}
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/60">
                  <span className="font-bold text-xs text-slate-800 tracking-tight">
                    {stageObj.label}
                  </span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${stageObj.badge}`}>
                    {stageDeals.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {stageDeals.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                      No deals in this stage
                    </div>
                  ) : (
                    stageDeals.map(d => {
                      const isHot = d.heatLevel === 'Hot';
                      const hasAssist = d.hasActiveAssist;

                      return (
                        <div
                          key={d.id}
                          onClick={() => onOpenDealership(d)}
                          className="bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer space-y-2"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-xs text-slate-900 leading-tight">
                              {d.dealershipName}
                            </span>
                            {isHot && (
                              <span className="shrink-0 text-orange-600" title="Hot Deal">
                                <Flame className="w-3.5 h-3.5 fill-current" />
                              </span>
                            )}
                          </div>

                          {/* Location & Rooftops */}
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {d.city}, {d.state}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Car className="w-3 h-3 text-slate-400" />
                              {d.usedCarsOnLot} lot
                            </span>
                            {d.rooftopCount > 1 && (
                              <span className="font-bold text-indigo-700 bg-indigo-50 px-1 rounded text-[10px]">
                                {d.rooftopCount} stores
                              </span>
                            )}
                          </div>

                          {/* Relationship Temperature & Assist Flag */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            {/* Manager Assist Badge (Section 3) */}
                            {hasAssist ? (
                              <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md animate-pulse">
                                <Briefcase className="w-3 h-3" />
                                <span>Manager Assist</span>
                              </span>
                            ) : (
                              (stageObj.id === 'HOT' || stageObj.id === 'Negotiation') && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onInitiateAssist(d);
                                  }}
                                  className="text-purple-600 hover:text-purple-800 font-bold hover:underline"
                                >
                                  + Request Assist
                                </button>
                              )
                            )}

                            {/* Relationship Temperature Score */}
                            {d.relationshipTemperature && (
                              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                Temp {d.relationshipTemperature.score}°
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW (Strictly Non-Monetary) */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-3">Dealership</th>
                <th className="p-3">Location</th>
                <th className="p-3">Used Inventory</th>
                <th className="p-3">Stage</th>
                <th className="p-3">Assist Status</th>
                <th className="p-3">Relationship Temp</th>
                <th className="p-3">Attribution</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => (
                <tr 
                  key={d.id} 
                  onClick={() => onOpenDealership(d)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="p-3 font-bold text-slate-900">{d.dealershipName}</td>
                  <td className="p-3 text-slate-600">{d.city}, {d.state}</td>
                  <td className="p-3 font-mono font-bold">{d.usedCarsOnLot} cars</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-blue-100 text-blue-800">
                      {d.stage}
                    </span>
                  </td>
                  <td className="p-3">
                    {d.hasActiveAssist ? (
                      <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[10px]">
                        <Briefcase className="w-3 h-3" /> Active Assist
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">Solo Deal</span>
                    )}
                  </td>
                  <td className="p-3 font-mono font-bold text-indigo-600">
                    {d.relationshipTemperature?.score || 50}°
                  </td>
                  <td className="p-3 text-slate-500 text-[11px]">
                    Origin: {(() => { const o = allUsers.find(u => u.id === d.originRepId); return o ? `${o.firstName} ${o.lastName}` : '—'; })()}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDealership(d);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
