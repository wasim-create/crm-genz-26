import React from 'react';
import { Clock, Navigation, AlertTriangle, ShieldCheck, Sun, Calendar } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';

export const DaySummaryCard: React.FC = () => {
  const { dayRecalc, activeDateSlots, biggerText, moveSlotToDay, updateSlot } = useMyPlan();
  const totalItems = activeDateSlots.length;
  const totalMinutes = activeDateSlots.reduce((acc, s) => acc + s.durationMin, 0) + dayRecalc.totalDriveMin;
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  // Fullness bar classification: Light (<4h), Good (4-6.5h), Full (6.5-8h), Too much (>8h)
  let fullnessLabel = 'Good Day';
  let fullnessColor = 'bg-emerald-500';
  let fullnessPercent = Math.min(100, Math.round((totalHours / 8) * 100));
  if (totalHours < 4) {
    fullnessLabel = 'Light Day';
    fullnessColor = 'bg-blue-400';
  } else if (totalHours > 8) {
    fullnessLabel = 'Too Much (Overtime)';
    fullnessColor = 'bg-rose-500';
  } else if (totalHours >= 6.5) {
    fullnessLabel = 'Full Day';
    fullnessColor = 'bg-amber-400';
  }

  const hasRuleViolations = dayRecalc.ruleViolations.length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Leave-By Primary Banner */}
      <div className="bg-gradient-to-r from-blue-900/80 to-indigo-950/80 border border-blue-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-500 text-slate-950 flex items-center justify-center font-black shadow">
            <Navigation className="w-6 h-6 fill-slate-950" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-blue-300">
              Leave-By Time (Home)
            </div>
            <div className={`font-black text-white tracking-tight ${biggerText ? 'text-2xl' : 'text-xl'}`}>
              Leave home by {dayRecalc.leaveByTimeFormatted}
            </div>
          </div>
        </div>

        <div className="text-right sm:text-right text-xs text-blue-200">
          <div className="font-semibold text-white">
            Home around {dayRecalc.finishTimeFormatted}
          </div>
          <div className="text-[11px] text-blue-300/80">
            {dayRecalc.totalDriveMiles} miles · {Math.round(dayRecalc.totalDriveMin / 60 * 10) / 10}h total drive
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="text-[11px] text-slate-400 font-medium">Planned Stops</div>
          <div className="text-base font-bold text-white">{totalItems} activities</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="text-[11px] text-slate-400 font-medium">Driving Time</div>
          <div className="text-base font-bold text-white">{dayRecalc.totalDriveMin} min</div>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="text-[11px] text-slate-400 font-medium">Workload</div>
          <div className="text-base font-bold text-white">{totalHours} hrs</div>
        </div>
      </div>

      {/* How full is my day? Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            How full is my day?
          </span>
          <span className="font-bold text-white text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
            {fullnessLabel}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${fullnessColor}`}
            style={{ width: `${Math.max(8, fullnessPercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
          <span>Light (0-4h)</span>
          <span>Good (4-6h)</span>
          <span>Full (6-8h)</span>
          <span>Too Much (8h+)</span>
        </div>
      </div>

      {/* Rule Violation Overrun Warning Card */}
      {hasRuleViolations && (
        <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Schedule Alert</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            {dayRecalc.ruleViolations[0].message}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => {
                const target = dayRecalc.ruleViolations[0];
                const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                moveSlotToDay(target.slotId, tomorrow);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition"
            >
              Move to tomorrow
            </button>
            <button
              onClick={() => {
                const target = dayRecalc.ruleViolations[0];
                updateSlot(target.slotId, {
                  activityType: 'email',
                  durationMin: 5,
                  purpose: 'Follow-up via email'
                });
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs border border-slate-600 transition"
            >
              Turn into email
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
