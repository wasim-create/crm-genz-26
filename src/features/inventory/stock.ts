// Keychains on hand, pace, weeks left and when to order. Plain rules, no AI.
//
//   on hand  = opening stock (or the latest count)
//            + keychains delivered / sent from the office since then
//            - contracts sold since then (each contract number counted once)
//   pace     = contracts per week over the last few weeks
//   cover    = (on hand + on the way) / pace, in weeks
//
// Factory orders take up to two months, so a dealership supplied directly
// needs ordering when cover drops under lead time + a cushion. Stores supplied
// from our office are topped up in days, so they only need a short warning;
// the office stock itself follows the two-month rule for the whole group.

import type { ContractRow, InventoryData, OrderRow, StockCount, StockRules, StockStatus } from './types';

export const DEFAULT_STOCK_RULES: Omit<StockRules, 'trackFrom'> = {
  leadWeeks: 9,
  bufferWeeks: 1,
  planAheadWeeks: 14,
  orderForWeeks: 16,
  officeSendWeeks: 3,
  officeSendForWeeks: 6,
  paceWeeks: 8,
  countEveryWeeks: 6
};

export const STATUS_LABEL: Record<StockStatus, string> = {
  out: 'Out of stock',
  order_now: 'Order now',
  order_soon: 'Order soon',
  send: 'Send from office',
  needs_count: 'Needs a count',
  ok: 'OK'
};

export const STATUS_RANK: Record<StockStatus, number> = { out: 0, order_now: 1, send: 2, needs_count: 3, order_soon: 4, ok: 5 };

export interface OnTheWay {
  po: string;
  quantity: number;
  status: string;
  /** Best guess at arrival (ORDER needed by, else estimated ship + 3 weeks). */
  eta?: string;
}

export interface DealerStock {
  dealerId: string;
  supply: 'direct' | 'office';
  basis: 'contracts' | 'counts';
  /** Keychains on site now (null when it can't be worked out yet). */
  onHand: number | null;
  /** True when on hand is an estimate from an older count. */
  estimated: boolean;
  onTheWay: OnTheWay[];
  onTheWayQty: number;
  /** Keychains used per week. */
  pace: number;
  /** Weeks until it runs out, counting what's on the way (null = no use / unknown). */
  weeksLeft: number | null;
  status: StockStatus;
  /** Last day to place the factory order (direct supply). */
  orderBy?: string;
  suggestedQty: number;
  lastDelivery?: { date: string; quantity: number; from: 'factory' | 'office' };
  lastCount?: StockCount;
  countDue: boolean;
  /** Contracts per week, oldest first (last 12 weeks). */
  weekly: number[];
  /** Contracts have dropped sharply lately (early warning about the client). */
  drop?: { recent: number; usual: number };
  /** Contracts removed from the latest weekly update (duplicates taken out). */
  removed?: number;
  contractsSinceStart: number;
}

const DAY = 86400000;
const t = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).getTime();
const isoOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const addDaysISO = (iso: string, days: number) => isoOf(t(iso) + days * DAY);
const weeksBetween = (a: string, b: string) => (t(b) - t(a)) / (7 * DAY);
const roundUp = (n: number, step: number) => Math.max(0, Math.ceil(n / step) * step);

const statusOf = (o: OrderRow) => o.status.trim().toLowerCase();
export const isDelivered = (o: OrderRow) => statusOf(o) === 'delivered';
export const isOnTheWay = (o: OrderRow) => statusOf(o) === 'in production' || statusOf(o) === 'shipped';

export function etaOf(o: OrderRow): string | undefined {
  if (o.neededBy) return o.neededBy.slice(0, 10);
  const ship = o.actualShipDate ?? o.estShipDate;
  return ship ? addDaysISO(ship, 21) : undefined;
}

/** Each contract number once (the weekly sheet can repeat or drop rows). */
export function uniqueContracts(rows: ContractRow[]): ContractRow[] {
  const seen = new Map<string, ContractRow>();
  rows.forEach(r => {
    const k = r.contractNumber.trim();
    if (k && !seen.has(k)) seen.set(k, r);
  });
  return [...seen.values()];
}

export interface StockIndex {
  contractsBy: Map<string, ContractRow[]>;
  deliveriesBy: Map<string, { date: string; quantity: number; from: 'factory' | 'office' }[]>;
  onTheWayBy: Map<string, OrderRow[]>;
  countsBy: Map<string, StockCount[]>;
}

/** Group the sheets by dealership once, for speed. */
export function indexStock(data: InventoryData): StockIndex {
  const push = <T,>(m: Map<string, T[]>, k: string, v: T) => m.set(k, [...(m.get(k) ?? []), v]);
  const contractsBy = new Map<string, ContractRow[]>();
  uniqueContracts(data.contracts).forEach(c => push(contractsBy, c.dealerId, c));
  const deliveriesBy = new Map<string, { date: string; quantity: number; from: 'factory' | 'office' }[]>();
  const onTheWayBy = new Map<string, OrderRow[]>();
  data.orders.forEach(o => {
    const key = o.toOffice ? '__office' : o.dealerId;
    if (isDelivered(o) && (o.dateDelivered ?? o.actualShipDate)) push(deliveriesBy, key, { date: (o.dateDelivered ?? o.actualShipDate)!.slice(0, 10), quantity: o.quantity, from: 'factory' });
    else if (isOnTheWay(o)) push(onTheWayBy, key, o);
  });
  data.dispatches.forEach(d => push(deliveriesBy, d.dealerId, { date: d.timestamp.slice(0, 10), quantity: d.quantity, from: 'office' }));
  const countsBy = new Map<string, StockCount[]>();
  [...data.counts].sort((a, b) => a.date.localeCompare(b.date)).forEach(c => push(countsBy, c.dealerId, c));
  return { contractsBy, deliveriesBy, onTheWayBy, countsBy };
}

/** Contracts per week for the last n weeks (oldest first), counting back from today. */
function weeklyCounts(contracts: ContractRow[], today: string, n: number): number[] {
  const out = new Array(n).fill(0);
  const end = t(today) + DAY / 2;
  contracts.forEach(c => {
    const age = Math.floor((end - t(c.effectiveDate)) / (7 * DAY));
    if (age >= 0 && age < n) out[n - 1 - age]++;
  });
  return out;
}

export function dealerStock(dealerId: string, data: InventoryData, today: string, index: StockIndex = indexStock(data)): DealerStock | null {
  const setup = data.setups[dealerId];
  if (!setup) return null;
  const r = data.rules;
  const from = r.trackFrom;
  const contracts = (index.contractsBy.get(dealerId) ?? []).filter(c => c.effectiveDate.slice(0, 10) >= from && c.effectiveDate.slice(0, 10) <= today);
  const deliveries = (index.deliveriesBy.get(dealerId) ?? []).filter(d => d.date >= from && d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const counts = (index.countsBy.get(dealerId) ?? []).filter(c => c.date >= from && c.date <= today);
  const lastCount = counts[counts.length - 1];
  const receivedAfter = (date: string, until = today) => deliveries.filter(d => d.date > date && d.date <= until).reduce((n, d) => n + d.quantity, 0);
  const usedAfter = (date: string) => contracts.filter(c => c.effectiveDate.slice(0, 10) > date).length;

  const weekly = weeklyCounts(contracts, today, 12);
  const basis = setup.everyContract ? 'contracts' : 'counts';

  let onHand: number | null;
  let estimated = false;
  let pace: number;
  if (basis === 'contracts') {
    const paceFrom = addDaysISO(today, -7 * r.paceWeeks);
    const recent = contracts.filter(c => c.effectiveDate.slice(0, 10) > paceFrom).length;
    const weeksTracked = Math.min(r.paceWeeks, Math.max(1, weeksBetween(from, today)));
    pace = recent / weeksTracked;
    onHand = lastCount ? lastCount.count + receivedAfter(lastCount.date) - usedAfter(lastCount.date) : (setup.openingStock ?? 0) + receivedAfter(addDaysISO(from, -1)) - contracts.length;
  } else {
    // Not every contract uses a keychain: go by real counts.
    if (!lastCount) {
      onHand = null;
      pace = 0;
    } else {
      const prev = counts[counts.length - 2];
      const w = prev ? weeksBetween(prev.date, lastCount.date) : 0;
      pace = prev && w >= 1 ? Math.max(0, (prev.count + receivedAfter(prev.date, lastCount.date) - lastCount.count) / w) : 0;
      const since = weeksBetween(lastCount.date, today);
      onHand = Math.max(0, Math.round(lastCount.count + receivedAfter(lastCount.date) - pace * since));
      estimated = since >= 1;
    }
  }

  const onTheWayRows = setup.supply === 'direct' ? index.onTheWayBy.get(dealerId) ?? [] : [];
  const onTheWay = onTheWayRows.map(o => ({ po: o.po, quantity: o.quantity, status: o.status, eta: etaOf(o) }));
  const onTheWayQty = onTheWay.reduce((n, o) => n + o.quantity, 0);
  const countDue = basis === 'counts' && (!lastCount || weeksBetween(lastCount.date, today) >= r.countEveryWeeks);

  let status: StockStatus = 'ok';
  let weeksLeft: number | null = null;
  let orderBy: string | undefined;
  let suggestedQty = 0;
  if (onHand === null) {
    status = 'needs_count';
  } else if (setup.supply === 'office') {
    weeksLeft = pace > 0 ? Math.max(0, onHand) / pace : null;
    if (onHand <= 0) status = 'out';
    else if (weeksLeft !== null && weeksLeft < r.officeSendWeeks) status = 'send';
    if (status !== 'ok') suggestedQty = roundUp(pace * r.officeSendForWeeks - Math.max(0, onHand), 5);
  } else {
    const cover = Math.max(0, onHand) + onTheWayQty;
    weeksLeft = pace > 0 ? cover / pace : null;
    const threshold = r.leadWeeks + r.bufferWeeks;
    // Nothing on site is a problem even when an order is on the way.
    if (onHand <= 0) status = 'out';
    else if (weeksLeft !== null && weeksLeft < threshold) status = 'order_now';
    else if (weeksLeft !== null && weeksLeft < r.planAheadWeeks) status = 'order_soon';
    if (weeksLeft !== null) orderBy = addDaysISO(today, Math.max(0, Math.floor((weeksLeft - threshold) * 7)));
    if (status !== 'ok') suggestedQty = roundUp(pace * r.orderForWeeks - cover, 10);
  }
  if (status === 'ok' && countDue) status = 'needs_count';

  const last = deliveries[deliveries.length - 1];
  const prior = weekly.slice(0, 9);
  const recent3 = weekly.slice(9);
  const usual = prior.reduce((a, b) => a + b, 0) / prior.length;
  const recent = recent3.reduce((a, b) => a + b, 0) / recent3.length;
  const drop = basis === 'contracts' && usual >= 2 && recent < usual * 0.4 ? { recent: Math.round(recent * 10) / 10, usual: Math.round(usual * 10) / 10 } : undefined;

  return {
    dealerId,
    supply: setup.supply,
    basis,
    onHand,
    estimated,
    onTheWay,
    onTheWayQty,
    pace: Math.round(pace * 10) / 10,
    weeksLeft: weeksLeft === null ? null : Math.round(weeksLeft * 10) / 10,
    status,
    orderBy,
    suggestedQty,
    lastDelivery: last,
    lastCount,
    countDue,
    weekly,
    drop,
    removed: data.removedByDealer?.[dealerId] || undefined,
    contractsSinceStart: contracts.length
  };
}

export interface OfficeStock {
  groupId: string;
  onHand: number;
  onTheWay: OnTheWay[];
  onTheWayQty: number;
  /** Keychains the group's stores use per week, together. */
  pace: number;
  /** Keychains sitting in the group's stores. */
  inStores: number;
  weeksLeft: number | null;
  status: StockStatus;
  orderBy?: string;
  suggestedQty: number;
  sentLast4Weeks: number;
  stores: string[];
}

/** The stock we hold at the office for one dealer group. */
export function officeStock(data: InventoryData, groupStoreIds: string[], stocks: Map<string, DealerStock>, today: string, index: StockIndex = indexStock(data)): OfficeStock | null {
  if (!data.heldGroupId) return null;
  const r = data.rules;
  const from = r.trackFrom;
  const delivered = (index.deliveriesBy.get('__office') ?? []).filter(d => d.date >= from && d.date <= today).reduce((n, d) => n + d.quantity, 0);
  const stores = groupStoreIds.filter(id => data.setups[id]?.supply === 'office');
  const sent = data.dispatches.filter(d => stores.includes(d.dealerId) && d.timestamp.slice(0, 10) >= from && d.timestamp.slice(0, 10) <= today);
  const onHand = (data.officeOpening ?? 0) + delivered - sent.reduce((n, d) => n + d.quantity, 0);
  const onTheWay = (index.onTheWayBy.get('__office') ?? []).map(o => ({ po: o.po, quantity: o.quantity, status: o.status, eta: etaOf(o) }));
  const onTheWayQty = onTheWay.reduce((n, o) => n + o.quantity, 0);
  const pace = stores.reduce((n, id) => n + (stocks.get(id)?.pace ?? 0), 0);
  const inStores = stores.reduce((n, id) => n + Math.max(0, stocks.get(id)?.onHand ?? 0), 0);
  // The office plus what's already in the stores has to last until a new order lands.
  const cover = Math.max(0, onHand) + inStores + onTheWayQty;
  const weeksLeft = pace > 0 ? cover / pace : null;
  const threshold = r.leadWeeks + r.bufferWeeks;
  let status: StockStatus = 'ok';
  if (onHand <= 0 && onTheWayQty === 0) status = 'out';
  else if (weeksLeft !== null && weeksLeft < threshold) status = 'order_now';
  else if (weeksLeft !== null && weeksLeft < r.planAheadWeeks) status = 'order_soon';
  const sentLast4Weeks = sent.filter(d => d.timestamp.slice(0, 10) > addDaysISO(today, -28)).reduce((n, d) => n + d.quantity, 0);
  return {
    groupId: data.heldGroupId,
    onHand,
    onTheWay,
    onTheWayQty,
    pace: Math.round(pace * 10) / 10,
    inStores,
    weeksLeft: weeksLeft === null ? null : Math.round(weeksLeft * 10) / 10,
    status,
    orderBy: weeksLeft === null ? undefined : addDaysISO(today, Math.max(0, Math.floor((weeksLeft - threshold) * 7))),
    suggestedQty: status === 'ok' ? 0 : roundUp(pace * r.orderForWeeks - cover, 25),
    sentLast4Weeks,
    stores
  };
}
