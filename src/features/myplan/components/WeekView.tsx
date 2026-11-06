import React from 'react';
import { Calendar, Navigation, Plus, ArrowRight, Clock, MapPin } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';
import { PlanSlot } from '../types/myplan.types';

export const WeekView: React.FC<{ onOpenAddModal: () => void }> = ({ onOpenAddModal }) => {
  const {
    slots,
    activeDate,
    setActiveDate,
    setCurrentView,
    unscheduledSlots,
    moveSlotToDay,
    trips,
    biggerText
  } = useMyPlan();

  // Compute 7 days of the current week (starting Monday)
  const getWeekDates = () => {
    const current = new Date(activeDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(current.setDate(diff));

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  };

  const weekDates = getWeekDates();

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24">
      {/* "Not Scheduled Yet" Tray */}
      {unscheduledSlots.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Not Scheduled Yet ({unscheduledSlots.length})
            </span>
            <span className="text-[11px] text-slate-400">Move into any day below</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {unscheduledSlots.map(s => (
              <div
                key={s.id}
                className="p-3 rounded-xl bg-slate-800 border border-slate-700 shrink-0 w-64 space-y-1.5"
              >
                <div className="font-bold text-white text-xs truncate">{s.dealershipName}</div>
                <div className="text-[11px] text-slate-400">{s.dealershipCity} · {s.purpose}</div>
                <div className="flex gap-1 pt-1">
                  {weekDates.slice(0, 5).map(dateStr => (
                    <button
                      key={dateStr}
                      onClick={() => moveSlotToDay(s.id, dateStr)}
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-[10px] text-slate-200 font-semibold transition"
                    >
                      {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week Grid / Stack */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {weekDates.map(dateStr => {
          const daySlots = slots
            .filter(s => s.date === dateStr && s.status !== 'skipped' && s.status !== 'not_scheduled')
            .sort((a, b) => a.orderIndex - b.orderIndex);

          const isSelected = dateStr === activeDate;
          const isToday = dateStr === new Date().toISOString().split('T')[0];
          const tripOnDay = trips.find(t => t.date === dateStr);

          // Work type counts
          const prospectsCount = daySlots.filter(s => s.workType === 'prospect').length;
          const onboardingCount = daySlots.filter(s => s.workType === 'signup_onboarding').length;
          const clientCount = daySlots.filter(s => s.workType === 'client').length;

          return (
            <div
              key={dateStr}
              onClick={() => {
                setActiveDate(dateStr);
                setCurrentView('day');
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected
                  ? 'bg-slate-900 border-amber-500 shadow-xl ring-1 ring-amber-500/50'
                  : 'bg-slate-900/80 border-slate-800 hover:bg-slate-800/80'
              }`}
            >
              <div>
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-white">{getDayName(dateStr)}</div>
                  {isToday && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      Today
                    </span>
                  )}
                </div>

                {/* Trip Banner if Out of Town */}
                {tripOnDay && (
                  <div className="mt-2 p-1.5 rounded-lg bg-rose-950/70 border border-rose-500/50 text-[10px] text-rose-300 font-bold flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="truncate">{tripOnDay.tripName}</span>
                  </div>
                )}

                {/* Day Stats */}
                <div className="mt-3 text-xs text-slate-300 space-y-1">
                  <div className="font-semibold text-white">{daySlots.length} stops</div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {prospectsCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" title={`${prospectsCount} Prospects`} />
                    )}
                    {onboardingCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" title={`${onboardingCount} Onboarding`} />
                    )}
                    {clientCount > 0 && (
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" title={`${clientCount} Clients`} />
                    )}
                  </div>
                </div>
              </div>

              {/* View Day action */}
              <button
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1 transition"
              >
                <span>Open Day</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
