import React, { useState } from 'react';
import { Dealership, Activity, User, ManagerPriority, ProductBonus } from '../../types/crm';
import { RouteMap } from '../common/RouteMap';
import { calculateDistanceMiles, isGoodVisitWindow, formatTime12h, formatUSDate } from '../../utils/territory';
import {
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  MapPin,
  Car,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Flame,
  Pin,
  PinOff,
  Briefcase,
  AlertCircle,
  PhoneCall,
  Mail,
  Zap,
  Check,
  X
} from 'lucide-react';

interface PlannerViewProps {
  dealerships: Dealership[];
  activities: Activity[];
  priorities: ManagerPriority[];
  bonuses: ProductBonus[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onLogVisit: (dealership: Dealership) => void;
  onUpdateActivities: (activities: Activity[]) => void;
  onUpdatePriority: (priority: ManagerPriority) => void;
  onLaunchWorkDay: () => void;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  dealerships,
  activities,
  priorities,
  bonuses,
  currentUser,
  onOpenDealership,
  onLogVisit,
  onUpdateActivities,
  onUpdatePriority,
  onLaunchWorkDay
}) => {
  const [plannerDate, setPlannerDate] = useState<string>('2026-11-02');
  const [calendarMode, setCalendarMode] = useState<'day' | 'week' | 'month' | 'agenda'>('day');
  const [showMap, setShowMap] = useState<boolean>(true);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiPlanSummary, setAiPlanSummary] = useState<string | null>(
    'AI Game Plan: 3 stops inside the 10 AM–4 PM Golden Window. Locked stops preserved; manager priority included (+50 bonus pts).'
  );

  // Filter activities for selected date and current user
  const dayActivities = activities
    .filter(a => a.plannedDate === plannerDate && a.userId === currentUser.id)
    .sort((a, b) => (a.plannedTime || '09:00').localeCompare(b.plannedTime || '09:00'));

  // Scheduled dealerships
  const scheduledDealerships: Dealership[] = dayActivities
    .map(act => dealerships.find(d => d.id === act.dealershipId))
    .filter((d): d is Dealership => Boolean(d));

  // Relevant manager priorities for current user or region
  const userPriorities = priorities.filter(p => 
    (p.targetType === 'rep' && p.targetId === currentUser.id) ||
    (p.targetType === 'region' && p.targetId === currentUser.region) ||
    p.targetType === 'team'
  );

  // Calculate route distance
  let totalDistanceMiles = 0;
  let lastLat = currentUser.homeCoords.lat;
  let lastLng = currentUser.homeCoords.lng;

  scheduledDealerships.forEach(d => {
    totalDistanceMiles += calculateDistanceMiles(lastLat, lastLng, d.coordinates.lat, d.coordinates.lng);
    lastLat = d.coordinates.lat;
    lastLng = d.coordinates.lng;
  });
  totalDistanceMiles += calculateDistanceMiles(lastLat, lastLng, currentUser.homeCoords.lat, currentUser.homeCoords.lng);

  // Toggle stop pin/lock (Section 7)
  const handleToggleLockStop = (actId: string) => {
    const updated = activities.map(a => {
      if (a.id === actId) {
        return { ...a, isLocked: !a.isLocked };
      }
      return a;
    });
    onUpdateActivities(updated);
  };

  // AI Route regeneration around locked stops (Section 7)
  const handleRegenerateAroundLocked = () => {
    setIsGeneratingAI(true);
    setTimeout(() => {
      // Keep locked stops
      const locked = dayActivities.filter(a => a.isLocked);
      const lockedDealIds = new Set(locked.map(l => l.dealershipId));

      // Find best candidates to fill open slots inside Golden Window
      const candidates = dealerships
        .filter(d => 
          (d.assignedRepId === currentUser.id || d.originRepId === currentUser.id) &&
          d.stage !== 'Client' &&
          !lockedDealIds.has(d.id)
        )
        .sort((a, b) => (b.relationshipTemperature?.score || 50) - (a.relationshipTemperature?.score || 50))
        .slice(0, Math.max(1, 3 - locked.length));

      const availableTimes = ['11:00', '13:30', '15:15'].filter(t => !locked.some(l => l.plannedTime === t));

      const newGenerated: Activity[] = candidates.map((d, idx) => ({
        id: `act_gen_${Date.now()}_${idx}`,
        dealershipId: d.id,
        dealershipName: d.dealershipName,
        userId: currentUser.id,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        activityType: 'In-Person Visit',
        communicationType: 'In-Person',
        status: 'pending',
        plannedDate: plannerDate,
        plannedTime: availableTimes[idx] || '14:00',
        isGoodWindow: true,
        notes: `AI Optimized stop: ${d.usedCarsOnLot} used cars. Temperature: ${d.relationshipTemperature?.score || 65}/100.`,
        productsDiscussed: ['Vehicle Service Contract (Extended Warranty)', 'Keyfetch'],
        interestLevel: 'High',
        isLocked: false
      }));

      // Combine locked + new generated + other non-today activities
      const otherActivities = activities.filter(a => !(a.plannedDate === plannerDate && a.userId === currentUser.id));
      onUpdateActivities([...otherActivities, ...locked, ...newGenerated]);

      setAiPlanSummary(`Regenerated around ${locked.length} locked stops. Clustered ${newGenerated.length} new stops within Golden Window.`);
      setIsGeneratingAI(false);
    }, 700);
  };

  const handlePriorityAction = (p: ManagerPriority, action: 'accept' | 'schedule' | 'complete' | 'decline') => {
    let newStatus: ManagerPriority['status'] = 'pending';
    if (action === 'accept') newStatus = 'accepted';
    if (action === 'schedule') newStatus = 'scheduled';
    if (action === 'complete') newStatus = 'completed';
    if (action === 'decline') newStatus = 'declined';

    const updated: ManagerPriority = {
      ...p,
      status: newStatus,
      completedAt: action === 'complete' ? new Date().toISOString() : undefined
    };
    onUpdatePriority(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Picker */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-slate-900 text-base">Field Route Planner</span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                const d = new Date(plannerDate);
                d.setDate(d.getDate() - 1);
                setPlannerDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 text-xs font-bold font-mono text-slate-800">
              {formatUSDate(plannerDate)}
            </span>

            <button
              type="button"
              onClick={() => {
                const d = new Date(plannerDate);
                d.setDate(d.getDate() + 1);
                setPlannerDate(d.toISOString().split('T')[0]);
              }}
              className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            {(['day', 'week', 'month', 'agenda'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalendarMode(mode)}
                className={`px-3 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                  calendarMode === mode ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* AI Toggle */}
          <button
            type="button"
            onClick={() => setAiEnabled(!aiEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              aiEnabled ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title="Toggle AI route suggestions"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Coach: {aiEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {aiEnabled && (
            <button
              type="button"
              disabled={isGeneratingAI}
              onClick={handleRegenerateAroundLocked}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Regenerate unpinned stops while strictly preserving your locked stops"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
              <span>Regenerate Around Locked</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLaunchWorkDay}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Start Route</span>
          </button>
        </div>
      </div>

      {/* AI Coach Summary / Nudge Banner */}
      {aiPlanSummary && aiEnabled && (
        <div className="bg-linear-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-200/80 p-3.5 rounded-2xl flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-medium">{aiPlanSummary}</span>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-100 shrink-0 hidden sm:inline">
            Projected Today: +110 pts
          </span>
        </div>
      )}

      {/* MANAGER PRIORITIES STRIP (Section 7) */}
      {userPriorities.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
              <Briefcase className="w-4 h-4 text-amber-700" />
              <span>Manager Directives & Team Priorities</span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded">
              {userPriorities.filter(p => p.status !== 'completed').length} Pending Action
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userPriorities.map(p => (
              <div 
                key={p.id}
                className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                      From {p.managerName} • {p.priorityLevel}
                    </span>
                    <h4 className="font-bold text-slate-900 mt-1">{p.title}</h4>
                  </div>
                  {p.bonusPoints && (
                    <span className="text-[10px] font-black font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      +{p.bonusPoints} pts
                    </span>
                  )}
                </div>

                <p className="text-slate-600 text-[11px] italic">"{p.reason}"</p>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400">Due: {p.dueDate}</span>
                  <div className="flex items-center gap-1.5">
                    {p.status !== 'completed' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePriorityAction(p, 'schedule')}
                          className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[10px] cursor-pointer"
                        >
                          Schedule
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePriorityAction(p, 'complete')}
                          className="px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Left Timeline, Right Map & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Day Agenda Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Planned Itinerary ({dayActivities.length} Stops)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Golden Window: <strong>10:00 AM - 4:00 PM</strong> local time
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="lg:hidden text-xs text-blue-600 font-bold hover:underline"
                >
                  {showMap ? 'Hide Map' : 'View Map'}
                </button>
              </div>
            </div>

            {dayActivities.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl space-y-3">
                <Clock className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs text-slate-500 font-medium">No stops planned for this date yet.</p>
                <button
                  type="button"
                  onClick={handleRegenerateAroundLocked}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Generate AI Day Plan
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {dayActivities.map((act, index) => {
                  const deal = dealerships.find(d => d.id === act.dealershipId);
                  const isGood = act.plannedTime ? isGoodVisitWindow(act.plannedTime) : true;
                  const isCompleted = act.status === 'completed';

                  return (
                    <div
                      key={act.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        act.isLocked 
                          ? 'border-indigo-300 bg-indigo-50/30' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          {/* Sequence index */}
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black font-mono shrink-0 ${
                            isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                          }`}>
                            {index + 1}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900 text-sm">
                                {act.dealershipName}
                              </span>

                              {/* Pinned badge */}
                              {act.isLocked && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                  <Pin className="w-2.5 h-2.5" /> Pinned
                                </span>
                              )}

                              {/* Good / Bad window badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isGood 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {act.plannedTime ? formatTime12h(act.plannedTime) : '10:00 AM'}
                                {isGood ? ' (Golden Window)' : ' (Outside Window)'}
                              </span>
                            </div>

                            {deal && (
                              <div className="text-[11px] text-slate-500 flex items-center gap-3">
                                <span>{deal.city}, {deal.state}</span>
                                <span>•</span>
                                <span>{deal.usedCarsOnLot} used cars</span>
                                {deal.relationshipTemperature && (
                                  <>
                                    <span>•</span>
                                    <span className="font-bold text-indigo-700">
                                      Temp {deal.relationshipTemperature.score}°
                                    </span>
                                  </>
                                )}
                              </div>
                            )}

                            {act.notes && (
                              <p className="text-xs text-slate-600 mt-1 line-clamp-1">{act.notes}</p>
                            )}
                          </div>
                        </div>

                        {/* Stop Action Buttons & Point Chips */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Pin / Lock Button (Section 7) */}
                          <button
                            type="button"
                            onClick={() => handleToggleLockStop(act.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              act.isLocked
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-50 text-slate-400 hover:text-slate-700 border-slate-200'
                            }`}
                            title={act.isLocked ? 'Stop is locked against AI route reset' : 'Click to lock stop in place'}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>

                          {deal && (
                            <button
                              type="button"
                              onClick={() => onLogVisit(deal)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                              title="Log visit details and claim points"
                            >
                              <span>Log Visit</span>
                              <span className="bg-blue-500/80 text-[10px] font-mono px-1 rounded">+40</span>
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
        </div>

        {/* Right: Map & Day Statistics (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Day Efficiency Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Est. Drive</span>
              <span className="text-xl font-black font-mono text-slate-900">{totalDistanceMiles} mi</span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Golden Window</span>
              <span className="text-xl font-black font-mono text-emerald-600">
                {dayActivities.filter(a => a.plannedTime && isGoodVisitWindow(a.plannedTime)).length}/{dayActivities.length}
              </span>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Day Pts Pot.</span>
              <span className="text-xl font-black font-mono text-amber-600">
                +{dayActivities.length * 40}
              </span>
            </div>
          </div>

          {/* Interactive Map */}
          {showMap && (
            <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs">
              <RouteMap
                stops={scheduledDealerships.length > 0 ? scheduledDealerships : dealerships.slice(0, 10)}
                currentUser={currentUser}
                onSelectDealership={onOpenDealership}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
