// Keyfetch keychains on a dealership's record: what's left, how fast it goes,
// orders on the way, when to order, and the two switches for how it's tracked.

import React, { useState } from 'react';
import { Boxes, ClipboardCheck, Info, Truck } from 'lucide-react';
import type { Dealership, User } from '../../types/crm';
import { Btn, Panel, Switch } from '../../components/ui/kit';
import { useInventory } from './context';
import { addCount, setSetup } from './store';
import { longDate, shortDate, StockBadge, weeksText, WeeklyBars } from './ui';

const CAN_EDIT = ['inventory_manager', 'owner', 'executive', 'admin'];

export const KeyfetchCard: React.FC<{ dealership: Dealership; currentUser: User }> = ({ dealership: d, currentUser }) => {
  const inv = useInventory();
  const [count, setCount] = useState('');
  const [saved, setSaved] = useState('');
  if (!inv) return null;
  const setup = inv.data.setups[d.id];
  const stock = inv.stocks.get(d.id);
  const hasKeyfetch = d.signedProducts?.includes('prod_3');
  const canEdit = CAN_EDIT.includes(currentUser.role);
  const inHeldGroup = !!inv.data.heldGroupId && d.groupId === inv.data.heldGroupId;
  const me = `${currentUser.firstName} ${currentUser.lastName}`;

  if (!setup) {
    if (!hasKeyfetch) return null;
    return (
      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <Boxes className="h-5 w-5 text-blue-600" /> Keyfetch keychains
          </div>
          {canEdit && (
            <Btn size="sm" onClick={() => setSetup(d.id, { dealerId: d.id, everyContract: true, supply: inHeldGroup ? 'office' : 'direct', openingStock: 0 })}>
              Track stock here
            </Btn>
          )}
        </div>
        <p className="mt-1 text-[14px] text-slate-600">Stock isn't tracked for this dealership yet.{canEdit ? '' : ' Ask the inventory manager to turn it on.'}</p>
      </Panel>
    );
  }

  const left = stock?.onHand === null || stock === undefined ? null : Math.max(0, stock.onHand);

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <Boxes className="h-5 w-5 text-blue-600" /> Keyfetch keychains
        </div>
        {stock && <StockBadge status={stock.status} />}
      </div>

      {stock && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fig label={stock.estimated ? 'Left (estimate)' : 'Left on site'} value={left === null ? '—' : `${stock.estimated ? '≈' : ''}${left}`} />
            <Fig label="Used per week" value={stock.pace ? String(stock.pace) : '—'} />
            <Fig label={stock.supply === 'direct' && stock.onTheWayQty ? 'Weeks left (with orders)' : 'Weeks left'} value={weeksText(stock.weeksLeft)} />
            <Fig label={stock.supply === 'office' ? 'Supplied from' : 'Order by'} value={stock.supply === 'office' ? 'Our office' : stock.orderBy ? shortDate(stock.orderBy) : '—'} />
          </div>

          {stock.status !== 'ok' && stock.status !== 'needs_count' && stock.suggestedQty > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
              {stock.supply === 'office'
                ? `Send about ${stock.suggestedQty} from the office (enough for ${inv.data.rules.officeSendForWeeks} weeks).`
                : `Order about ${stock.suggestedQty} now. Factory orders take up to ${Math.round(inv.data.rules.leadWeeks / 4.3)} months to arrive.`}
            </p>
          )}
          {stock.status === 'out' && stock.onTheWayQty > 0 && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[14px] text-rose-900">Out of keychains now. {stock.onTheWayQty} are on the way.</p>}
          {stock.status === 'needs_count' && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[14px] text-amber-900">
              {stock.lastCount ? `Last counted ${longDate(stock.lastCount.date)}. ` : ''}Not every contract here uses a keychain, so stock comes from counts. Count what's on site at the next visit.
            </p>
          )}

          {stock.onTheWay.length > 0 && (
            <div className="mt-3">
              <div className="text-[13px] font-semibold text-slate-500">On the way</div>
              <ul className="mt-1 space-y-1">
                {stock.onTheWay.map(o => (
                  <li key={o.po} className="flex items-center gap-2 text-[14px] text-slate-800">
                    <Truck className="h-4 w-4 text-slate-400" />
                    {o.quantity} keychains · {o.status}
                    {o.eta ? ` · due about ${shortDate(o.eta)}` : ''} <span className="text-slate-500">({o.po})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {stock.basis === 'contracts' && (
            <div className="mt-4">
              <div className="mb-1 text-[13px] font-semibold text-slate-500">Contracts per week</div>
              <WeeklyBars weeks={stock.weekly} />
              {stock.drop && (
                <p className="mt-2 text-[14px] font-medium text-rose-700">
                  Contracts have dropped: {stock.drop.recent < 0.5 ? 'almost none' : `about ${stock.drop.recent} a week`} lately, usually {stock.drop.usual}. Worth a visit.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 space-y-0.5 text-[13px] text-slate-600">
            {stock.lastDelivery && (
              <div>
                Last {stock.lastDelivery.from === 'office' ? 'sent from the office' : 'delivery'}: {stock.lastDelivery.quantity} on {longDate(stock.lastDelivery.date)}
              </div>
            )}
            {stock.lastCount && (
              <div>
                Last count: {stock.lastCount.count} on {longDate(stock.lastCount.date)} by {stock.lastCount.byName.split(' ')[0] || 'someone'}
              </div>
            )}
            {stock.removed && (
              <div className="flex items-start gap-1">
                <Info className="mt-0.5 h-3.5 w-3.5" /> This week's contracts update removed {stock.removed} duplicate contract{stock.removed === 1 ? '' : 's'}, so the numbers moved slightly.
              </div>
            )}
          </div>
        </>
      )}

      {/* Stock count: anyone visiting can record one */}
      <form
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
        onSubmit={e => {
          e.preventDefault();
          const n = Number(count);
          if (!Number.isFinite(n) || n < 0 || count === '') return;
          const now = new Date();
          addCount({ dealerId: d.id, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, count: Math.round(n), byName: me });
          setCount('');
          setSaved('Count saved. Stock now starts from it.');
          window.setTimeout(() => setSaved(''), 3000);
        }}
      >
        <ClipboardCheck className="h-4 w-4 text-slate-500" />
        <label className="text-[14px] text-slate-700" htmlFor={`kf-count-${d.id}`}>
          Counted on site today:
        </label>
        <input
          id={`kf-count-${d.id}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={count}
          onChange={e => setCount(e.target.value)}
          placeholder="e.g. 42"
          className="min-h-[36px] w-24 rounded-lg border border-slate-300 bg-white px-2 text-[14px]"
        />
        <Btn size="sm" type="submit" disabled={count === ''}>
          Save count
        </Btn>
        {saved && <span className="text-[13px] font-medium text-emerald-700">{saved}</span>}
      </form>

      {/* How stock works here */}
      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[14px] text-slate-700">Every contract uses a keychain</span>
          {canEdit ? (
            <Switch
              label="Every contract uses a keychain"
              value={setup.everyContract ? 'yes' : 'no'}
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No, use counts' }
              ]}
              onChange={v => setSetup(d.id, { ...setup, everyContract: v === 'yes' })}
            />
          ) : (
            <span className="text-[14px] font-semibold text-slate-900">{setup.everyContract ? 'Yes' : 'No, tracked by counts'}</span>
          )}
        </div>
        {(inHeldGroup || setup.supply === 'office') && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[14px] text-slate-700">Supplied from</span>
            {canEdit ? (
              <Switch
                label="Supplied from"
                value={setup.supply}
                options={[
                  { value: 'office', label: 'Our office' },
                  { value: 'direct', label: 'Factory direct' }
                ]}
                onChange={v => setSetup(d.id, { ...setup, supply: v })}
              />
            ) : (
              <span className="text-[14px] font-semibold text-slate-900">{setup.supply === 'office' ? 'Our office' : 'Factory direct'}</span>
            )}
          </div>
        )}
        {canEdit && (
          <button type="button" onClick={() => setSetup(d.id, null)} className="cursor-pointer text-[13px] font-medium text-slate-500 hover:text-rose-700 hover:underline">
            Stop tracking Keyfetch stock here
          </button>
        )}
      </div>
    </Panel>
  );
};

const Fig: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-3 py-2">
    <div className="text-[12px] font-medium text-slate-500">{label}</div>
    <div className="text-[18px] font-extrabold text-slate-900">{value}</div>
  </div>
);
