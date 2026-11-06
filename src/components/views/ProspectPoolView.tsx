import React, { useState } from 'react';
import { Dealership, User } from '../../types/crm';
import { calculateDistanceMiles, isWithinTerritory, getDistanceBand } from '../../utils/territory';
import { RouteMap } from '../common/RouteMap';
import {
  Compass,
  MapPin,
  Car,
  Search,
  Upload,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  ShieldAlert,
  HelpCircle,
  Radar
} from 'lucide-react';

interface ProspectPoolViewProps {
  dealerships: Dealership[];
  currentUser: User;
  onClaimDealership: (dealership: Dealership, reason?: string) => void;
  onOpenDealership: (dealership: Dealership) => void;
  /** Opens the shared Add New Prospect form (optionally straight into Open Radar). */
  onAddNewProspect: (opts?: { radar?: boolean }) => void;
  isPoolOnly?: boolean;
}

export const ProspectPoolView: React.FC<ProspectPoolViewProps> = ({
  dealerships,
  currentUser,
  onClaimDealership,
  onOpenDealership,
  onAddNewProspect,
  isPoolOnly = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [outOfRadiusDeal, setOutOfRadiusDeal] = useState<Dealership | null>(null);
  const [outOfRadiusReason, setOutOfRadiusReason] = useState('');

  // Pool list vs bench list
  const targetDeals = dealerships.filter(d => {
    if (isPoolOnly) {
      return d.stage === 'Pool' || !d.assignedRepId;
    } else {
      // Rep's active bench
      return d.assignedRepId === currentUser.id && d.stage !== 'Client';
    }
  });

  const filteredDeals = targetDeals.filter(d => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      d.dealershipName.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q) ||
      d.state.toLowerCase().includes(q) ||
      d.zipCode.includes(q)
    );
  });

  // Calculate distance for all filtered deals
  const dealsWithDistance = filteredDeals.map(d => {
    const dist = calculateDistanceMiles(
      currentUser.homeCoords.lat,
      currentUser.homeCoords.lng,
      d.coordinates.lat,
      d.coordinates.lng
    );
    const band = getDistanceBand(dist);
    return { dealership: d, distance: dist, withinTerritory: isWithinTerritory(dist), band };
  });

  const handleClaim = (d: Dealership) => {
    const dist = calculateDistanceMiles(
      currentUser.homeCoords.lat,
      currentUser.homeCoords.lng,
      d.coordinates.lat,
      d.coordinates.lng
    );
    if (!isWithinTerritory(dist)) {
      setOutOfRadiusDeal(d);
      setOutOfRadiusReason('');
    } else {
      onClaimDealership(d);
    }
  };

  const handleConfirmOutOfRadiusClaim = () => {
    if (!outOfRadiusDeal) return;
    onClaimDealership(outOfRadiusDeal, outOfRadiusReason || 'Regional manager pre-approved extension');
    setOutOfRadiusDeal(null);
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-600" />
            <span>{isPoolOnly ? 'Unclaimed Prospect Pool' : 'The Bench (My Active Prospects)'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Territory radius: <strong>60 miles</strong> around home ZIP ({currentUser.homeZipCode}). Distance flagged on every dealership.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, city, zip..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>

          <button
            type="button"
            onClick={() => onAddNewProspect({ radar: true })}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 shadow-2xs cursor-pointer"
          >
            <Radar className="w-3.5 h-3.5" />
            <span>Open Radar</span>
          </button>

          <button
            type="button"
            onClick={() => onAddNewProspect()}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add prospect</span>
          </button>

          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV / Sheet</span>
          </button>
        </div>
      </div>

      {/* Grid of Prospects & Territory Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Dealership Cards Grid */}
        <div className="lg:col-span-8 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Showing {dealsWithDistance.length} dealerships</span>
            <span>Radius: 60 miles base</span>
          </div>

          {dealsWithDistance.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 space-y-2">
              <Building className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No prospects matching your filters</p>
              <p className="text-xs text-slate-400">Try adjusting your search query or importing new lists.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {dealsWithDistance.map(({ dealership: d, distance, withinTerritory }) => {
                const isClaimed = d.stage !== 'Pool' && d.assignedRepId !== null;

                return (
                  <div
                    key={d.id}
                    onClick={() => onOpenDealership(d)}
                    className="bg-white rounded-2xl p-4 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          d.dealershipType === 'Dealer Group' 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {d.dealershipType}
                        </span>

                        {withinTerritory ? (
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {distance.toFixed(1)} mi
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200" title="Outside 60-mile territory radius">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            {distance.toFixed(1)} mi (Out-of-Radius)
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 hover:text-blue-600 transition-colors leading-tight">
                        {d.dealershipName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        <MapPin className="w-3 h-3 inline mr-1 text-slate-400" />
                        {d.address}, {d.city}, {d.state} {d.zipCode}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                        <span className="flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          <strong>{d.usedCarsOnLot}</strong> cars on lot
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          F&I: {d.fiSystem.split(' ')[0]}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {isPoolOnly || d.stage === 'Pool' ? (
                          <button
                            type="button"
                            onClick={() => handleClaim(d)}
                            className={`w-full text-xs font-bold py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs ${
                              withinTerritory
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-amber-600 hover:bg-amber-700 text-white'
                            }`}
                          >
                            {withinTerritory ? 'Claim to My Bench' : 'Claim (Requires Reason)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenDealership(d)}
                            className="w-full text-xs font-bold py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-colors cursor-pointer"
                          >
                            View 360° Profile
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Territory Map View (Right Side) */}
        <div className="lg:col-span-4 sticky top-20 space-y-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center justify-between">
              <span>Territory Radar (60 Mi)</span>
              <span className="text-[10px] font-mono text-blue-600">Home: {currentUser.homeZipCode}</span>
            </h4>
            <RouteMap
              stops={dealsWithDistance.slice(0, 15).map(x => x.dealership)}
              currentUser={currentUser}
              onSelectDealership={onOpenDealership}
              height="380px"
              showRadius={true}
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Prospects outside the blue 60-mile circle require a documented business reason or manager review before claiming.
            </p>
          </div>
        </div>
      </div>

      {/* Out-of-Radius Approval Modal */}
      {outOfRadiusDeal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold text-sm">Out-of-Territory Claim Notice</h4>
                <p className="text-xs text-amber-800">
                  {outOfRadiusDeal.dealershipName} is outside your 60-mile home radius.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                Business Reason for Claiming *
              </label>
              <textarea
                value={outOfRadiusReason}
                onChange={(e) => setOutOfRadiusReason(e.target.value)}
                placeholder="e.g. Existing relationship with GM, or part of Holman Automotive dealer group expansion..."
                rows={3}
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOutOfRadiusDeal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOutOfRadiusClaim}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Submit Claim with Reason
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV / Google Sheet Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Import Prospect Pool List</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upload a dealership prospect CSV or connect a Google Sheet URL. Column mapping and duplicate detection against existing accounts will run automatically.
            </p>

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 hover:border-blue-400 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-800">Drag and drop dealership CSV here</div>
              <p className="text-[11px] text-slate-400">Supported columns: Name, Address, City, State, ZIP, Used_Inventory, F&I_System</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert('Demo Import Sample: 10 new qualified prospects added to Pool.');
                  setShowImportModal(false);
                }}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Load Sample Prospect List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
