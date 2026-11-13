// Read CSV exports of the three Google Sheets. Columns are found by their
// header names (case and spacing don't matter), so extra columns are fine.

import type { ContractRow, DispatchRow, OrderRow } from './types';

/** Split CSV text into rows of cells (handles quotes, commas and new lines in quotes). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

/** "11/13/2026", "2026-11-13", "11/13/2026 10:22:33", "Nov 13, 2026" → "2026-11-13" (or "" if unreadable). */
export function toISODate(v: string | undefined): string {
  const s = (v ?? '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const num = (v: string | undefined) => {
  const n = Number(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

type Spec = Record<string, string[]>;

function table(text: string, spec: Spec, required: string[]) {
  const rows = parseCSV(text);
  if (!rows.length) return { error: 'The file is empty.' as string, get: null, body: [] as string[][] };
  const head = rows[0].map(norm);
  const col: Record<string, number> = {};
  for (const [key, names] of Object.entries(spec)) {
    const i = head.findIndex(h => names.map(norm).includes(h));
    if (i >= 0) col[key] = i;
  }
  const missing = required.filter(k => col[k] === undefined).map(k => spec[k][0]);
  if (missing.length) return { error: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`, get: null, body: [] };
  const get = (r: string[], key: string) => (col[key] === undefined ? undefined : (r[col[key]] ?? '').trim());
  return { error: '', get, body: rows.slice(1) };
}

const DEALER_ID = ['Dealer ID', 'Dealership ID', 'DealerID', 'Dealer_ID', 'Dealership_ID'];

export function readOrders(text: string, heldGroupId?: string): { rows: OrderRow[]; error: string } {
  const t = table(
    text,
    {
      orderDate: ['Order date'],
      po: ['PO#', 'PO', 'PO Number'],
      dealerName: ['DEALER NAME', 'Dealership Name'],
      dealerId: DEALER_ID,
      quantity: ['Quantity', 'Qty'],
      unitCost: ['unit cost'],
      neededBy: ['ORDER needed by', 'Needed by'],
      estShipDate: ['Estimated Ship Date'],
      actualShipDate: ['Actual Ship Date'],
      tracking: ['Tracking Number', 'Tracking#'],
      dateDelivered: ['Date Delivered'],
      comments: ['Comments/updates', 'Comments'],
      salesRep: ['Sales Rep'],
      status: ['Order Status', 'Status'],
      office: ['Going to office', 'To office', 'Office', 'Held at office']
    },
    ['dealerId', 'quantity', 'status']
  );
  if (t.error || !t.get) return { rows: [], error: t.error };
  const get = t.get;
  const yes = (v?: string) => /^(y|yes|true|1|office)$/i.test((v ?? '').trim());
  const rows = t.body
    .map(r => {
      const dealerId = get(r, 'dealerId') ?? '';
      return {
        orderDate: toISODate(get(r, 'orderDate')),
        po: get(r, 'po') ?? '',
        dealerName: get(r, 'dealerName') ?? '',
        dealerId,
        quantity: num(get(r, 'quantity')),
        unitCost: get(r, 'unitCost') ? num(get(r, 'unitCost')) : undefined,
        neededBy: toISODate(get(r, 'neededBy')) || undefined,
        estShipDate: toISODate(get(r, 'estShipDate')) || undefined,
        actualShipDate: toISODate(get(r, 'actualShipDate')) || undefined,
        tracking: get(r, 'tracking') || undefined,
        dateDelivered: toISODate(get(r, 'dateDelivered')) || undefined,
        comments: get(r, 'comments') || undefined,
        salesRep: get(r, 'salesRep') || undefined,
        status: get(r, 'status') ?? '',
        toOffice: yes(get(r, 'office')) || (!!heldGroupId && dealerId === heldGroupId)
      } as OrderRow;
    })
    .filter(o => o.dealerId && o.quantity > 0);
  return { rows, error: '' };
}

export function readContracts(text: string): { rows: ContractRow[]; error: string } {
  const t = table(
    text,
    {
      nameNumber: ['Name_Number', 'Name Number'],
      contractNumber: ['Contract Number', 'Contract_Number', 'Contract #'],
      effectiveDate: ['Effective_Date', 'Effective Date'],
      disbursement: ['Disbursement_Amount', 'Disbursement Amount'],
      dealerId: DEALER_ID
    },
    ['contractNumber', 'effectiveDate', 'dealerId']
  );
  if (t.error || !t.get) return { rows: [], error: t.error };
  const get = t.get;
  // The Product column is ignored on purpose.
  const rows = t.body
    .map(r => ({
      nameNumber: get(r, 'nameNumber') ?? '',
      contractNumber: get(r, 'contractNumber') ?? '',
      effectiveDate: toISODate(get(r, 'effectiveDate')),
      disbursement: get(r, 'disbursement') ? num(get(r, 'disbursement')) : undefined,
      dealerId: get(r, 'dealerId') ?? ''
    }))
    .filter(c => c.contractNumber && c.effectiveDate && c.dealerId);
  return { rows, error: '' };
}

export function readDispatches(text: string): { rows: DispatchRow[]; error: string } {
  const t = table(
    text,
    {
      timestamp: ['Timestamp'],
      salesRep: ['Sales Rep'],
      dealershipName: ['Dealership Name'],
      quantity: ['Quantity'],
      tracking: ['Tracking#', 'Tracking Number'],
      dealerId: ['Dealership ID', 'Dealer ID'],
      purpose: ['Purpose'],
      entryNumber: ['Entry Number']
    },
    ['timestamp', 'quantity', 'dealerId']
  );
  if (t.error || !t.get) return { rows: [], error: t.error };
  const get = t.get;
  // "Product" and "New Dealership Name" are ignored: the Dealership ID links rows to the store.
  const rows = t.body
    .map(r => ({
      timestamp: toISODate(get(r, 'timestamp')),
      salesRep: get(r, 'salesRep') || undefined,
      dealershipName: get(r, 'dealershipName') ?? '',
      quantity: num(get(r, 'quantity')),
      tracking: get(r, 'tracking') || undefined,
      dealerId: get(r, 'dealerId') ?? '',
      purpose: get(r, 'purpose') || undefined,
      entryNumber: get(r, 'entryNumber') || undefined
    }))
    .filter(d => d.timestamp && d.dealerId && d.quantity > 0);
  return { rows, error: '' };
}
