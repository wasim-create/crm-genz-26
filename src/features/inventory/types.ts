// Keyfetch keychain stock. Shapes follow the real Google Sheets:
//   - Order tracking sheet (one row per factory order)
//   - Contracts sheet (one row per contract sold; replaced in full every week)
//   - The held-stock group's form sheet "Form Responses 1" (one row per dispatch from our office)

export interface OrderRow {
  orderDate: string;
  po: string;
  dealerName: string;
  dealerId: string;
  quantity: number;
  unitCost?: number;
  neededBy?: string;
  estShipDate?: string;
  actualShipDate?: string;
  tracking?: string;
  dateDelivered?: string;
  salesRep?: string;
  /** "In production", "Shipped", "Delivered" (anything else is ignored). */
  status: string;
  /** Going to our office (held stock for the group), not to a dealership. */
  toOffice?: boolean;
  comments?: string;
}

export interface ContractRow {
  nameNumber: string;
  contractNumber: string;
  effectiveDate: string;
  disbursement?: number;
  dealerId: string;
}

export interface DispatchRow {
  timestamp: string;
  salesRep?: string;
  dealershipName: string;
  quantity: number;
  tracking?: string;
  dealerId: string;
  purpose?: string;
  entryNumber?: string;
}

export interface StockCount {
  id: string;
  dealerId: string;
  date: string;
  count: number;
  byName: string;
}

/** Per dealership: it has Keyfetch, and how its stock works. */
export interface KeyfetchSetup {
  dealerId: string;
  /** Every contract uses one keychain (else stock is tracked from counts). */
  everyContract: boolean;
  /** Supplied by the factory directly, or from the stock we hold at the office. */
  supply: 'direct' | 'office';
  /** Keychains on site on the tracking start date. */
  openingStock?: number;
}

export interface StockRules {
  /** Counting starts on this date (contracts and deliveries before it are ignored). */
  trackFrom: string;
  /** Weeks from ordering to keychains arriving (China, up to two months). */
  leadWeeks: number;
  /** Extra weeks kept as a cushion. */
  bufferWeeks: number;
  /** Below this many weeks of cover: "order soon". */
  planAheadWeeks: number;
  /** Suggested order size: enough for this many weeks. */
  orderForWeeks: number;
  /** Office-supplied stores: send more below this many weeks. */
  officeSendWeeks: number;
  /** ...enough for this many weeks. */
  officeSendForWeeks: number;
  /** Pace = contracts per week over this many weeks. */
  paceWeeks: number;
  /** Stores tracked by counts: ask for a count after this many weeks. */
  countEveryWeeks: number;
}

export interface ImportInfo {
  at: string;
  rows: number;
  matched: number;
  unmatchedIds: string[];
  source: 'demo' | 'upload';
  /** Contracts sheet: contracts that were in the last update but not in this one. */
  removed?: number;
}

export interface InventoryData {
  orders: OrderRow[];
  contracts: ContractRow[];
  dispatches: DispatchRow[];
  counts: StockCount[];
  setups: Record<string, KeyfetchSetup>;
  /** The dealer group whose stock we hold at the office. */
  heldGroupId?: string;
  /** Keychains at the office on the tracking start date. */
  officeOpening?: number;
  rules: StockRules;
  imports: { orders?: ImportInfo; contracts?: ImportInfo; dispatches?: ImportInfo };
  /** Per dealership: contracts removed in the latest weekly update (duplicates taken out). */
  removedByDealer?: Record<string, number>;
}

export type StockStatus = 'out' | 'order_now' | 'order_soon' | 'send' | 'needs_count' | 'ok';
