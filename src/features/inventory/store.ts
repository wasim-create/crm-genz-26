// What people change on top of the sheets: which dealerships have Keyfetch
// and how their stock works, stock counts, the rules, and uploaded sheets
// (which replace the demo sheets). The demo sheets themselves are rebuilt
// from the CRM each time, so they always line up with "today".

import { useSyncExternalStore } from 'react';
import { SEED_VERSION } from '../../data/seedData';
import type { ContractRow, DispatchRow, ImportInfo, InventoryData, KeyfetchSetup, OrderRow, StockCount, StockRules } from './types';

export const INVENTORY_KEY = `apexdrive_inventory_v1_${SEED_VERSION}`;

export interface InventoryChanges {
  /** null = Keyfetch switched off for that dealership. */
  setups: Record<string, KeyfetchSetup | null>;
  counts: StockCount[];
  rules: Partial<StockRules>;
  uploaded: {
    orders?: OrderRow[];
    /** Compact: [contract number, effective date, dealer id]. */
    contracts?: [string, string, string][];
    dispatches?: DispatchRow[];
  };
  imports: InventoryData['imports'];
  removedByDealer?: Record<string, number>;
  officeOpening?: number;
}

const empty = (): InventoryChanges => ({ setups: {}, counts: [], rules: {}, uploaded: {}, imports: {} });

function load(): InventoryChanges {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(INVENTORY_KEY) : null;
    return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<InventoryChanges>) } : empty();
  } catch {
    return empty();
  }
}

let state = load();
const listeners = new Set<() => void>();
let saveError = '';

function set(next: InventoryChanges) {
  state = next;
  try {
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(state));
    saveError = '';
  } catch {
    saveError = 'This browser is out of storage space, so the upload only lasts until the page is closed.';
  }
  listeners.forEach(l => l());
}

export const useInventoryChanges = () =>
  useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state
  );

export const lastSaveError = () => saveError;

export function setSetup(dealerId: string, setup: KeyfetchSetup | null) {
  set({ ...state, setups: { ...state.setups, [dealerId]: setup } });
}

export function addCount(c: Omit<StockCount, 'id'>) {
  set({ ...state, counts: [...state.counts, { ...c, id: `cnt_${Date.now().toString(36)}` }] });
}

export function setStockRules(patch: Partial<StockRules>) {
  set({ ...state, rules: { ...state.rules, ...patch } });
}

export const resetStockRules = () => set({ ...state, rules: {} });

export function uploadOrders(rows: OrderRow[], info: ImportInfo) {
  set({ ...state, uploaded: { ...state.uploaded, orders: rows }, imports: { ...state.imports, orders: info } });
}

/**
 * The contracts sheet is replaced in full every week. Contracts that were in
 * the last upload but aren't now (duplicates taken out) are counted per store.
 */
export function uploadContracts(rows: ContractRow[], info: ImportInfo, previous: ContractRow[]) {
  const now = new Set(rows.map(r => r.contractNumber));
  const removedByDealer: Record<string, number> = {};
  previous.forEach(p => {
    if (!now.has(p.contractNumber)) removedByDealer[p.dealerId] = (removedByDealer[p.dealerId] ?? 0) + 1;
  });
  const removed = Object.values(removedByDealer).reduce((a, b) => a + b, 0);
  set({
    ...state,
    uploaded: { ...state.uploaded, contracts: rows.map(r => [r.contractNumber, r.effectiveDate, r.dealerId]) },
    imports: { ...state.imports, contracts: { ...info, removed } },
    removedByDealer
  });
}

export function uploadDispatches(rows: DispatchRow[], info: ImportInfo) {
  set({ ...state, uploaded: { ...state.uploaded, dispatches: rows }, imports: { ...state.imports, dispatches: info } });
}

/** Go back to the demo version of one sheet. */
export function clearUpload(sheet: 'orders' | 'contracts' | 'dispatches') {
  const uploaded = { ...state.uploaded };
  delete uploaded[sheet];
  const imports = { ...state.imports };
  delete imports[sheet];
  set({ ...state, uploaded, imports, ...(sheet === 'contracts' ? { removedByDealer: undefined } : {}) });
}

export const resetInventory = () => set(empty());

/** The sheets as the app uses them: uploads where there are any, demo otherwise, plus people's changes. */
export function mergeInventory(demo: InventoryData, ch: InventoryChanges): InventoryData {
  const setups = { ...demo.setups };
  Object.entries(ch.setups).forEach(([id, s]) => {
    if (s) setups[id] = s;
    else delete setups[id];
  });
  return {
    ...demo,
    orders: ch.uploaded.orders ?? demo.orders,
    contracts: ch.uploaded.contracts ? ch.uploaded.contracts.map(([contractNumber, effectiveDate, dealerId]) => ({ nameNumber: '', contractNumber, effectiveDate, dealerId })) : demo.contracts,
    dispatches: ch.uploaded.dispatches ?? demo.dispatches,
    counts: [...demo.counts, ...ch.counts],
    setups,
    officeOpening: ch.officeOpening ?? demo.officeOpening,
    rules: { ...demo.rules, ...ch.rules },
    imports: { ...demo.imports, ...ch.imports },
    removedByDealer: ch.uploaded.contracts ? ch.removedByDealer : demo.removedByDealer
  };
}
