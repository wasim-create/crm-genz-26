import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  PlanSlot,
  DaySettings,
  Trip,
  SendQueueItem,
  DayRecalculationResult
} from '../types/myplan.types';
import {
  DEFAULT_DAY_SETTINGS,
  recalculateDaySchedule,
  getDistanceBand,
  calculateDistanceMiles
} from '../engine/schedulingEngine';

interface UndoAction {
  id: string;
  description: string;
  executeUndo: () => void;
}

interface MyPlanContextType {
  slots: PlanSlot[];
  activeDate: string;
  setActiveDate: (date: string) => void;
  currentView: 'day' | 'week' | 'month' | 'past';
  setCurrentView: (view: 'day' | 'week' | 'month' | 'past') => void;
  daySettings: DaySettings;
  updateDaySettings: (settings: Partial<DaySettings>) => void;
  biggerText: boolean;
  toggleBiggerText: () => void;
  
  // Opening question
  openingQuestionAnswered: boolean;
  setOpeningQuestionAnswered: (v: boolean) => void;
  lastPlanningChoice: 'today' | 'tomorrow' | 'week' | 'custom' | null;
  setLastPlanningChoice: (choice: 'today' | 'tomorrow' | 'week' | 'custom') => void;

  // Trips & Queues
  trips: Trip[];
  addTrip: (trip: Trip) => void;
  sendQueue: SendQueueItem[];
  addSendQueueItem: (item: SendQueueItem) => void;
  removeSendQueueItem: (id: string) => void;
  markSendQueueItemSent: (id: string) => void;

  // Slot mutations
  addSlot: (slot: PlanSlot) => void;
  addBatchSlots: (newSlots: PlanSlot[]) => void;
  updateSlot: (id: string, updates: Partial<PlanSlot>) => void;
  deleteSlot: (id: string) => void;
  moveSlotArrow: (slotId: string, direction: 'up' | 'down') => void;
  reorderSlots: (reordered: PlanSlot[]) => void;
  moveSlotToDay: (slotId: string, targetDate: string) => void;
  logSlotOutcome: (slotId: string, outcome: string, notes?: string, topupQty?: number) => void;
  extendSlotTime: (slotId: string, extraMinutes: number) => void;

  // Add flow triggers
  isAddFlowOpen: boolean;
  addFlowPreselected: {
    dealership?: any;
    activityType?: any;
  } | null;
  openAddFlow: (preselected?: { dealership?: any; activityType?: any }) => void;
  closeAddFlow: () => void;

  // Calculations for current active date
  dayRecalc: DayRecalculationResult;
  activeDateSlots: PlanSlot[];
  unscheduledSlots: PlanSlot[];

  // Toast & Undo
  toast: { message: string; undoAction?: () => void } | null;
  showToast: (message: string, undoAction?: () => void) => void;
  clearToast: () => void;
}

const MyPlanContext = createContext<MyPlanContextType | null>(null);

const STORAGE_KEY_SLOTS = 'apex_myplan_slots_v3';
const STORAGE_KEY_SETTINGS = 'apex_myplan_settings_v3';
const STORAGE_KEY_CHOICE = 'apex_myplan_last_choice_v3';

// Helper to seed initial sample plan data (past 4 weeks, today, future 2 weeks, trips, email batches)
function getInitialSeedSlots(): PlanSlot[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const pastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

  return [
    // Today: Visit 1 (Home region)
    {
      id: 'seed_slot_today_1',
      userId: 'rep_1',
      date: todayStr,
      timeType: 'exact',
      startTime: '10:00',
      durationMin: 45,
      travelBeforeMin: 20,
      orderIndex: 0,
      workType: 'prospect',
      activityType: 'in_person',
      purpose: 'First visit & lot walk',
      dealershipId: 'd_lone_star',
      dealershipName: 'Lone Star Ford',
      dealershipCity: 'Plano',
      dealershipState: 'TX',
      contactName: 'John Miller',
      contactTitle: 'General Manager',
      contactPhone: '555-0101',
      distanceBand: 'home',
      distanceMiles: 14,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    // Today: Visit 2 (Locked Manager Assist with Jason Scott)
    {
      id: 'seed_slot_today_2',
      userId: 'rep_1',
      date: todayStr,
      timeType: 'exact',
      startTime: '11:30',
      durationMin: 45,
      travelBeforeMin: 15,
      orderIndex: 1,
      workType: 'prospect',
      activityType: 'meet',
      purpose: 'Manager Assist with VP Jason Scott',
      dealershipId: 'd_apex_nissan',
      dealershipName: 'Apex Nissan',
      dealershipCity: 'Plano',
      dealershipState: 'TX',
      contactName: 'Sarah Jenkins',
      contactTitle: 'Managing Partner',
      distanceBand: 'home',
      distanceMiles: 18,
      locked: true,
      source: 'assist',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    // Today: Visit 3 (Keyfetch client care topup)
    {
      id: 'seed_slot_today_3',
      userId: 'rep_1',
      date: todayStr,
      timeType: 'exact',
      startTime: '13:30',
      durationMin: 30,
      travelBeforeMin: 20,
      orderIndex: 2,
      workType: 'client',
      activityType: 'in_person',
      purpose: 'Keyfetch top-up',
      dealershipId: 'd_frisco_honda',
      dealershipName: 'Frisco Honda',
      dealershipCity: 'Frisco',
      dealershipState: 'TX',
      contactName: 'Robert Vance',
      contactTitle: 'Pre-Owned Director',
      distanceBand: 'home',
      distanceMiles: 22,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    // Tomorrow: Visit 1 (Edge prospect 64 miles)
    {
      id: 'seed_slot_tomorrow_1',
      userId: 'rep_1',
      date: tomorrow,
      timeType: 'exact',
      startTime: '10:30',
      durationMin: 45,
      travelBeforeMin: 45,
      orderIndex: 0,
      workType: 'prospect',
      activityType: 'in_person',
      purpose: 'First visit & lot walk',
      dealershipId: 'd_sherman_motors',
      dealershipName: 'Sherman Chevrolet',
      dealershipCity: 'Sherman',
      dealershipState: 'TX',
      contactName: 'Dave Thomas',
      contactTitle: 'Dealer Principal',
      distanceBand: 'edge',
      distanceMiles: 64,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    // Past Day (for Past Diary)
    {
      id: 'seed_slot_past_1',
      userId: 'rep_1',
      date: yesterday,
      timeType: 'exact',
      startTime: '10:00',
      durationMin: 45,
      travelBeforeMin: 20,
      orderIndex: 0,
      workType: 'prospect',
      activityType: 'in_person',
      purpose: 'First visit & lot walk',
      dealershipId: 'd_metro_toyota',
      dealershipName: 'Metro Toyota',
      dealershipCity: 'Dallas',
      dealershipState: 'TX',
      contactName: 'Bill Henderson',
      contactTitle: 'General Sales Manager',
      distanceBand: 'home',
      distanceMiles: 12,
      source: 'manual',
      status: 'done',
      outcome: 'Interested',
      notes: 'Great conversation about inventory tracking. Wants contract proposal.',
      pointsAwarded: 25,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'seed_slot_past_2',
      userId: 'rep_1',
      date: pastWeek,
      timeType: 'exact',
      startTime: '11:00',
      durationMin: 30,
      travelBeforeMin: 15,
      orderIndex: 0,
      workType: 'client',
      activityType: 'in_person',
      purpose: 'Keyfetch top-up',
      dealershipId: 'd_frisco_honda',
      dealershipName: 'Frisco Honda',
      dealershipCity: 'Frisco',
      dealershipState: 'TX',
      contactName: 'Robert Vance',
      distanceBand: 'home',
      distanceMiles: 22,
      source: 'manual',
      status: 'done',
      outcome: 'Top-up done',
      topupQty: 250,
      notes: 'Replenished 250 Keyfetch tags. Customer very pleased with speed.',
      pointsAwarded: 35,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

export const MyPlanProvider: React.FC<{ children: React.ReactNode; userHomeZip?: string }> = ({
  children,
  userHomeZip = '75001'
}) => {
  // 1. Slots State
  const [slots, setSlots] = useState<PlanSlot[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SLOTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored slots', e);
    }
    return getInitialSeedSlots();
  });

  // Save slots to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots));
    } catch (e) {
      console.warn('Failed to save slots to storage', e);
    }
  }, [slots]);

  // 2. Active Date & View
  const [activeDate, setActiveDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month' | 'past'>('day');

  // 3. Day Settings
  const [daySettings, setDaySettings] = useState<DaySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (stored) return { ...DEFAULT_DAY_SETTINGS, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_DAY_SETTINGS;
  });

  const updateDaySettings = useCallback((updates: Partial<DaySettings>) => {
    setDaySettings(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const [biggerText, setBiggerText] = useState<boolean>(() => !!daySettings.biggerText);
  const toggleBiggerText = useCallback(() => {
    setBiggerText(prev => {
      const next = !prev;
      updateDaySettings({ biggerText: next });
      return next;
    });
  }, [updateDaySettings]);

  // 4. Opening Question & Last Choice
  const [openingQuestionAnswered, setOpeningQuestionAnswered] = useState<boolean>(() => {
    return !!localStorage.getItem(STORAGE_KEY_CHOICE);
  });
  const [lastPlanningChoice, setLastPlanningChoiceState] = useState<'today' | 'tomorrow' | 'week' | 'custom' | null>(() => {
    return (localStorage.getItem(STORAGE_KEY_CHOICE) as any) || null;
  });
  const setLastPlanningChoice = useCallback((choice: 'today' | 'tomorrow' | 'week' | 'custom') => {
    setLastPlanningChoiceState(choice);
    setOpeningQuestionAnswered(true);
    try {
      localStorage.setItem(STORAGE_KEY_CHOICE, choice);
    } catch {}
  }, []);

  // 5. Trips & SendQueue
  const [trips, setTrips] = useState<Trip[]>([
    {
      id: 'trip_tyler_sample',
      userId: 'rep_1',
      tripName: 'Trip to Tyler & Longview',
      date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
      stops: [
        { dealershipId: 'd_tyler_1', dealershipName: 'Tyler Ford', city: 'Tyler', milesFromHome: 98 },
        { dealershipId: 'd_tyler_2', dealershipName: 'Classic Tyler', city: 'Tyler', milesFromHome: 102 }
      ],
      totalMiles: 210,
      estHours: 4.5,
      status: 'planned'
    }
  ]);
  const addTrip = useCallback((trip: Trip) => {
    setTrips(prev => [...prev, trip]);
  }, []);

  const [sendQueue, setSendQueue] = useState<SendQueueItem[]>([]);
  const addSendQueueItem = useCallback((item: SendQueueItem) => {
    setSendQueue(prev => [...prev, item]);
  }, []);
  const removeSendQueueItem = useCallback((id: string) => {
    setSendQueue(prev => prev.filter(x => x.id !== id));
  }, []);
  const markSendQueueItemSent = useCallback((id: string) => {
    setSendQueue(prev => prev.map(x => x.id === id ? { ...x, status: 'sent' } : x));
  }, []);

  // 6. Toast & Undo
  const [toast, setToast] = useState<{ message: string; undoAction?: () => void } | null>(null);
  const showToast = useCallback((message: string, undoAction?: () => void) => {
    setToast({ message, undoAction });
  }, []);
  const clearToast = useCallback(() => setToast(null), []);

  // 7. Add Flow Modal State
  const [isAddFlowOpen, setIsAddFlowOpen] = useState(false);
  const [addFlowPreselected, setAddFlowPreselected] = useState<{ dealership?: any; activityType?: any } | null>(null);

  const openAddFlow = useCallback((preselected?: { dealership?: any; activityType?: any }) => {
    setAddFlowPreselected(preselected || null);
    setIsAddFlowOpen(true);
  }, []);

  const closeAddFlow = useCallback(() => {
    setIsAddFlowOpen(false);
    setAddFlowPreselected(null);
  }, []);

  // 8. Slot Actions (with full Undo support)
  const addSlot = useCallback((slot: PlanSlot) => {
    setSlots(prev => {
      const next = [...prev, slot];
      return next;
    });
    showToast(`Added ${slot.dealershipName} to ${slot.date}`, () => {
      setSlots(prev => prev.filter(s => s.id !== slot.id));
    });
  }, [showToast]);

  const addBatchSlots = useCallback((newSlots: PlanSlot[]) => {
    setSlots(prev => [...prev, ...newSlots]);
    const count = newSlots.length;
    const typeLabel = newSlots[0]?.activityType === 'email' ? 'emails' : 'calls';
    showToast(`Scheduled ${count} separate ${typeLabel}`, () => {
      const addedIds = new Set(newSlots.map(s => s.id));
      setSlots(prev => prev.filter(s => !addedIds.has(s.id)));
    });
  }, [showToast]);

  const updateSlot = useCallback((id: string, updates: Partial<PlanSlot>) => {
    let original: PlanSlot | undefined;
    setSlots(prev => {
      original = prev.find(s => s.id === id);
      return prev.map(s => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s);
    });
    if (original) {
      const prevSlot = { ...original };
      showToast(`Updated ${original.dealershipName}`, () => {
        setSlots(prev => prev.map(s => s.id === id ? prevSlot : s));
      });
    }
  }, [showToast]);

  const deleteSlot = useCallback((id: string) => {
    let removed: PlanSlot | undefined;
    setSlots(prev => {
      removed = prev.find(s => s.id === id);
      return prev.filter(s => s.id !== id);
    });
    if (removed) {
      const restoreSlot = { ...removed };
      showToast(`Removed ${removed.dealershipName}`, () => {
        setSlots(prev => [...prev, restoreSlot]);
      });
    }
  }, [showToast]);

  const reorderSlots = useCallback((reordered: PlanSlot[]) => {
    setSlots(prev => {
      const reorderedMap = new Map(reordered.map(s => [s.id, s]));
      return prev.map(s => reorderedMap.get(s.id) || s);
    });
  }, []);

  const moveSlotArrow = useCallback((slotId: string, direction: 'up' | 'down') => {
    setSlots(prev => {
      const daySlots = prev
        .filter(s => s.date === activeDate && s.status !== 'skipped' && s.status !== 'not_scheduled')
        .sort((a, b) => a.orderIndex - b.orderIndex);

      const index = daySlots.findIndex(s => s.id === slotId);
      if (index === -1) return prev;
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= daySlots.length) return prev;

      // Swap orderIndex
      const current = daySlots[index];
      const target = daySlots[targetIndex];
      const prevOrderCurrent = current.orderIndex;
      const prevOrderTarget = target.orderIndex;

      const updatedDaySlots = daySlots.map(s => {
        if (s.id === current.id) return { ...s, orderIndex: prevOrderTarget };
        if (s.id === target.id) return { ...s, orderIndex: prevOrderCurrent };
        return s;
      });

      // Recalculate times
      const recalc = recalculateDaySchedule(updatedDaySlots, userHomeZip, daySettings);
      const recalcMap = new Map(recalc.updatedSlots.map(s => [s.id, s]));

      showToast(`Swapped order: ${current.dealershipName} moved ${direction}. Leave home by ${recalc.leaveByTimeFormatted}`, () => {
        // Undo swap
        setSlots(old => {
          return old.map(s => {
            if (s.id === current.id) return { ...s, orderIndex: prevOrderCurrent };
            if (s.id === target.id) return { ...s, orderIndex: prevOrderTarget };
            return s;
          });
        });
      });

      return prev.map(s => recalcMap.get(s.id) || s);
    });
  }, [activeDate, userHomeZip, daySettings, showToast]);

  const moveSlotToDay = useCallback((slotId: string, targetDate: string) => {
    let targetSlot: PlanSlot | undefined;
    setSlots(prev => {
      targetSlot = prev.find(s => s.id === slotId);
      if (!targetSlot) return prev;
      const prevDate = targetSlot.date;
      showToast(`Moved ${targetSlot.dealershipName} to ${targetDate}`, () => {
        setSlots(old => old.map(s => s.id === slotId ? { ...s, date: prevDate } : s));
      });
      return prev.map(s => s.id === slotId ? { ...s, date: targetDate, updatedAt: new Date().toISOString() } : s);
    });
  }, [showToast]);

  const logSlotOutcome = useCallback((slotId: string, outcome: string, notes?: string, topupQty?: number) => {
    setSlots(prev => prev.map(s => {
      if (s.id === slotId) {
        return {
          ...s,
          status: 'done',
          outcome,
          notes,
          topupQty,
          pointsAwarded: topupQty ? 35 : (outcome === 'Interested' || outcome === 'All good' ? 25 : 15),
          updatedAt: new Date().toISOString()
        };
      }
      return s;
    }));
    showToast(`Logged outcome for stop: ${outcome}`);
  }, [showToast]);

  const extendSlotTime = useCallback((slotId: string, extraMinutes: number) => {
    setSlots(prev => {
      const updated = prev.map(s => {
        if (s.id === slotId) {
          return {
            ...s,
            durationMin: s.durationMin + extraMinutes,
            updatedAt: new Date().toISOString()
          };
        }
        return s;
      });

      // Recalculate day
      const daySlots = updated.filter(s => s.date === activeDate);
      const recalc = recalculateDaySchedule(daySlots, userHomeZip, daySettings);
      const recalcMap = new Map(recalc.updatedSlots.map(s => [s.id, s]));

      if (recalc.ruleViolations.length > 0) {
        showToast(`Extended by ${extraMinutes} min. Warning: ${recalc.ruleViolations[0].message}`);
      } else {
        showToast(`Extended by ${extraMinutes} min. Day finishes at ${recalc.finishTimeFormatted}`);
      }

      return updated.map(s => recalcMap.get(s.id) || s);
    });
  }, [activeDate, userHomeZip, daySettings, showToast]);

  // 9. Active day computations
  const activeDateSlots = useMemo(() => {
    return slots
      .filter(s => s.date === activeDate && s.status !== 'skipped' && s.status !== 'not_scheduled')
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [slots, activeDate]);

  const unscheduledSlots = useMemo(() => {
    return slots.filter(s => s.status === 'not_scheduled' || s.status === 'skipped');
  }, [slots]);

  const dayRecalc = useMemo(() => {
    return recalculateDaySchedule(activeDateSlots, userHomeZip, daySettings);
  }, [activeDateSlots, userHomeZip, daySettings]);

  return (
    <MyPlanContext.Provider
      value={{
        slots,
        activeDate,
        setActiveDate,
        currentView,
        setCurrentView,
        daySettings,
        updateDaySettings,
        biggerText,
        toggleBiggerText,
        openingQuestionAnswered,
        setOpeningQuestionAnswered,
        lastPlanningChoice,
        setLastPlanningChoice,
        trips,
        addTrip,
        sendQueue,
        addSendQueueItem,
        removeSendQueueItem,
        markSendQueueItemSent,
        addSlot,
        addBatchSlots,
        updateSlot,
        deleteSlot,
        moveSlotArrow,
        reorderSlots,
        moveSlotToDay,
        logSlotOutcome,
        extendSlotTime,
        isAddFlowOpen,
        addFlowPreselected,
        openAddFlow,
        closeAddFlow,
        dayRecalc,
        activeDateSlots,
        unscheduledSlots,
        toast,
        showToast,
        clearToast
      }}
    >
      {children}
    </MyPlanContext.Provider>
  );
};

export const useMyPlan = () => {
  const context = useContext(MyPlanContext);
  if (!context) {
    throw new Error('useMyPlan must be used within a MyPlanProvider');
  }
  return context;
};
