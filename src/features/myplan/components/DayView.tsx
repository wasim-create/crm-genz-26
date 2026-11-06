import React, { useState } from 'react';
import { Plus, Navigation, Car, AlertCircle, Undo2, Sparkles } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';
import { DaySummaryCard } from './DaySummaryCard';
import { SlotCard } from './SlotCard';
import { NextActionBanner } from './NextActionBanner';
import { OutcomeLoggingSheet } from './OutcomeLoggingSheet';
import { PlanSlot } from '../types/myplan.types';

interface DayViewProps {
  onOpenAddModal: () => void;
}

export const DayView: React.FC<DayViewProps> = ({ onOpenAddModal }) => {
  const { activeDateSlots, activeDate, toast, clearToast, biggerText, openAddFlow } = useMyPlan();
  const [outcomeTargetSlot, setOutcomeTargetSlot] = useState<PlanSlot | null>(null);

  const isToday = activeDate === new Date().toISOString().split('T')[0];
  const nextUpSlot = isToday ? activeDateSlots.find(s => s.status === 'planned') : undefined;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-28">
      {/* Day Summary Card (Leave-by, Fullness, Stats) */}
      <DaySummaryCard />

      {/* Today's Up Next Highlight Action Banner */}
      {nextUpSlot && (
        <NextActionBanner
          slot={nextUpSlot}
          onOpenOutcome={slot => setOutcomeTargetSlot(slot)}
        />
      )}

      {/* Desktop/Tablet Add Button below Summary */}
      <div className="hidden sm:flex justify-end">
        <button
          onClick={onOpenAddModal}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-xl flex items-center gap-2 transition transform active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>+ Add to plan</span>
        </button>
      </div>

      {/* Timeline of Slot Cards */}
      <div className="space-y-4">
        {activeDateSlots.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Car className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">Nothing scheduled for this day</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Tap the "+ Add" button to schedule visits, calls, emails, or Google Meet meetings.
            </p>
            <button
              onClick={onOpenAddModal}
              className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
            >
              + Add first activity
            </button>
          </div>
        ) : (
          activeDateSlots.map((slot, index) => {
            const isFirst = index === 0;
            const isLast = index === activeDateSlots.length - 1;
            const driveBefore = slot.travelBeforeMin || 15;

            return (
              <React.Fragment key={slot.id}>
                {/* Thin connector travel line between cards */}
                {index > 0 && (
                  <div className="flex items-center space-x-3 px-6 py-0.5 text-[11px] text-slate-400 font-medium">
                    <div className="w-0.5 h-6 bg-slate-800 ml-3" />
                    <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1 rounded-full border border-slate-800">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      <span>{driveBefore} min drive to {slot.dealershipName}</span>
                    </div>
                  </div>
                )}

                <SlotCard
                  slot={slot}
                  isFirst={isFirst}
                  isLast={isLast}
                  onOpenOutcome={target => setOutcomeTargetSlot(target)}
                />
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Fixed Sticky Mobile "+ Add" Button */}
      <div className="sm:hidden fixed bottom-6 left-0 right-0 px-6 z-30 flex justify-center">
        <button
          onClick={onOpenAddModal}
          className="w-full max-w-xs h-13 py-3.5 px-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-sm shadow-2xl flex items-center justify-center gap-2 border-2 border-slate-950 transition active:scale-95"
        >
          <Plus className="w-5 h-5 stroke-[3]" />
          <span>+ Add to plan</span>
        </button>
      </div>

      {/* Toast Notification with Undo */}
      {toast && (
        <div className="fixed bottom-20 sm:bottom-8 right-4 sm:right-8 z-40 bg-slate-800 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in text-xs max-w-md">
          <span className="flex-1 font-medium">{toast.message}</span>
          {toast.undoAction && (
            <button
              onClick={() => {
                toast.undoAction?.();
                clearToast();
              }}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 transition"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Undo
            </button>
          )}
          <button onClick={clearToast} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Outcome Sheet Modal */}
      {outcomeTargetSlot && (
        <OutcomeLoggingSheet
          slot={outcomeTargetSlot}
          onClose={() => setOutcomeTargetSlot(null)}
          onPlanNextStep={dealership => {
            setOutcomeTargetSlot(null);
            openAddFlow({ dealership });
          }}
        />
      )}
    </div>
  );
};
