// My Plan store: a small external store (no extra libraries) shared by the
// My Plan screens and the rest of the CRM (dealership card, "Plan later"
// buttons). Persists to localStorage per device, keeps a one-step Undo,
// queues CRM write-backs while offline, and syncs action points with
// Google Tasks through the connector interface.

import { useSyncExternalStore } from 'react';
import { ActionPoint, EditLogEntry, MyPlanSettings, PlanSlot } from '../types';
import { mockGoogleTasks, resetMockGoogle, TasksConnector } from '../connectors/googleConnectors';
import { buildSeed, SeedInput } from './seed';
import { moveByArrow, normalizeOrder, reorderDay } from '../engine/schedule';
import type { WritebackResult } from '../services/writeback';

const STORAGE_KEY = 'apexdrive_myplan_v4';

export interface Toast {
  id: number;
  text: string;
  points?: number;
  canUndo: boolean;
}

interface OutboxItem {
  id: string;
  kind: 'writeback';
  createdAt: string;
  result: WritebackResult;
}

export interface MyPlanState {
  slots: PlanSlot[];
  actionPoints: ActionPoint[];
  settings: Record<string, MyPlanSettings>;
  outbox: OutboxItem[];
  simulateOffline: boolean;
  seededOn?: string;
  /** Not persisted */
  toast?: Toast;
  syncing: boolean;
  online: boolean;
}

export interface CrmBridge {
  applyWriteback(result: WritebackResult): void;
}

export const DEFAULT_SETTINGS: MyPlanSettings = {
  dayStart: '08:30',
  preferredFinish: '17:30',
  lunch: true,
  biggerText: false,
  reminder: { enabled: true, day: 0, time: '18:00' },
  reminderAsked: false,
  walkthroughDone: false,
  aiSuggestions: true
};

function load(): MyPlanState {
  const base: MyPlanState = {
    slots: [],
    actionPoints: [],
    settings: {},
    outbox: [],
    simulateOffline: false,
    syncing: false,
    online: typeof navigator === 'undefined' ? true : navigator.onLine
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...base, ...JSON.parse(raw), toast: undefined, syncing: false };
  } catch {
    /* fall through to a fresh state */
  }
  return base;
}

let state: MyPlanState = load();
const listeners = new Set<() => void>();
let undoSnapshot: { slots: PlanSlot[]; actionPoints: ActionPoint[] } | null = null;
let bridge: CrmBridge | null = null;
let tasksConnector: TasksConnector = mockGoogleTasks;
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function persist() {
  try {
    const { toast, syncing, online, ...rest } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* storage unavailable */
  }
}

function set(patch: Partial<MyPlanState>, opts: { persist?: boolean } = {}) {
  state = { ...state, ...patch };
  if (opts.persist !== false) persist();
  listeners.forEach(l => l());
}

export const myPlanStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

export function useMyPlanState(): MyPlanState {
  return useSyncExternalStore(myPlanStore.subscribe, myPlanStore.getState, myPlanStore.getState);
}

export const isOffline = () => state.simulateOffline || !state.online;

// ---------- seeding / reset ----------

export function ensureSeeded(input: SeedInput) {
  if (state.seededOn) return;
  const seed = buildSeed(input);
  set({ slots: seed.slots, actionPoints: seed.actionPoints, seededOn: input.today });
}

export function resetMyPlan() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  resetMockGoogle();
  undoSnapshot = null;
  set({ slots: [], actionPoints: [], settings: {}, outbox: [], seededOn: undefined, simulateOffline: false });
}

// ---------- settings ----------

export const getSettings = (userId: string): MyPlanSettings => ({ ...DEFAULT_SETTINGS, ...state.settings[userId] });

export function updateSettings(userId: string, patch: Partial<MyPlanSettings>) {
  set({ settings: { ...state.settings, [userId]: { ...getSettings(userId), ...patch } } });
}

// ---------- toasts & undo ----------

export function showToast(text: string, opts: { points?: number; canUndo?: boolean } = {}) {
  toastSeq += 1;
  set({ toast: { id: toastSeq, text, points: opts.points, canUndo: !!opts.canUndo } }, { persist: false });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => set({ toast: undefined }, { persist: false }), opts.canUndo ? 7000 : 4000);
}

export const dismissToast = () => set({ toast: undefined }, { persist: false });

function snapshot() {
  undoSnapshot = { slots: state.slots, actionPoints: state.actionPoints };
}

export function undo() {
  if (!undoSnapshot) return;
  set({ slots: undoSnapshot.slots, actionPoints: undoSnapshot.actionPoints, toast: undefined });
  undoSnapshot = null;
  scheduleTasksSync();
}

// ---------- slots ----------

const stamp = (s: PlanSlot): PlanSlot => ({ ...s, updatedAt: new Date().toISOString() });

export function addSlots(newSlots: PlanSlot[], message?: string) {
  snapshot();
  set({ slots: [...state.slots, ...newSlots] });
  if (message) showToast(message, { canUndo: true });
}

/** Replace slots by id (or add new ones) in one step — used after the engine re-orders a day. */
export function upsertSlots(list: PlanSlot[], message?: string) {
  snapshot();
  const byId = new Map(list.map(s => [s.id, stamp(s)]));
  const kept = state.slots.map(s => byId.get(s.id) ?? s);
  const existing = new Set(state.slots.map(s => s.id));
  set({ slots: [...kept, ...list.filter(s => !existing.has(s.id)).map(stamp)] });
  if (message) showToast(message, { canUndo: true });
}

export function updateSlot(id: string, patch: Partial<PlanSlot>, opts: { message?: string; log?: EditLogEntry[]; undoable?: boolean } = {}) {
  if (opts.undoable !== false) snapshot();
  set({
    slots: state.slots.map(s =>
      s.id === id ? stamp({ ...s, ...patch, editLog: opts.log ? [...(s.editLog ?? []), ...opts.log] : s.editLog }) : s
    )
  });
  if (opts.message) showToast(opts.message, { canUndo: opts.undoable !== false });
}

export function removeSlot(id: string) {
  const slot = state.slots.find(s => s.id === id);
  snapshot();
  set({ slots: state.slots.filter(s => s.id !== id) });
  if (slot) showToast(`Removed ${slot.target.name}`, { canUndo: true });
}

function replaceDay(userId: string, date: string, daySlots: PlanSlot[]) {
  const ids = new Set(daySlots.map(s => s.id));
  set({ slots: [...state.slots.filter(s => !ids.has(s.id)), ...daySlots.map(stamp)] });
}

const slotsOn = (userId: string, date: string) => state.slots.filter(s => s.userId === userId && s.date === date);

export function arrowMove(userId: string, date: string, slotId: string, direction: 'up' | 'down', message?: string) {
  snapshot();
  replaceDay(userId, date, moveByArrow(slotsOn(userId, date), slotId, direction));
  if (message) showToast(message, { canUndo: true });
}

export function reorderWithinDay(userId: string, date: string, slotId: string, toIndex: number, message?: string) {
  snapshot();
  replaceDay(userId, date, reorderDay(slotsOn(userId, date), slotId, toIndex));
  if (message) showToast(message, { canUndo: true });
}

/**
 * Move a slot to another day (or back to the basket when date is undefined),
 * optionally at a position. Exact times are dropped when moving days unless
 * the slot is locked (a locked slot keeps its time on its new day).
 */
export function moveSlotToDay(slotId: string, date: string | undefined, opts: { index?: number; message?: string } = {}) {
  const slot = state.slots.find(s => s.id === slotId);
  if (!slot) return;
  snapshot();
  const moved: PlanSlot = stamp({
    ...slot,
    date,
    status: date ? (slot.status === 'basket' || slot.status === 'skipped' ? 'planned' : slot.status) : 'basket',
    timeMode: slot.locked ? slot.timeMode : slot.timeMode === 'exact' ? 'flow' : slot.timeMode,
    fixedTime: slot.locked ? slot.fixedTime : slot.timeMode === 'exact' ? undefined : slot.fixedTime,
    orderIndex: 9999
  });
  let others = state.slots.filter(s => s.id !== slotId);
  if (date) {
    const day = others.filter(s => s.userId === slot.userId && s.date === date);
    const rest = others.filter(s => !(s.userId === slot.userId && s.date === date));
    const sequence = normalizeOrder(day).sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = opts.index === undefined ? sequence.length : Math.max(0, Math.min(sequence.length, opts.index));
    const withMoved = normalizeOrder([...sequence.slice(0, idx), { ...moved, orderIndex: idx - 0.5 }, ...sequence.slice(idx)]);
    others = [...rest, ...withMoved];
    set({ slots: others });
  } else {
    set({ slots: [...others, moved] });
  }
  if (opts.message) showToast(opts.message, { canUndo: true });
}

// ---------- action points ----------

export function addActionPoints(points: ActionPoint[], message?: string) {
  if (points.length === 0) return;
  snapshot();
  set({ actionPoints: [...points, ...state.actionPoints] });
  if (message) showToast(message, { canUndo: true });
  scheduleTasksSync();
}

export function updateActionPoint(id: string, patch: Partial<ActionPoint>, message?: string) {
  snapshot();
  set({
    actionPoints: state.actionPoints.map(a => (a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a))
  });
  if (message) showToast(message, { canUndo: true });
  scheduleTasksSync();
}

export function removeActionPoint(id: string) {
  snapshot();
  const ap = state.actionPoints.find(a => a.id === id);
  set({ actionPoints: state.actionPoints.filter(a => a.id !== id) });
  if (ap?.googleTaskId) void tasksConnector.remove(ap.userId, ap.googleTaskId);
  showToast('Action point removed', { canUndo: true });
}

// ---------- CRM write-back (queued while offline) ----------

export function setCrmBridge(b: CrmBridge | null) {
  bridge = b;
  if (b) flushOutbox();
}

export function submitWriteback(result: WritebackResult) {
  if (isOffline() || !bridge) {
    set({
      outbox: [...state.outbox, { id: `ob_${Date.now()}`, kind: 'writeback', createdAt: new Date().toISOString(), result }]
    });
    return 'queued' as const;
  }
  bridge.applyWriteback(result);
  return 'applied' as const;
}

export function flushOutbox() {
  if (isOffline() || !bridge || state.outbox.length === 0) return;
  const items = state.outbox;
  set({ outbox: [] });
  items.forEach(item => bridge!.applyWriteback(item.result));
  showToast(`Back online — ${items.length} update${items.length === 1 ? '' : 's'} synced to the CRM`);
  scheduleTasksSync();
}

export function setSimulateOffline(value: boolean) {
  set({ simulateOffline: value });
  if (!value) flushOutbox();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    set({ online: true }, { persist: false });
    flushOutbox();
  });
  window.addEventListener('offline', () => set({ online: false }, { persist: false }));
}

// ---------- Google Tasks two-way sync ----------

export function setTasksConnector(c: TasksConnector) {
  tasksConnector = c;
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let activeUserId: string | null = null;

export function setActiveUser(userId: string) {
  activeUserId = userId;
  scheduleTasksSync();
}

export function scheduleTasksSync(delay = 500) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    if (activeUserId) void syncGoogleTasks(activeUserId);
  }, delay);
}

const apNotes = (a: ActionPoint) => (a.dealershipName ? `ApexDrive CRM · ${a.dealershipName}` : 'ApexDrive CRM');

export async function syncGoogleTasks(userId: string) {
  if (isOffline() || state.syncing) return;
  set({ syncing: true }, { persist: false });
  try {
    const remote = await tasksConnector.list(userId);
    const byId = new Map(remote.map(t => [t.id, t]));
    let local = state.actionPoints;
    const linked = new Set<string>();

    for (const ap of local.filter(a => a.userId === userId)) {
      const r = ap.googleTaskId ? byId.get(ap.googleTaskId) : undefined;
      if (r) linked.add(r.id);
      if (!ap.googleTaskId || !r) {
        const created = await tasksConnector.upsert(userId, {
          title: ap.title,
          notes: apNotes(ap),
          due: ap.dueDate,
          status: ap.done ? 'completed' : 'needsAction'
        });
        linked.add(created.id);
        local = local.map(a => (a.id === ap.id ? { ...a, googleTaskId: created.id, updatedAt: created.updated } : a));
      } else if (r.updated > ap.updatedAt) {
        // Changed in Google Tasks → bring into the CRM.
        local = local.map(a =>
          a.id === ap.id
            ? { ...a, title: r.title, dueDate: r.due, done: r.status === 'completed', doneAt: r.status === 'completed' ? a.doneAt ?? r.updated : undefined, updatedAt: r.updated }
            : a
        );
      } else if (ap.updatedAt > r.updated) {
        const pushed = await tasksConnector.upsert(userId, {
          id: r.id,
          title: ap.title,
          notes: apNotes(ap),
          due: ap.dueDate,
          status: ap.done ? 'completed' : 'needsAction'
        });
        local = local.map(a => (a.id === ap.id ? { ...a, updatedAt: pushed.updated } : a));
      }
    }

    // Tasks created directly in Google Tasks appear in the CRM too.
    for (const r of remote) {
      if (linked.has(r.id)) continue;
      local = [
        {
          id: `ap_g_${r.id}`,
          userId,
          title: r.title,
          dueDate: r.due,
          done: r.status === 'completed',
          source: 'manual',
          googleTaskId: r.id,
          createdAt: r.updated,
          updatedAt: r.updated
        },
        ...local
      ];
    }

    if (local !== state.actionPoints) set({ actionPoints: local });
  } finally {
    set({ syncing: false }, { persist: false });
  }
}

export const getTasksConnector = () => tasksConnector;
