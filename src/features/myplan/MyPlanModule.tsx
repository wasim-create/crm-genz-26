// My Plan — the sales rep's day, week and month. Entry point used by App.

import React, { useEffect, useMemo, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import {
  Contact,
  DealerGroup,
  Dealership,
  GameRule,
  ManagerPriority,
  ProductBonus,
  ProductCatalogItem,
  User
} from '../../types/crm';
import { DEFAULT_ENGINE_SETTINGS } from './engine/geo';
import { layoutDay } from './engine/schedule';
import { isMessage } from './engine/tasks';
import { addDays, todayISO, toHHMM } from './engine/time';
import { dismissToast, ensureSeeded, getSettings, setActiveUser, undo, useMyPlanState } from './data/store';
import { mockGoogleCalendar } from './connectors/googleConnectors';
import { buildSuggestions } from './services/suggestions';
import { MyPlanContextValue, MyPlanProvider, SheetState } from './ui/context';
import { Header, MonthView } from './ui/HeaderAndMonth';
import { DayView } from './ui/DayView';
import { WeekView } from './ui/WeekView';
import { AddFlow } from './ui/AddFlow';
import { EditSlotSheet, MoveSheet } from './ui/SlotSheets';
import { OutcomeSheet } from './ui/OutcomeSheet';
import { BasketSheet, ReminderBanner, SettingsSheet, TodoSheet, Walkthrough } from './ui/OtherSheets';

export interface MyPlanModuleProps {
  currentUser: User;
  users: User[];
  dealerships: Dealership[];
  contacts: Contact[];
  groups: DealerGroup[];
  catalog: ProductCatalogItem[];
  gameRules: GameRule[];
  productBonuses: ProductBonus[];
  priorities: ManagerPriority[];
  /** Opened from elsewhere in the CRM ("Add to my plan" / "Plan later"). */
  request?: { dealershipId: string; planLater?: boolean; nonce: number } | null;
  onRequestHandled?: () => void;
  onAddContact: (c: Contact) => void;
  onAddDealership: (d: Dealership) => void;
  onClaimDealership: (d: Dealership) => void;
  onOpenDealership: (d: Dealership) => void;
}

const VIEWER_ROLES = ['manager', 'team_lead', 'owner', 'executive'];

export const MyPlanModule: React.FC<MyPlanModuleProps> = props => {
  const { currentUser, users, dealerships, contacts, groups, catalog } = props;
  const state = useMyPlanState();
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [view, setView] = useState<'day' | 'week' | 'month'>('day');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [viewUserId, setViewUserId] = useState(currentUser.id);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => setViewUserId(currentUser.id), [currentUser.id]);

  useEffect(() => {
    if (dealerships.length > 0) ensureSeeded({ users, dealerships, contacts, groups, catalog, today });
  }, [dealerships.length, state.seededOn, users, contacts, groups, catalog, today]);

  useEffect(() => setActiveUser(currentUser.id), [currentUser.id]);

  const viewUser = users.find(u => u.id === viewUserId) ?? currentUser;
  const readOnly = viewUser.id !== currentUser.id;
  const settings = getSettings(currentUser.id);
  const viewSettings = getSettings(viewUser.id);
  const engine = useMemo(
    () => ({ ...DEFAULT_ENGINE_SETTINGS, dayStart: viewSettings.dayStart, preferredFinish: viewSettings.preferredFinish, lunch: viewSettings.lunch }),
    [viewSettings.dayStart, viewSettings.preferredFinish, viewSettings.lunch]
  );
  const home = viewUser.homeCoords;

  const userSlots = useMemo(() => state.slots.filter(s => s.userId === viewUser.id), [state.slots, viewUser.id]);
  const byDate = useMemo(() => {
    const m = new Map<string, typeof userSlots>();
    userSlots.forEach(s => {
      if (!s.date) return;
      const list = m.get(s.date) ?? [];
      list.push(s);
      m.set(s.date, list);
    });
    return m;
  }, [userSlots]);
  const layoutCache = useMemo(() => new Map<string, ReturnType<typeof layoutDay>>(), [byDate, engine, home]);
  const daySlots = (d: string) => byDate.get(d) ?? [];
  const layout = (d: string) => {
    let l = layoutCache.get(d);
    if (!l) {
      l = layoutDay(daySlots(d), { home, settings: engine });
      layoutCache.set(d, l);
    }
    return l;
  };
  const basket = useMemo(() => userSlots.filter(s => s.status === 'basket').sort((a, b) => a.orderIndex - b.orderIndex), [userSlots]);
  const dealershipById = useMemo(() => new Map(dealerships.map(d => [d.id, d])), [dealerships]);
  const suggestions = useMemo(
    () =>
      viewSettings.aiSuggestions
        ? buildSuggestions({ user: viewUser, dealerships, priorities: props.priorities, bonuses: props.productBonuses, catalog, slots: userSlots, today })
        : new Map(),
    [viewSettings.aiSuggestions, viewUser, dealerships, props.priorities, props.productBonuses, catalog, userSlots, today]
  );

  const viewers = useMemo(() => {
    if (!VIEWER_ROLES.includes(currentUser.role)) return [];
    const reps = users.filter(u => u.role === 'new_rep' || u.role === 'veteran_rep' || u.role === 'manager');
    if (currentUser.role === 'manager') return reps.filter(u => u.managerId === currentUser.id);
    return reps.filter(u => u.id !== currentUser.id);
  }, [currentUser, users]);

  // First visit: short walkthrough.
  useEffect(() => {
    if (!readOnly && state.seededOn && !settings.walkthroughDone && !sheet) setSheet({ kind: 'walkthrough' });
  }, [readOnly, state.seededOn, settings.walkthroughDone]);

  // "Add to my plan" / "Plan later" from elsewhere in the CRM.
  useEffect(() => {
    if (!props.request) return;
    setViewUserId(currentUser.id);
    setSheet({ kind: 'add', preset: { dealershipId: props.request.dealershipId, planLater: props.request.planLater, nonce: props.request.nonce } });
    props.onRequestHandled?.();
  }, [props.request?.nonce]);

  // Keep the (demo) Google Calendar in step with the plan.
  useEffect(() => {
    if (readOnly) return;
    const t = setTimeout(() => {
      const events: Parameters<typeof mockGoogleCalendar.replaceForSlots>[1] = [];
      for (let i = -7; i <= 30; i++) {
        const d = addDays(today, i);
        const list = byDate.get(d);
        if (!list) continue;
        const l = layoutDay(list, { home, settings: engine });
        list.forEach(s => {
          if (s.source === 'calendar' || s.status === 'skipped') return;
          const t2 = l.timings[s.id];
          const start = t2 ? toHHMM(t2.start) : s.sendTime ?? '10:00';
          const end = t2 ? toHHMM(t2.end) : start;
          events.push({ slotId: s.id, title: `${isMessage(s.how) ? 'Send' : s.how === 'in_person' ? 'Visit' : 'Call'} — ${s.target.name}`, date: d, start, end });
        });
      }
      void mockGoogleCalendar.replaceForSlots(viewUser.id, events);
    }, 1200);
    return () => clearTimeout(t);
  }, [byDate, readOnly, viewUser.id, engine, home, today]);

  const value: MyPlanContextValue = {
    today,
    now,
    user: currentUser,
    viewUser,
    readOnly,
    users,
    dealerships,
    dealershipById,
    contacts,
    groups,
    catalog,
    gameRules: props.gameRules,
    productBonuses: props.productBonuses,
    priorities: props.priorities,
    settings,
    engine,
    home,
    slots: userSlots,
    daySlots,
    layout,
    basket,
    suggestions,
    date,
    setDate,
    view,
    setView,
    sheet,
    openSheet: setSheet,
    closeSheet: () => setSheet(null),
    onAddContact: props.onAddContact,
    onAddDealership: props.onAddDealership,
    onClaimDealership: props.onClaimDealership,
    onOpenDealership: props.onOpenDealership
  };

  const close = () => setSheet(null);

  return (
    <MyPlanProvider value={value}>
      <div className="mx-auto max-w-6xl text-[16px]" style={settings.biggerText ? { zoom: 1.15 } : undefined}>
        <Header viewers={viewers} onViewUser={setViewUserId} />
        <ReminderBanner />
        {!state.seededOn ? (
          <div className="py-16 text-center text-slate-500">Loading your plan…</div>
        ) : view === 'day' ? (
          <div className="mx-auto max-w-3xl">
            <DayView />
          </div>
        ) : view === 'week' ? (
          <WeekView />
        ) : (
          <MonthView />
        )}
      </div>

      {sheet?.kind === 'add' && <AddFlow key={sheet.preset?.nonce ?? 'add'} preset={sheet.preset} onClose={close} />}
      {sheet?.kind === 'edit' && <EditSlotSheet key={sheet.slotId} slotId={sheet.slotId} onClose={close} />}
      {sheet?.kind === 'outcome' && <OutcomeSheet key={sheet.slotId} slotId={sheet.slotId} onClose={close} />}
      {sheet?.kind === 'move' && <MoveSheet key={sheet.slotId} slotId={sheet.slotId} onClose={close} />}
      {sheet?.kind === 'todo' && <TodoSheet onClose={close} />}
      {sheet?.kind === 'basket' && <BasketSheet onClose={close} />}
      {sheet?.kind === 'settings' && <SettingsSheet onClose={close} />}
      {sheet?.kind === 'walkthrough' && <Walkthrough onClose={close} />}

      {state.toast && (
        <div
          role="status"
          className="fixed left-1/2 top-3 z-[70] flex w-[min(92vw,560px)] -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-[16px] text-white shadow-2xl"
        >
          {state.toast.points ? <span className="rounded-lg bg-amber-500 px-2 font-bold text-slate-900">+{state.toast.points}</span> : null}
          <span className="flex-1">{state.toast.text}</span>
          {state.toast.canUndo && (
            <button type="button" onClick={undo} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-white/15 px-3 font-bold text-amber-300 hover:bg-white/25">
              <Undo2 className="h-4 w-4" /> Undo
            </button>
          )}
          <button type="button" aria-label="Dismiss" onClick={dismissToast} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </MyPlanProvider>
  );
};

export default MyPlanModule;
