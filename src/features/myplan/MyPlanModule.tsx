import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Sparkles,
  Type,
  MessageSquare,
  Navigation,
  Clock,
  ArrowRight
} from 'lucide-react';
import { MyPlanProvider, useMyPlan } from './context/MyPlanContext';
import { DayView } from './components/DayView';
import { WeekView } from './components/WeekView';
import { MonthView } from './components/MonthView';
import { PastDaysDiary } from './components/PastDaysDiary';
import { AddFlowModal } from './components/AddFlow/AddFlowModal';
import { TripPlanningSheet } from './components/TripPlanningSheet';
import { TextQueueDrawer } from './components/TextQueueDrawer';

interface MyPlanModuleProps {
  currentUser: any;
  dealerships: any[];
  contacts?: any[];
  users?: any[];
  preselectedDealership?: any;
  onClearPreselected?: () => void;
}

const MyPlanInner: React.FC<MyPlanModuleProps> = ({
  currentUser,
  dealerships,
  contacts = [],
  users = [],
  preselectedDealership,
  onClearPreselected
}) => {
  const {
    activeDate,
    setActiveDate,
    currentView,
    setCurrentView,
    biggerText,
    toggleBiggerText,
    openingQuestionAnswered,
    setLastPlanningChoice,
    lastPlanningChoice,
    isAddFlowOpen,
    addFlowPreselected,
    openAddFlow,
    closeAddFlow,
    sendQueue
  } = useMyPlan();

  React.useEffect(() => {
    if (preselectedDealership) {
      openAddFlow({ dealership: preselectedDealership });
      onClearPreselected?.();
    }
  }, [preselectedDealership, openAddFlow, onClearPreselected]);

  const [isTripSheetOpen, setIsTripSheetOpen] = useState(false);
  const [tripAnchorData, setTripAnchorData] = useState<{ anchor: any; nearby: any[] } | null>(null);
  const [isTextQueueOpen, setIsTextQueueOpen] = useState(false);

  // Date manipulation helpers
  const handleShiftDay = (days: number) => {
    const current = new Date(activeDate + 'T12:00:00');
    current.setDate(current.getDate() + days);
    setActiveDate(current.toISOString().split('T')[0]);
  };

  const formattedDate = new Date(activeDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className={`min-h-screen bg-slate-950 text-slate-100 ${biggerText ? 'text-lg' : 'text-sm'}`}>
      {/* 4. The Opening Question Banner */}
      {!openingQuestionAnswered && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-slate-900 border-b border-amber-500/30 p-4 animate-fade-in">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Welcome to My Plan
              </span>
              <h3 className="text-base font-bold text-white">What are you planning today?</h3>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {[
                { id: 'today', label: 'Today', date: new Date().toISOString().split('T')[0], view: 'day' as const },
                { id: 'tomorrow', label: 'Tomorrow', date: new Date(Date.now() + 86400000).toISOString().split('T')[0], view: 'day' as const },
                { id: 'week', label: 'This Week', date: new Date().toISOString().split('T')[0], view: 'week' as const },
                { id: 'custom', label: 'Choose Days', date: new Date().toISOString().split('T')[0], view: 'month' as const }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setActiveDate(opt.date);
                    setCurrentView(opt.view);
                    setLastPlanningChoice(opt.id as any);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 font-bold text-xs text-white border border-slate-700 transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Top Header Controls */}
      <div className="max-w-2xl mx-auto pt-6 px-4 space-y-4">
        {/* Date Title & Day Navigation */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleShiftDay(-1)}
              aria-label="Previous day"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>

            <h1 className={`font-black text-white tracking-tight ${biggerText ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
              {formattedDate}
            </h1>

            <button
              onClick={() => handleShiftDay(1)}
              aria-label="Next day"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>

            <button
              onClick={() => setActiveDate(new Date().toISOString().split('T')[0])}
              className="ml-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs font-bold text-slate-300 hover:text-white transition"
            >
              Today
            </button>
          </div>

          {/* Quick Tools: Bigger text & Text queue */}
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleBiggerText}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                biggerText
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Toggle larger accessibility text"
            >
              <Type className="w-3.5 h-3.5" />
              <span>Bigger text</span>
            </button>

            <button
              onClick={() => setIsTextQueueOpen(true)}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition"
              title="Open SMS dispatch queue"
            >
              <MessageSquare className="w-4 h-4" />
              {sendQueue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
                  {sendQueue.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* 3 Large Big Tabs: Day | Week | Month | Diary */}
        <div className="grid grid-cols-4 p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-bold">
          {[
            { id: 'day' as const, label: 'Day' },
            { id: 'week' as const, label: 'Week' },
            { id: 'month' as const, label: 'Month' },
            { id: 'past' as const, label: 'Past Diary' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentView(tab.id)}
              className={`py-2.5 rounded-xl text-center transition ${
                currentView === tab.id
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Area */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {currentView === 'day' && <DayView onOpenAddModal={() => openAddFlow()} />}
        {currentView === 'week' && <WeekView onOpenAddModal={() => openAddFlow()} />}
        {currentView === 'month' && <MonthView />}
        {currentView === 'past' && <PastDaysDiary />}
      </div>

      {/* Full-Screen Add Flow Modal */}
      {isAddFlowOpen && (
        <AddFlowModal
          isOpen={isAddFlowOpen}
          onClose={closeAddFlow}
          dealerships={dealerships}
          contacts={contacts}
          currentUser={currentUser}
          preselected={addFlowPreselected}
          onTriggerTrip={(anchor, nearby) => {
            setTripAnchorData({ anchor, nearby });
            setIsTripSheetOpen(true);
          }}
        />
      )}

      {/* Out-of-Town Trip Assistant Sheet */}
      {isTripSheetOpen && tripAnchorData && (
        <TripPlanningSheet
          isOpen={isTripSheetOpen}
          onClose={() => {
            setIsTripSheetOpen(false);
            setTripAnchorData(null);
          }}
          anchorDealership={tripAnchorData.anchor}
          nearbyDealerships={tripAnchorData.nearby}
          currentUser={currentUser}
        />
      )}

      {/* Text Queue Drawer */}
      <TextQueueDrawer
        isOpen={isTextQueueOpen}
        onClose={() => setIsTextQueueOpen(false)}
      />
    </div>
  );
};

export const MyPlanModule: React.FC<MyPlanModuleProps> = (props) => {
  return (
    <MyPlanProvider userHomeZip={props.currentUser?.homeZipCode || props.currentUser?.homeZip || '75001'}>
      <MyPlanInner {...props} />
    </MyPlanProvider>
  );
};

export default MyPlanModule;
