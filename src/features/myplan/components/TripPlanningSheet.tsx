import React, { useState } from 'react';
import {
  Navigation,
  Check,
  Calendar,
  AlertTriangle,
  Building,
  Car,
  X
} from 'lucide-react';
import { Trip, PlanSlot } from '../types/myplan.types';
import { useMyPlan } from '../context/MyPlanContext';

interface TripPlanningSheetProps {
  isOpen: boolean;
  onClose: () => void;
  anchorDealership: any;
  nearbyDealerships: any[];
  currentUser: any;
}

export const TripPlanningSheet: React.FC<TripPlanningSheetProps> = ({
  isOpen,
  onClose,
  anchorDealership,
  nearbyDealerships = [],
  currentUser
}) => {
  const { activeDate, addTrip, addBatchSlots, daySettings } = useMyPlan();
  const [selectedNearbyIds, setSelectedNearbyIds] = useState<string[]>(
    nearbyDealerships.slice(0, 2).map(d => d.id)
  );

  if (!isOpen || !anchorDealership) return null;

  const anchorDistance = anchorDealership.distanceMiles || 95;
  const roundTripMiles = Math.round(anchorDistance * 2);
  const roundTripHours = Math.round(((roundTripMiles * 1.3) / 50) * 10) / 10;

  const toggleNearby = (id: string) => {
    setSelectedNearbyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleConfirmTripDay = () => {
    const included = [
      anchorDealership,
      ...nearbyDealerships.filter(d => selectedNearbyIds.includes(d.id))
    ];

    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      userId: currentUser.id,
      tripName: `Trip to ${anchorDealership.city || 'Regional Center'}`,
      date: activeDate,
      stops: included.map(d => ({
        dealershipId: d.id,
        dealershipName: d.dealershipName,
        city: d.city,
        milesFromHome: d.distanceMiles || anchorDistance
      })),
      totalMiles: roundTripMiles,
      estHours: roundTripHours,
      status: daySettings.requireTripApproval ? 'pending_approval' : 'approved'
    };

    addTrip(newTrip);

    // Create slots for the stops
    const newSlots: PlanSlot[] = included.map((d, index) => {
      const startH = 10 + index;
      const startTime = `${String(startH).padStart(2, '0')}:30`;
      return {
        id: `slot_trip_${Date.now()}_${index}`,
        userId: currentUser.id,
        date: activeDate,
        timeType: 'exact',
        startTime,
        durationMin: 45,
        travelBeforeMin: index === 0 ? Math.round(roundTripHours * 30) : 15,
        orderIndex: index,
        workType: d.stage === 'Client' ? 'client' : 'prospect',
        activityType: 'in_person',
        purpose: 'Regional trip visit & discovery',
        dealershipId: d.id,
        dealershipName: d.dealershipName,
        dealershipCity: d.city,
        dealershipState: d.state,
        distanceBand: 'out_of_town',
        distanceMiles: d.distanceMiles || anchorDistance,
        tripId: newTrip.id,
        source: 'manual',
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    addBatchSlots(newSlots);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Out-of-Town Trip Assistant
              </h2>
              <span className="text-[11px] font-bold text-rose-300">
                70+ Miles from Home Region
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs text-slate-300">
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2">
            <div className="font-bold text-white text-sm">
              {anchorDealership.dealershipName} ({anchorDealership.city}, {anchorDealership.state})
            </div>
            <p className="text-slate-400">
              This is about a <strong>{roundTripHours}-hour round trip ({roundTripMiles} miles)</strong>. Single-stop trips are discouraged to protect your travel efficiency.
            </p>
          </div>

          {nearbyDealerships.length > 0 && (
            <div className="space-y-2">
              <label className="block font-bold text-white uppercase tracking-wider text-[11px]">
                Clustered Stops Within 15 Miles (Recommended)
              </label>
              <div className="space-y-2">
                {nearbyDealerships.map(d => {
                  const isChecked = selectedNearbyIds.includes(d.id);
                  return (
                    <div
                      key={d.id}
                      onClick={() => toggleNearby(d.id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-rose-950/40 border-rose-500/60 text-white font-bold'
                          : 'bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            isChecked
                              ? 'bg-rose-500 border-rose-400 text-slate-950'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{d.dealershipName}</div>
                          <div className="text-xs text-slate-400">{d.city} · {d.stage}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {daySettings.requireTripApproval && (
            <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Manager approval is required for out-of-town travel per team policy.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmTripDay}
            className="px-6 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs shadow-lg transition"
          >
            Create Trip Day ({selectedNearbyIds.length + 1} Stops)
          </button>
        </div>
      </div>
    </div>
  );
};
