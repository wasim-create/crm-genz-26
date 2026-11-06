import React from 'react';
import { Calendar, Navigation, CheckCircle2, Target, ArrowRight } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';

export const MonthView: React.FC = () => {
  const { slots, activeDate, setActiveDate, setCurrentView, trips } = useMyPlan();

  const currentDate = new Date(activeDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Get total days in month
  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24">
      {/* Month Goals & Capacity Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            Monthly Overview · Not Slot-by-Slot
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
            {monthName}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tap any week or day to open its detailed schedule.
          </p>
        </div>

        <div className="flex gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
            <div className="text-slate-400 text-[10px] font-bold uppercase">Dedicated Trips</div>
            <div className="text-base font-black text-rose-300">{trips.length} Planned</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
            <div className="text-slate-400 text-[10px] font-bold uppercase">Scheduled Stops</div>
            <div className="text-base font-black text-emerald-300">{slots.length} Total</div>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty_${i}`} className="p-3 rounded-xl bg-slate-950/30 border border-transparent" />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const daySlots = slots.filter(s => s.date === dayStr);
            const tripOnDay = trips.find(t => t.date === dayStr);
            const isToday = dayStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={dayStr}
                onClick={() => {
                  setActiveDate(dayStr);
                  setCurrentView('day');
                }}
                className={`p-2.5 rounded-xl border transition cursor-pointer min-h-[75px] flex flex-col justify-between ${
                  dayStr === activeDate
                    ? 'bg-amber-500/10 border-amber-500 shadow-md'
                    : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? 'text-amber-400' : 'text-slate-300'}`}>
                    {dayNum}
                  </span>
                  {daySlots.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>

                {tripOnDay ? (
                  <div className="text-[9px] font-bold text-rose-300 bg-rose-950/80 px-1 py-0.5 rounded truncate">
                    🚗 Trip Day
                  </div>
                ) : daySlots.length > 0 ? (
                  <div className="text-[10px] text-slate-400 font-medium">
                    {daySlots.length} stop{daySlots.length > 1 ? 's' : ''}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-600">Free</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
