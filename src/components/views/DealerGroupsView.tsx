import React, { useState } from 'react';
import { DealerGroup, Dealership, User } from '../../types/crm';
import { Layers, Building, MapPin, Phone, Users, CheckCircle2, Flame, ArrowRight, ShieldCheck } from 'lucide-react';

interface DealerGroupsViewProps {
  groups: DealerGroup[];
  dealerships: Dealership[];
  users: User[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
}

export const DealerGroupsView: React.FC<DealerGroupsViewProps> = ({
  groups,
  dealerships,
  users,
  currentUser,
  onOpenDealership
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');

  const selectedGroup = groups.find(g => g.id === selectedGroupId) || groups[0];
  const groupRooftops = dealerships.filter(d => d.groupId === selectedGroupId);

  const signedCount = groupRooftops.filter(r => r.stage === 'Signed' || r.stage === 'Client' || r.stage === 'Onboarding').length;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>Dealer Groups & Rooftop Networks</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enterprise group entities. Rooftop sign-up triggers warm opportunities across sister stores. Attribution stays per rooftop.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-200">
            {groups.length} Dealer Groups Indexed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Group List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Dealer Groups</h3>
          <div className="space-y-2">
            {groups.map(g => {
              const count = dealerships.filter(d => d.groupId === g.id).length;
              const isSelected = g.id === selectedGroupId;

              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-indigo-50/50 border-indigo-400 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-bold text-sm text-slate-900">{g.name}</h4>
                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {count} Roofs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{g.hqCity}, {g.hqState}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Group Rooftop Detail Matrix */}
        <div className="lg:col-span-8">
          {selectedGroup && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedGroup.name}</h3>
                  <p className="text-xs text-slate-500">
                    HQ: {selectedGroup.hqAddress}, {selectedGroup.hqCity}, {selectedGroup.hqState} {selectedGroup.hqZip}
                  </p>
                  <p className="text-xs text-indigo-700 font-medium mt-1">
                    Main Executive: <strong>{selectedGroup.mainDecisionMaker}</strong> • {selectedGroup.mainPhone}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-block">
                    {signedCount} of {groupRooftops.length} Rooftops Won / Signed
                  </span>
                </div>
              </div>

              {/* Group Notes */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <strong>Group Profile & Rollout Notes:</strong> {selectedGroup.notes}
              </div>

              {/* Rooftops List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rooftop Stores ({groupRooftops.length})
                </h4>

                <div className="space-y-2">
                  {groupRooftops.map(roof => {
                    const isSigned = roof.stage === 'Signed' || roof.stage === 'Client' || roof.stage === 'Onboarding';

                    return (
                      <div
                        key={roof.id}
                        onClick={() => onOpenDealership(roof)}
                        className="p-3.5 bg-white border border-slate-200 hover:border-blue-400 rounded-2xl flex items-center justify-between text-xs transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Building className="w-4 h-4 text-slate-400" />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{roof.dealershipName}</span>
                              {isSigned && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded">
                                  Signed
                                </span>
                              )}
                            </div>
                            <span className="text-slate-500">{roof.city}, {roof.state} • {roof.usedCarsOnLot} cars</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-blue-700">{roof.stage}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
