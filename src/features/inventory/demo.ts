// Demo Keyfetch stock, shaped exactly like the real sheets, built relative to
// "today" so it always tells the same story:
//   - most stores are fine; a few need ordering now or soon; one has run out
//     but has an order on the way;
//   - one dealer group's stock is held at our office and sent out to its stores;
//   - one store doesn't use a keychain for every contract (tracked by counts),
//     and its count is overdue;
//   - one client's contracts have dropped sharply (early warning);
//   - the latest weekly contracts update removed a couple of duplicates.

import type { DealerGroup, Dealership, User } from '../../types/crm';
import { addDaysISO, DEFAULT_STOCK_RULES } from './stock';
import type { ContractRow, DispatchRow, InventoryData, KeyfetchSetup, OrderRow, StockCount } from './types';

const KEYFETCH = 'prod_3';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** Small repeatable random numbers for one dealership. */
const rng = (seed: string) => {
  let x = hash(seed) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
};

const FIRST = ['James', 'Maria', 'Robert', 'Linda', 'Michael', 'Patricia', 'David', 'Jennifer', 'Daniel', 'Susan', 'Anthony', 'Karen', 'Mark', 'Nancy', 'Paul', 'Lisa'];
const LAST = ['Reyes', 'Cohen', 'Park', 'Okoro', 'Dubois', 'Ivanova', 'Haddad', 'Moreno', 'Lindqvist', 'Nakamura', 'Brennan', 'Castillo', 'Novak', 'Adeyemi', 'Quinn', 'Sato'];

export interface DemoRoles {
  /** Dealership ids by role in the story. */
  heldGroupId?: string;
  officeStores: string[];
  counted?: string;
  drop?: string;
  out?: string;
  orderNow: string[];
}

export function buildInventoryDemo(dealerships: Dealership[], groups: DealerGroup[], users: User[], today: string): { data: InventoryData; roles: DemoRoles } {
  const repName = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '';
  };
  const kf = dealerships
    .filter(d => !d.isPlaceholder && d.signedProducts?.includes(KEYFETCH) && ['Client', 'Onboarding', 'Signed'].includes(d.stage))
    .sort((a, b) => a.id.localeCompare(b.id));

  // The group whose stock we hold: the one with the most Keyfetch stores.
  const byGroup = new Map<string, Dealership[]>();
  kf.forEach(d => d.groupId && byGroup.set(d.groupId, [...(byGroup.get(d.groupId) ?? []), d]));
  const held = [...byGroup.entries()].filter(([, ds]) => ds.length >= 2).sort((a, b) => b[1].length - a[1].length)[0];
  const heldGroupId = held?.[0];
  const officeStores = held ? held[1].map(d => d.id) : [];

  const others = kf.filter(d => !officeStores.includes(d.id));
  const counted = others[1]?.id;
  const drop = others[2]?.id;
  const out = others[3]?.id;
  const orderNow = [others[4]?.id, others[6]?.id].filter(Boolean) as string[];

  const trackFrom = addDaysISO(today, -7 * 78); // ~18 months of tracking
  const contractsFrom = addDaysISO(today, -7 * 104); // contracts go back further (2 years)
  const weekStart = (w: number) => addDaysISO(trackFrom, w * 7);
  const totalWeeks = 78;

  const setups: Record<string, KeyfetchSetup> = {};
  const orders: OrderRow[] = [];
  const contracts: ContractRow[] = [];
  const dispatches: DispatchRow[] = [];
  const counts: StockCount[] = [];
  let po = 41000;
  let contractNo = 7300000;

  const addContracts = (d: Dealership, perWeek: number, rand: () => number, fromWeek: number, toWeek: number, weekFactor: (w: number) => number, startDate = trackFrom) => {
    const made: string[] = [];
    for (let w = fromWeek; w < toWeek; w++) {
      const n = Math.max(0, Math.round(perWeek * weekFactor(w) + (rand() - 0.5) * 2));
      for (let i = 0; i < n; i++) {
        const date = addDaysISO(startDate, w * 7 + Math.floor(rand() * 5));
        if (date > today) continue;
        const num = `KF${contractNo++}`;
        contracts.push({
          nameNumber: `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]} - ${num.slice(-4)}`,
          contractNumber: num,
          effectiveDate: date,
          disbursement: Math.round(30 + rand() * 40),
          dealerId: d.id
        });
        made.push(date);
      }
    }
    return made;
  };

  const order = (d: Dealership | null, qty: number, placed: string, opts: { toOffice?: boolean; dealerId?: string; dealerName?: string; rep?: string } = {}): OrderRow => {
    const neededBy = addDaysISO(placed, 56);
    const ship = addDaysISO(placed, 35);
    const delivered = addDaysISO(placed, 54);
    const status = delivered <= today ? 'Delivered' : ship <= today ? 'Shipped' : 'In production';
    const o: OrderRow = {
      orderDate: placed,
      po: `PO-${po++}`,
      dealerName: opts.dealerName ?? d!.dealershipName,
      dealerId: opts.dealerId ?? d!.id,
      quantity: qty,
      unitCost: 2.35,
      neededBy,
      estShipDate: ship,
      actualShipDate: ship <= today ? ship : undefined,
      tracking: ship <= today ? `1Z${String(hash(String(po))).slice(0, 10)}` : undefined,
      dateDelivered: status === 'Delivered' ? delivered : undefined,
      salesRep: opts.rep ?? repName(d?.assignedRepId ?? null),
      status,
      toOffice: opts.toOffice,
      comments: opts.toOffice ? 'Held at office for group dispatch' : undefined
    };
    orders.push(o);
    return o;
  };

  // ── Stores supplied directly by the factory ──
  for (const d of others) {
    const rand = rng(d.id);
    const pace = 2 + Math.floor(rand() * 7); // 2–8 a week
    const everyContract = d.id !== counted;
    setups[d.id] = { dealerId: d.id, everyContract, supply: 'direct', openingStock: Math.round(pace * (10 + rand() * 6)) };
    const factor = (w: number) => (d.id === drop && w >= totalWeeks - 3 ? 0.15 : 1);
    // Contracts before tracking starts (ignored by the stock count, as on the real sheets)
    addContracts(d, pace, rand, 0, 26, () => 1, contractsFrom);
    const dates = addContracts(d, everyContract ? pace : Math.round(pace * 1.6), rand, 0, totalWeeks, factor);

    // Re-order as the stock runs down, the way the team does today.
    let stock = setups[d.id].openingStock!;
    const pending: { arrive: string; qty: number }[] = [];
    let used = 0;
    const usedRate = everyContract ? 1 : 0.6;
    for (let w = 0; w < totalWeeks; w++) {
      const ws = weekStart(w);
      const we = weekStart(w + 1);
      pending.filter(p => p.arrive >= ws && p.arrive < we).forEach(p => (stock += p.qty));
      const thisWeek = dates.filter(x => x >= ws && x < we).length * usedRate;
      used += thisWeek;
      stock -= thisWeek;
      const onWay = pending.filter(p => p.arrive >= we).reduce((n, p) => n + p.qty, 0);
      const weeksLeftNow = totalWeeks - w;
      // Story stores: stop re-ordering near the end so they need attention now.
      const holdBack = (orderNow.includes(d.id) && weeksLeftNow <= 10) || (d.id === out && weeksLeftNow <= 16 && weeksLeftNow > 4);
      if (!everyContract && w % 5 === 0 && w > 0 && w < totalWeeks - 8) {
        counts.push({ id: `cnt_${d.id}_${w}`, dealerId: d.id, date: ws, count: Math.max(0, Math.round(stock)), byName: repName(d.assignedRepId) });
      }
      if (!holdBack && stock + onWay < pace * 11) {
        const qty = Math.ceil((pace * 16) / 10) * 10;
        const o = order(d, qty, ws);
        pending.push({ arrive: o.dateDelivered ?? addDaysISO(ws, 54), qty });
      }
    }
    void used;

    // Story stores: a recent count sets exactly where they stand.
    const paceNow = pace;
    if (orderNow.includes(d.id)) counts.push({ id: `cnt_${d.id}_story`, dealerId: d.id, date: addDaysISO(today, -10), count: Math.round(paceNow * 9.5), byName: repName(d.assignedRepId) });
    if (d.id === out) counts.push({ id: `cnt_${d.id}_story`, dealerId: d.id, date: addDaysISO(today, -10), count: Math.round(paceNow * 0.6), byName: repName(d.assignedRepId) });
  }

  // ── The group whose stock we hold at the office ──
  if (heldGroupId) {
    const group = groups.find(g => g.id === heldGroupId);
    let office = 0;
    const officeArrivals: { arrive: string; qty: number }[] = [];
    const storeState = officeStores.map(id => {
      const d = dealerships.find(x => x.id === id)!;
      const rand = rng(id);
      const pace = 3 + Math.floor(rand() * 5);
      setups[id] = { dealerId: id, everyContract: true, supply: 'office', openingStock: pace * 6 };
      addContracts(d, pace, rand, 0, 26, () => 1, contractsFrom);
      const dates = addContracts(d, pace, rand, 0, totalWeeks, () => 1);
      return { d, pace, stock: pace * 6, dates };
    });
    const groupPace = storeState.reduce((n, s) => n + s.pace, 0);
    office = groupPace * 19;
    const officeOpening = office;
    let entry = 1;
    for (let w = 0; w < totalWeeks; w++) {
      const ws = weekStart(w);
      const we = weekStart(w + 1);
      officeArrivals.filter(a => a.arrive >= ws && a.arrive < we).forEach(a => (office += a.qty));
      for (const s of storeState) {
        s.stock -= s.dates.filter(x => x >= ws && x < we).length;
        // Story: one store is due a top-up right now.
        const skip = s === storeState[0] && totalWeeks - w <= 3;
        if (!skip && s.stock < s.pace * 3 && office > 0) {
          const qty = Math.min(office, Math.ceil((s.pace * 6) / 5) * 5);
          office -= qty;
          s.stock += qty;
          dispatches.push({
            timestamp: `${addDaysISO(ws, 1)}T10:${String(10 + (entry % 40)).padStart(2, '0')}:00`,
            salesRep: repName(s.d.assignedRepId),
            dealershipName: s.d.dealershipName,
            quantity: qty,
            tracking: `1Z${String(hash(`${s.d.id}${w}`)).slice(0, 10)}`,
            dealerId: s.d.id,
            purpose: 'Restock',
            entryNumber: String(entry++)
          });
        }
      }
      const onWay = officeArrivals.filter(a => a.arrive >= we).reduce((n, a) => n + a.qty, 0);
      // Story: the office stock is getting low and the team should order soon.
      const holdBack = totalWeeks - w <= 20;
      if (!holdBack && office + onWay < groupPace * 12) {
        const qty = Math.ceil((groupPace * 20) / 50) * 50;
        const o = order(null, qty, ws, { toOffice: true, dealerId: heldGroupId, dealerName: `${group?.name ?? 'Group'} (office stock)`, rep: '' });
        officeArrivals.push({ arrive: o.dateDelivered ?? addDaysISO(ws, 54), qty });
      }
    }
    // Story: one group store is down to its last couple of weeks.
    const low = storeState[1] ?? storeState[0];
    counts.push({ id: `cnt_${low.d.id}_story`, dealerId: low.d.id, date: addDaysISO(today, -7), count: low.pace * 3, byName: repName(low.d.assignedRepId) });
    return finish(officeOpening);
  }
  return finish(0);

  function finish(officeOpening: number) {
    // A recent stock count at one direct store (resets its running total).
    const countedStore = others[5];
    if (countedStore && setups[countedStore.id]?.everyContract) {
      counts.push({ id: `cnt_${countedStore.id}_recent`, dealerId: countedStore.id, date: addDaysISO(today, -16), count: Math.round(((setups[countedStore.id].openingStock ?? 40) * 0.7)), byName: repName(countedStore.assignedRepId) });
    }
    // The weekly update took out two duplicate contracts at one store.
    const removedByDealer: Record<string, number> = {};
    if (others[0]) removedByDealer[others[0].id] = 2;
    const monday = (() => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const info = (rows: number) => ({ at: `${monday}T08:00:00`, rows, matched: rows, unmatchedIds: [], source: 'demo' as const });
    const data: InventoryData = {
      orders,
      contracts,
      dispatches,
      counts,
      setups,
      heldGroupId,
      officeOpening,
      rules: { ...DEFAULT_STOCK_RULES, trackFrom },
      imports: { orders: info(orders.length), contracts: { ...info(contracts.length), removed: 2 }, dispatches: info(dispatches.length) },
      removedByDealer
    };
    return { data, roles: { heldGroupId, officeStores, counted, drop, out, orderNow } };
  }
}
