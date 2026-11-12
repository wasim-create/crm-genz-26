// What managers do about their team: check-ins, notes for the next check-in,
// flags they've acted on, and the rules (set by an owner). Kept in this
// browser for the demo, like the rest of the CRM.

import { useSyncExternalStore } from 'react';
import { SEED_VERSION } from '../../data/seedData';
import { DEFAULT_RULES, Flag, HandledMark, TeamRules, workdaysBefore } from './signals';

export const TEAM_KEY = `apexdrive_team_v1_${SEED_VERSION}`;

export interface CheckInNote {
  id: string;
  text: string;
  at: string;
  byName: string;
  flagId?: string;
  /** Set when it was talked through at a check-in. */
  discussedAt?: string;
}

export interface CheckIn {
  id: string;
  at: string;
  byName: string;
  notesDiscussed: string[];
}

export interface TeamState {
  checkIns: Record<string, CheckIn[]>;
  notes: Record<string, CheckInNote[]>;
  handled: Record<string, Record<string, HandledMark>>;
  rules: TeamRules;
}

// Demo history: when Jason last spoke to each rep (relative to today).
function demoCheckIns(): Record<string, CheckIn[]> {
  const today = new Date();
  const ago = (n: number) => workdaysBefore(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, n)[n - 1] + 'T16:30:00';
  const by = 'Jason Scott';
  return {
    u_kelley: [{ id: 'ci_k1', at: ago(3), byName: by, notesDiscussed: ['Commonwealth Ford terms: match the Toyota sheet'] }],
    u_kevin: [{ id: 'ci_v1', at: ago(5), byName: by, notesDiscussed: [] }],
    u_priya: [{ id: 'ci_p1', at: ago(9), byName: by, notesDiscussed: ['Farmington Valley Honda: what did the competitor offer?'] }],
    u_marcus: [{ id: 'ci_m1', at: ago(12), byName: by, notesDiscussed: [] }],
    u_ellie: [{ id: 'ci_e1', at: ago(4), byName: by, notesDiscussed: ['First-week plan: Granite State Ford walk-around'] }]
  };
}

const empty = (): TeamState => ({ checkIns: demoCheckIns(), notes: {}, handled: {}, rules: DEFAULT_RULES });

function load(): TeamState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(TEAM_KEY) : null;
    if (!raw) return empty();
    const s = JSON.parse(raw) as Partial<TeamState>;
    return { ...empty(), ...s, rules: { ...DEFAULT_RULES, ...s.rules, stuckDays: { ...DEFAULT_RULES.stuckDays, ...s.rules?.stuckDays } } };
  } catch {
    return empty();
  }
}

let state: TeamState = load();
const listeners = new Set<() => void>();

function set(next: TeamState) {
  state = next;
  try {
    localStorage.setItem(TEAM_KEY, JSON.stringify(state));
  } catch {
    /* storage full or private mode: keep in memory */
  }
  listeners.forEach(l => l());
}

const uid = () => `tn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function useTeamState(): TeamState {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );
}

export const getTeamState = () => state;

/** Remember that the manager acted on a flag, so it quietens down for a while. */
export function markHandled(repId: string, flag: Pick<Flag, 'id' | 'level'>, action: string, byName: string) {
  set({
    ...state,
    handled: { ...state.handled, [repId]: { ...state.handled[repId], [flag.id]: { at: new Date().toISOString(), by: byName, action, level: flag.level } } }
  });
}

export function undoHandled(repId: string, flagId: string) {
  const mine = { ...state.handled[repId] };
  delete mine[flagId];
  set({ ...state, handled: { ...state.handled, [repId]: mine } });
}

export function addNote(repId: string, text: string, byName: string, flagId?: string) {
  const note: CheckInNote = { id: uid(), text: text.trim(), at: new Date().toISOString(), byName, flagId };
  set({ ...state, notes: { ...state.notes, [repId]: [...(state.notes[repId] ?? []), note] } });
}

export function removeNote(repId: string, id: string) {
  set({ ...state, notes: { ...state.notes, [repId]: (state.notes[repId] ?? []).filter(n => n.id !== id) } });
}

/**
 * The manager has spoken to the rep. Notes waiting for the check-in are marked
 * as talked through, and every open flag counts as handled.
 */
export function recordCheckIn(repId: string, byName: string, openFlags: Pick<Flag, 'id' | 'level'>[]) {
  const at = new Date().toISOString();
  const waiting = (state.notes[repId] ?? []).filter(n => !n.discussedAt);
  const notes = (state.notes[repId] ?? []).map(n => (n.discussedAt ? n : { ...n, discussedAt: at }));
  const handled = { ...state.handled[repId] };
  openFlags.forEach(f => (handled[f.id] = { at, by: byName, action: 'Talked it through at a check-in', level: f.level }));
  const entry: CheckIn = { id: uid(), at, byName, notesDiscussed: waiting.map(n => n.text) };
  set({
    ...state,
    notes: { ...state.notes, [repId]: notes },
    handled: { ...state.handled, [repId]: handled },
    checkIns: { ...state.checkIns, [repId]: [entry, ...(state.checkIns[repId] ?? [])] }
  });
}

export function setRules(patch: Partial<TeamRules>) {
  set({ ...state, rules: { ...state.rules, ...patch, stuckDays: { ...state.rules.stuckDays, ...patch.stuckDays } } });
}

export const resetRules = () => set({ ...state, rules: DEFAULT_RULES });

export function resetTeam() {
  set(empty());
}

export const lastCheckIn = (s: TeamState, repId: string): CheckIn | undefined => s.checkIns[repId]?.[0];
