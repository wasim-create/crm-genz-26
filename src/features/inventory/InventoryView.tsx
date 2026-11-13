// Keyfetch stock: every dealership with Keyfetch, most urgent first; the stock
// we hold at the office for one group; where the numbers come from (the three
// sheets, uploaded as CSV for now); and the rules.

import React, { useMemo, useRef, useState } from 'react';
import { Boxes, Building2, FileUp, RotateCcw, Settings2, Truck, Warehouse } from 'lucide-react';
import type { DealerGroup, Dealership, User } from '../../types/crm';
import { Badge, Btn, Dialog, EmptyState, Page, PageHeader, Panel, Stat, Toolbar, useSticky } from '../../components/ui/kit';
import { matches, plural } from '../../utils/format';
import { useInventory } from './context';
import { readContracts, readDispatches, readOrders } from './csv';
import { DEFAULT_STOCK_RULES, STATUS_LABEL, STATUS_RANK, uniqueContracts } from './stock';
import { clearUpload, lastSaveError, resetStockRules, setStockRules, uploadContracts, uploadDispatches, uploadOrders } from './store';
import type { ImportInfo, StockRules, StockStatus } from './types';
import { longDate, shortDate, StockBadge, weeksText } from './ui';

type Sort = 'urgent' | 'weeks' | 'orderBy' | 'name';
const CAN_EDIT = ['inventory_manager', 'owner', 'executive', 'admin'];

export const InventoryView: React.FC<{
  dealerships: Dealership[];
  groups: DealerGroup[];
  users: User[];
  currentUser: User;
  onOpenDealership: (d: Dealership) => void;
}> = ({ dealerships, groups, users, currentUser, onOpenDealership }) => {
  const inv = useInventory();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | StockStatus>('all');
  const [rep, setRep] = useState('all');
  const [supply, setSupply] = useState<'all' | 'direct' | 'office'>('all');
  const [sort, setSort] = useSticky<Sort>('inventory_sort', 'urgent');
  const [dialog, setDialog] = useState<null | 'data' | 'rules'>(null);
  const canEdit = CAN_EDIT.includes(currentUser.role);
  const isRep = currentUser.role === 'new_rep' || currentUser.role === 'veteran_rep';

  const rows = useMemo(() => {
    if (!inv) return [];
    return [...inv.stocks.values()]
      .map(s => ({ s, d: dealerships.find(x => x.id === s.dealerId) }))
      .filter((x): x is { s: typeof x.s; d: Dealership } => !!x.d && (!isRep || x.d.assignedRepId === currentUser.id));
  }, [inv, dealerships, isRep, currentUser.id]);

  if (!inv) return null;
  const repName = (id: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Unassigned';
  };

  const list = rows
    .filter(
      ({ s, d }) =>
        (status === 'all' || s.status === status) &&
        (rep === 'all' || d.assignedRepId === rep) &&
        (supply === 'all' || s.supply === supply) &&
        matches(q, d.dealershipName, d.city, d.state, repName(d.assignedRepId))
    )
    .sort((a, b) => {
      if (sort === 'name') return a.d.dealershipName.localeCompare(b.d.dealershipName);
      if (sort === 'weeks') return (a.s.weeksLeft ?? 999) - (b.s.weeksLeft ?? 999);
      if (sort === 'orderBy') return (a.s.orderBy ?? '9999').localeCompare(b.s.orderBy ?? '9999');
      return STATUS_RANK[a.s.status] - STATUS_RANK[b.s.status] || (a.s.weeksLeft ?? 999) - (b.s.weeksLeft ?? 999);
    });

  const count = (st: StockStatus) => rows.filter(r => r.s.status === st).length;
  const reps = [...new Set(rows.map(r => r.d.assignedRepId).filter(Boolean))] as string[];
  const office = inv.office;
  const group = groups.find(g => g.id === office?.groupId);
  const uploadedAny = Object.values(inv.data.imports).some(i => i?.source === 'upload');

  return (
    <Page>
      <PageHeader
        icon={<Boxes className="h-6 w-6" />}
        title="Keyfetch stock"
        subtitle={`Keychains left at each dealership, orders on the way, and when to order. Factory orders take up to ${Math.round(inv.data.rules.leadWeeks / 4.3)} months, so dealerships are flagged while there's still time.`}
        actions={
          <>
            <Btn icon={<FileUp className="h-4 w-4" />} onClick={() => setDialog('data')}>
              Sheets {uploadedAny ? '(uploaded)' : '(demo)'}
            </Btn>
            <Btn variant="ghost" icon={<Settings2 className="h-4 w-4" />} onClick={() => setDialog('rules')}>
              Rules
            </Btn>
          </>
        }
      />

      {office && !isRep && (
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-500">
                <Warehouse className="h-4 w-4 text-blue-600" /> Held at our office
              </div>
              <h2 className="mt-0.5 text-[18px] font-extrabold text-slate-900">{group?.name ?? 'Group'}</h2>
            </div>
            <StockBadge status={office.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Fig label="At the office" value={String(Math.max(0, office.onHand))} />
            <Fig label="In their stores" value={String(office.inStores)} />
            <Fig label="Used per week (group)" value={String(office.pace)} />
            <Fig label="Weeks left (all of it)" value={weeksText(office.weeksLeft)} />
            <Fig label="Order from factory by" value={office.orderBy ? shortDate(office.orderBy) : '—'} />
          </div>
          <p className="mt-3 text-[14px] text-slate-700">
            {office.status === 'ok'
              ? `Enough for now. ${office.sentLast4Weeks} sent to stores in the last 4 weeks.`
              : `Order about ${office.suggestedQty} for the office by ${longDate(office.orderBy)}. The office and the stores have about ${weeksText(office.weeksLeft).toLowerCase()} between them, and a factory order takes up to ${inv.data.rules.leadWeeks} weeks.`}
            {office.onTheWay.length > 0 && ` On the way: ${office.onTheWay.map(o => `${o.quantity} (${o.status.toLowerCase()})`).join(', ')}.`}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {office.stores.map(id => {
              const d = dealerships.find(x => x.id === id);
              const s = inv.stocks.get(id);
              if (!d || !s) return null;
              return (
                <button key={id} type="button" onClick={() => onOpenDealership(d)} className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left hover:border-blue-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-slate-900">{d.dealershipName}</span>
                    {s.status !== 'ok' && <StockBadge status={s.status} />}
                  </div>
                  <div className="text-[13px] text-slate-600">
                    {Math.max(0, s.onHand ?? 0)} left · {s.pace}/week · {weeksText(s.weeksLeft).toLowerCase()}
                    {s.status === 'send' ? ` · send ${s.suggestedQty}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['out', 'order_now', 'order_soon', 'send', 'needs_count'] as StockStatus[]).map(st => (
          <Stat key={st} label={STATUS_LABEL[st]} value={count(st)} tone={st === 'out' || st === 'order_now' ? 'red' : 'amber'} active={status === st} onClick={() => setStatus(status === st ? 'all' : st)} />
        ))}
      </div>

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search dealership, city or rep' }}
        filters={[
          { id: 'status', allLabel: 'Any status', value: status, onChange: v => setStatus(v as typeof status), options: (Object.keys(STATUS_LABEL) as StockStatus[]).map(st => ({ value: st, label: STATUS_LABEL[st], count: count(st) })) },
          ...(isRep ? [] : [{ id: 'rep', allLabel: 'All reps', value: rep, onChange: setRep, options: reps.map(id => ({ value: id, label: repName(id), count: rows.filter(r => r.d.assignedRepId === id).length })) }]),
          { id: 'supply', allLabel: 'Any supply', value: supply, onChange: v => setSupply(v as typeof supply), options: [{ value: 'direct', label: 'Factory direct' }, { value: 'office', label: 'From our office' }] }
        ]}
        sort={{ value: sort, onChange: v => setSort(v as Sort), options: [{ value: 'urgent', label: 'Most urgent' }, { value: 'weeks', label: 'Fewest weeks left' }, { value: 'orderBy', label: 'Order-by date' }, { value: 'name', label: 'Name (A–Z)' }] }}
        count={plural(list.length, 'dealership')}
        onClear={() => {
          setQ('');
          setStatus('all');
          setRep('all');
          setSupply('all');
        }}
      />

      {list.length === 0 ? (
        <EmptyState title={rows.length ? 'Nothing matches' : 'No Keyfetch dealerships yet'} hint={rows.length ? 'Try clearing the filters.' : 'Turn on stock tracking from a client’s record (Products tab).'} />
      ) : (
        <Panel className="overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead className="hidden border-b border-slate-200 bg-slate-50 text-[13px] text-slate-500 md:table-header-group">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Dealership</th>
                <th className="px-3 py-2.5 text-right font-semibold">Left</th>
                <th className="px-3 py-2.5 text-right font-semibold">Per week</th>
                <th className="px-3 py-2.5 font-semibold">Weeks left</th>
                <th className="px-3 py-2.5 font-semibold">On the way</th>
                <th className="px-3 py-2.5 font-semibold">Order by</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.map(({ s, d }) => (
                <tr key={d.id} onClick={() => onOpenDealership(d)} className="cursor-pointer align-top hover:bg-slate-50 max-md:flex max-md:flex-wrap max-md:gap-x-4 max-md:gap-y-1 max-md:px-4 max-md:py-3">
                  <td className="px-4 py-3 max-md:w-full max-md:p-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{d.dealershipName}</span>
                      <span className="md:hidden">
                        <StockBadge status={s.status} />
                      </span>
                    </div>
                    <div className="text-[13px] text-slate-500">
                      {d.city}, {d.state} · {repName(d.assignedRepId)}
                      {s.supply === 'office' && ' · from our office'}
                      {s.basis === 'counts' && ' · by counts'}
                    </div>
                    {s.drop && <div className="text-[13px] font-medium text-rose-700">Contracts down: {s.drop.recent < 0.5 ? 'almost none' : `${s.drop.recent}/week`} lately, usually {s.drop.usual}</div>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-slate-900 max-md:p-0 max-md:text-left">
                    <span className="text-slate-500 md:hidden">Left </span>
                    {s.onHand === null ? '—' : `${s.estimated ? '≈' : ''}${Math.max(0, s.onHand)}`}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-700 max-md:p-0 max-md:text-left">
                    <span className="text-slate-500 md:hidden">Per week </span>
                    {s.pace || '—'}
                  </td>
                  <td className="px-3 py-3 text-slate-700 max-md:p-0">
                    <span className="text-slate-500 md:hidden">Weeks </span>
                    {weeksText(s.weeksLeft)}
                  </td>
                  <td className="px-3 py-3 text-slate-700 max-md:p-0">
                    {s.onTheWay.length ? (
                      <span className="inline-flex items-center gap-1">
                        <Truck className="h-4 w-4 text-slate-400" />
                        {s.onTheWayQty} · {s.onTheWay[0].status.toLowerCase()}
                        {s.onTheWay[0].eta ? `, ~${shortDate(s.onTheWay[0].eta)}` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400 max-md:hidden">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-slate-700 max-md:p-0">
                    {s.supply === 'direct' && s.orderBy ? (
                      <>
                        <span className="text-slate-500 md:hidden">Order by </span>
                        <span className={s.status === 'order_now' || s.status === 'out' ? 'font-semibold text-rose-700' : ''}>{shortDate(s.orderBy)}</span>
                      </>
                    ) : (
                      <span className="text-slate-400 max-md:hidden">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 max-md:hidden">
                    <StockBadge status={s.status} />
                    {s.suggestedQty > 0 && <div className="mt-1 text-[13px] text-slate-600">{s.supply === 'office' ? 'Send' : 'Order'} ~{s.suggestedQty}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {dialog === 'data' && <SheetsDialog canEdit={canEdit} dealerships={dealerships} onClose={() => setDialog(null)} />}
      {dialog === 'rules' && <RulesDialog canEdit={canEdit} onClose={() => setDialog(null)} />}
    </Page>
  );
};

const Fig: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2">
    <div className="text-[12px] font-medium text-slate-500">{label}</div>
    <div className="text-[18px] font-extrabold text-slate-900">{value}</div>
  </div>
);

// ───────────────────────── where the numbers come from ─────────────────────────

const SHEETS: { key: 'orders' | 'contracts' | 'dispatches'; title: string; hint: string }[] = [
  { key: 'orders', title: 'Order tracking sheet', hint: 'One row per factory order. Uses Dealer ID, Quantity, Order Status (In production, Shipped, Delivered) and the dates.' },
  { key: 'contracts', title: 'Contracts sheet (weekly)', hint: 'One row per contract. Uses Dealer ID, Contract Number and Effective_Date. Each upload replaces the last one.' },
  { key: 'dispatches', title: 'Group dispatches ("Form Responses 1")', hint: 'Keychains sent from our office to the group’s stores. Uses Dealership ID, Quantity and Timestamp.' }
];

const SheetsDialog: React.FC<{ canEdit: boolean; dealerships: Dealership[]; onClose: () => void }> = ({ canEdit, dealerships, onClose }) => {
  const inv = useInventory()!;
  const [msg, setMsg] = useState<Record<string, string>>({});
  const ids = new Set(dealerships.map(d => d.id));
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const onFile = async (key: 'orders' | 'contracts' | 'dispatches', file: File) => {
    const text = await file.text();
    const result = key === 'orders' ? readOrders(text, inv.data.heldGroupId) : key === 'contracts' ? readContracts(text) : readDispatches(text);
    if (result.error) {
      setMsg(m => ({ ...m, [key]: result.error }));
      return;
    }
    const rows = result.rows as { dealerId: string }[];
    const unmatched = [...new Set(rows.map(r => r.dealerId).filter(id => !ids.has(id) && id !== inv.data.heldGroupId))];
    const info: ImportInfo = { at: new Date().toISOString(), rows: rows.length, matched: rows.filter(r => ids.has(r.dealerId) || r.dealerId === inv.data.heldGroupId).length, unmatchedIds: unmatched.slice(0, 20), source: 'upload' };
    if (key === 'orders') uploadOrders(result.rows as never, info);
    else if (key === 'contracts') uploadContracts(result.rows as never, info, inv.data.imports.contracts?.source === 'upload' ? uniqueContracts(inv.data.contracts) : []);
    else uploadDispatches(result.rows as never, info);
    const err = lastSaveError();
    setMsg(m => ({ ...m, [key]: `${rows.length} rows read, ${info.matched} matched to dealerships.${unmatched.length ? ` ${unmatched.length} Dealer ID${unmatched.length === 1 ? '' : 's'} not found.` : ''}${err ? ` ${err}` : ''}` }));
  };

  return (
    <Dialog title="Where the numbers come from" onClose={onClose} wide>
      <p className="text-[14px] text-slate-600">
        For now the three Google Sheets come in as CSV files (in Google Sheets: File, Download, Comma-separated values). Once the app has a shared database it will read them straight from Google. Counting starts on <b>{longDate(inv.data.rules.trackFrom)}</b>.
      </p>
      <div className="space-y-3">
        {SHEETS.map(sh => {
          const info = inv.data.imports[sh.key];
          return (
            <div key={sh.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
                  <Building2 className="h-4 w-4 text-slate-500" /> {sh.title}
                </div>
                <Badge tone={info?.source === 'upload' ? 'blue' : 'neutral'}>{info?.source === 'upload' ? 'Uploaded' : 'Demo data'}</Badge>
              </div>
              <p className="mt-1 text-[13px] text-slate-600">{sh.hint}</p>
              {info && (
                <p className="mt-1 text-[13px] text-slate-700">
                  {info.rows.toLocaleString()} rows · updated {longDate(info.at)}
                  {info.removed ? ` · ${info.removed} removed since the last update` : ''}
                  {info.unmatchedIds.length ? ` · Dealer IDs not found: ${info.unmatchedIds.slice(0, 5).join(', ')}${info.unmatchedIds.length > 5 ? '…' : ''}` : ''}
                </p>
              )}
              {msg[sh.key] && <p className="mt-1 text-[13px] font-medium text-blue-700">{msg[sh.key]}</p>}
              {canEdit && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <input ref={el => {
                      inputs.current[sh.key] = el;
                    }} type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && onFile(sh.key, e.target.files[0])} />
                  <Btn size="sm" icon={<FileUp className="h-4 w-4" />} onClick={() => inputs.current[sh.key]?.click()}>
                    Upload CSV
                  </Btn>
                  {info?.source === 'upload' && (
                    <Btn size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={() => clearUpload(sh.key)}>
                      Use demo data
                    </Btn>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
};

// ───────────────────────── rules ─────────────────────────

const RulesDialog: React.FC<{ canEdit: boolean; onClose: () => void }> = ({ canEdit, onClose }) => {
  const inv = useInventory()!;
  const r = inv.data.rules;
  const row = (label: string, key: keyof Omit<StockRules, 'trackFrom'>, suffix: string, min = 1, max = 52) => (
    <label className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-[14px] text-slate-700">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          value={r[key]}
          disabled={!canEdit}
          onChange={e => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n)) setStockRules({ [key]: Math.max(min, Math.min(max, n)) } as Partial<StockRules>);
          }}
          className="min-h-[36px] w-20 rounded-lg border border-slate-300 bg-white px-2 text-[14px] font-semibold disabled:bg-slate-100"
        />
        <span className="w-14 text-[13px] text-slate-500">{suffix}</span>
      </span>
    </label>
  );
  return (
    <Dialog title="Stock rules" onClose={onClose} wide>
      <p className="text-[14px] text-slate-600">
        A dealership supplied by the factory shows <b>Order now</b> when its keychains (plus any on the way) won't last the factory wait plus the cushion, and <b>Order soon</b> a few weeks before that.
        {canEdit ? '' : ' Only the inventory manager, an owner or an admin can change these.'}
      </p>
      <div>
        <label className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5">
          <span className="text-[14px] text-slate-700">Start counting from</span>
          <input type="date" value={r.trackFrom} disabled={!canEdit} onChange={e => e.target.value && setStockRules({ trackFrom: e.target.value })} className="min-h-[36px] rounded-lg border border-slate-300 bg-white px-2 text-[14px] disabled:bg-slate-100" />
        </label>
        {row('Factory wait (order to delivery)', 'leadWeeks', 'weeks')}
        {row('Cushion on top', 'bufferWeeks', 'weeks', 0)}
        {row('"Order soon" below', 'planAheadWeeks', 'weeks')}
        {row('Suggested order: enough for', 'orderForWeeks', 'weeks')}
        {row('Pace: average over the last', 'paceWeeks', 'weeks')}
        {row('Office stores: send more below', 'officeSendWeeks', 'weeks')}
        {row('…enough for', 'officeSendForWeeks', 'weeks')}
        {row('Stores tracked by counts: count every', 'countEveryWeeks', 'weeks')}
      </div>
      <div className="flex justify-between gap-2">
        {canEdit ? (
          <Btn variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={resetStockRules}>
            Back to defaults ({DEFAULT_STOCK_RULES.leadWeeks}-week wait)
          </Btn>
        ) : (
          <span />
        )}
        <Btn variant="primary" onClick={onClose}>
          Done
        </Btn>
      </div>
    </Dialog>
  );
};

