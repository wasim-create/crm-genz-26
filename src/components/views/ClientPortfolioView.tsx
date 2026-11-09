import React, { useMemo, useState } from 'react';
import { Package, Plus, Sparkles, Users2 } from 'lucide-react';
import { Dealership, ProductCatalogItem, UpsellOpportunity, User } from '../../types/crm';
import { Badge, Btn, Dialog, EmptyState, Page, PageHeader, Panel, Stat, Toolbar, useSticky } from '../ui/kit';
import { daysSince, formatShortDay, lastContactText, matches, plural } from '../../utils/format';

interface ClientPortfolioViewProps {
  dealerships: Dealership[];
  catalog: ProductCatalogItem[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onLogKeyfetchTopup: (dealershipId: string, quantity: number, notes?: string) => void;
  onUpdateUpsell: (dealershipId: string, upsell: UpsellOpportunity) => void;
  onCreateUpsell: (dealershipId: string, productId: string, nextStep: string) => void;
  /** Add a client directly (without going through the prospect stages). */
  onAddClient?: () => void;
  allUsers?: User[];
}

const REP_ROLES = ['new_rep', 'veteran_rep', 'team_lead'];
const KEYFETCH = 'prod_3';
const TOPUP_DUE_DAYS = 60;
const QUIET_DAYS = 30;

const lastTopup = (d: Dealership) => [...(d.topups ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
const openUpsells = (d: Dealership) => (d.upsells ?? []).filter(u => u.stage !== 'Won' && u.stage !== 'Lost');
const atRisk = (d: Dealership) => (d.clientHealthScore ?? 100) < 70;
const topupDue = (d: Dealership) => (d.signedProducts ?? []).includes(KEYFETCH) && d.stage === 'Client' && (daysSince(lastTopup(d)?.date) ?? 999) >= TOPUP_DUE_DAYS;
const quiet = (d: Dealership) => (daysSince(d.lastTouchpointDate) ?? 999) >= QUIET_DAYS;

export const ClientPortfolioView: React.FC<ClientPortfolioViewProps> = ({ dealerships, catalog, currentUser, onOpenDealership, onLogKeyfetchTopup, onCreateUpsell, onAddClient, allUsers = [] }) => {
  const isRep = REP_ROLES.includes(currentUser.role);
  const key = `clients_${currentUser.id}`;
  const repName = (id?: string | null) => {
    const u = allUsers.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };
  const productName = (id: string) => catalog.find(p => p.id === id)?.name ?? id;

  const [q, setQ] = useState('');
  const [rep, setRep] = useSticky(`${key}_rep`, isRep ? currentUser.id : 'all');
  const [product, setProduct] = useState('all');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useSticky(`${key}_sort`, 'health');

  const [topupFor, setTopupFor] = useState<Dealership | null>(null);
  const [topupQty, setTopupQty] = useState(250);
  const [topupNotes, setTopupNotes] = useState('');
  const [upsellFor, setUpsellFor] = useState<Dealership | null>(null);
  const [upsellProductId, setUpsellProductId] = useState('');
  const [upsellNextStep, setUpsellNextStep] = useState('Show the sample kit to the GM');

  const all = useMemo(() => dealerships.filter(d => d.stage === 'Client' || d.stage === 'Onboarding'), [dealerships]);
  const mine = useMemo(() => (rep === 'all' ? all : all.filter(d => d.assignedRepId === rep || d.originRepId === rep)), [all, rep]);

  const TESTS: Record<string, (d: Dealership) => boolean> = {
    risk: atRisk,
    topup: topupDue,
    upsell: d => openUpsells(d).length > 0,
    quiet,
    onboarding: d => d.stage === 'Onboarding'
  };

  const rows = useMemo(() => {
    const list = mine.filter(d => {
      if (product !== 'all') {
        const [has, id] = product.split(':');
        const owns = (d.signedProducts ?? []).includes(id);
        if (has === 'has' ? !owns : owns) return false;
      }
      if (!matches(q, d.dealershipName, d.city, d.state, d.groupName, repName(d.assignedRepId))) return false;
      return Object.entries(chips).every(([id, on]) => !on || TESTS[id](d));
    });
    const cmp: Record<string, (a: Dealership, b: Dealership) => number> = {
      health: (a, b) => (a.clientHealthScore ?? 100) - (b.clientHealthScore ?? 100),
      stale: (a, b) => (a.lastTouchpointDate ?? '').localeCompare(b.lastTouchpointDate ?? ''),
      topup: (a, b) => (lastTopup(a)?.date ?? '').localeCompare(lastTopup(b)?.date ?? ''),
      lot: (a, b) => b.usedCarsOnLot - a.usedCarsOnLot,
      name: (a, b) => a.dealershipName.localeCompare(b.dealershipName)
    };
    return [...list].sort((a, b) => cmp[sort](a, b) || a.dealershipName.localeCompare(b.dealershipName));
  }, [mine, product, q, chips, sort]);

  const toggle = (id: string) => setChips(c => ({ ...c, [id]: !c[id] }));
  const only = (id: string) => setChips(c => (c[id] && Object.values(c).filter(Boolean).length === 1 ? {} : { [id]: true }));
  const clear = () => {
    setQ('');
    setRep(isRep ? currentUser.id : 'all');
    setProduct('all');
    setChips({});
  };
  const n = (id: string) => mine.filter(TESTS[id]).length;

  const team = allUsers.filter(u => REP_ROLES.includes(u.role) && u.active !== false && (currentUser.role !== 'manager' || u.managerId === currentUser.id));
  const products = catalog.filter(p => p.isActive);

  return (
    <Page>
      <PageHeader
        icon={<Users2 className="h-6 w-6" />}
        title="Clients"
        subtitle="Signed dealerships: what they have, when they last topped up, and what else they could take."
        actions={
          onAddClient && (
            <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={onAddClient}>
              Add client
            </Btn>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={rep === currentUser.id ? 'My clients' : 'Clients'} value={mine.length} hint={`${n('onboarding')} onboarding`} active={!Object.values(chips).some(Boolean)} onClick={() => setChips({})} />
        <Stat label="At risk" value={n('risk')} hint="Health below 70" tone={n('risk') ? 'red' : 'neutral'} active={!!chips.risk} onClick={() => only('risk')} />
        <Stat label="Keyfetch top-up due" value={n('topup')} hint={`No top-up in ${TOPUP_DUE_DAYS}+ days`} tone={n('topup') ? 'amber' : 'neutral'} active={!!chips.topup} onClick={() => only('topup')} />
        <Stat label="Open upsells" value={mine.reduce((s, d) => s + openUpsells(d).length, 0)} hint={`At ${plural(n('upsell'), 'client')}`} tone="violet" active={!!chips.upsell} onClick={() => only('upsell')} />
      </div>

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search name, city, group or rep' }}
        filters={[
          {
            id: 'rep',
            allLabel: isRep ? 'Everyone’s clients' : 'All reps',
            defaultValue: isRep ? currentUser.id : 'all',
            value: rep,
            onChange: setRep,
            options: [...(isRep ? [{ value: currentUser.id, label: 'My clients' }] : []), ...team.filter(u => u.id !== currentUser.id).map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, count: all.filter(d => d.assignedRepId === u.id).length }))]
          },
          {
            id: 'product',
            allLabel: 'Any products',
            value: product,
            onChange: setProduct,
            options: [
              ...products.map(p => ({ value: `has:${p.id}`, label: `Has ${p.name}`, count: mine.filter(d => (d.signedProducts ?? []).includes(p.id)).length })),
              ...products.map(p => ({ value: `not:${p.id}`, label: `Doesn’t have ${p.name}`, count: mine.filter(d => !(d.signedProducts ?? []).includes(p.id)).length }))
            ]
          }
        ]}
        chips={[
          { id: 'risk', label: 'At risk', count: n('risk'), active: !!chips.risk, onClick: () => toggle('risk'), tone: 'attention' },
          { id: 'topup', label: 'Top-up due', count: n('topup'), active: !!chips.topup, onClick: () => toggle('topup') },
          { id: 'quiet', label: `No contact in ${QUIET_DAYS}+ days`, count: n('quiet'), active: !!chips.quiet, onClick: () => toggle('quiet') },
          { id: 'upsell', label: 'Open upsell', count: n('upsell'), active: !!chips.upsell, onClick: () => toggle('upsell') },
          { id: 'onboarding', label: 'Onboarding', count: n('onboarding'), active: !!chips.onboarding, onClick: () => toggle('onboarding') }
        ]}
        sort={{
          value: sort,
          onChange: setSort,
          options: [
            { value: 'health', label: 'Health (lowest first)' },
            { value: 'stale', label: 'Last contact (oldest first)' },
            { value: 'topup', label: 'Last top-up (oldest first)' },
            { value: 'lot', label: 'Lot size (largest first)' },
            { value: 'name', label: 'Name (A–Z)' }
          ]
        }}
        count={`${plural(rows.length, 'client')}${rows.length !== mine.length ? ` of ${mine.length}` : ''}`}
        onClear={clear}
      />

      {rows.length === 0 ? (
        <EmptyState title="No clients match" hint="Try clearing a filter." />
      ) : (
        <div className="space-y-2">
          {rows.map(d => {
            const tp = lastTopup(d);
            const ups = openUpsells(d);
            const hasKeyfetch = (d.signedProducts ?? []).includes(KEYFETCH);
            const canUpsell = products.some(p => !(d.signedProducts ?? []).includes(p.id));
            const health = d.clientHealthScore ?? 100;
            return (
              <Panel key={d.id} interactive onClick={() => onOpenDealership(d)} className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(220px,1.4fr)_2fr_1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[16px] font-bold text-slate-900">{d.dealershipName}</span>
                    {d.stage === 'Onboarding' && <Badge tone="teal">Onboarding</Badge>}
                    {atRisk(d) && <Badge tone="red">At risk · {health}</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    {d.city}, {d.state}
                    {d.groupName ? ` · ${d.groupName}` : ''}
                    {rep !== currentUser.id ? ` · ${repName(d.assignedRepId)}` : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(d.signedProducts ?? []).map(p => (
                    <Badge key={p} tone="green">
                      {productName(p)}
                    </Badge>
                  ))}
                  {ups.map(u => (
                    <Badge key={u.id} tone="violet" title={`Next: ${u.nextStep}`}>
                      <Sparkles className="h-3 w-3" />
                      {u.productName} · {u.stage.toLowerCase()}
                    </Badge>
                  ))}
                </div>
                <div className="text-[13px] text-slate-600">
                  <div>{lastContactText(d.lastTouchpointDate)}</div>
                  {hasKeyfetch && (
                    <div className={topupDue(d) ? 'font-semibold text-amber-700' : ''}>
                      <Package className="mr-1 inline h-3.5 w-3.5" />
                      {tp ? `Top-up ${tp.quantity} on ${formatShortDay(tp.date)}` : 'No top-ups yet'}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end" onClick={e => e.stopPropagation()}>
                  {hasKeyfetch && (
                    <Btn
                      size="sm"
                      onClick={() => {
                        setTopupFor(d);
                        setTopupQty(tp?.quantity ?? 250);
                        setTopupNotes('');
                      }}
                    >
                      Log top-up
                    </Btn>
                  )}
                  {canUpsell && (
                    <Btn
                      size="sm"
                      onClick={() => {
                        setUpsellFor(d);
                        setUpsellProductId(products.find(p => !(d.signedProducts ?? []).includes(p.id))?.id ?? '');
                      }}
                    >
                      Pitch a product
                    </Btn>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {topupFor && (
        <Dialog title={`Log a Keyfetch top-up — ${topupFor.dealershipName}`} onClose={() => setTopupFor(null)}>
          <label className="block text-[14px] font-semibold text-slate-800">
            How many units?
            <div className="mt-2 flex flex-wrap gap-2">
              {[100, 150, 200, 250, 300].map(qty => (
                <button
                  key={qty}
                  type="button"
                  onClick={() => setTopupQty(qty)}
                  className={`min-h-[40px] cursor-pointer rounded-xl border-2 px-3 text-[14px] font-semibold ${topupQty === qty ? 'border-blue-600 bg-brand text-onaccent' : 'border-slate-200 bg-white'}`}
                >
                  {qty}
                </button>
              ))}
              <input type="number" min={1} aria-label="Other quantity" value={topupQty} onChange={e => setTopupQty(parseInt(e.target.value, 10) || 0)} className="min-h-[40px] w-24 rounded-xl border border-slate-300 px-3 text-[14px]" />
            </div>
          </label>
          <label className="block text-[14px] font-semibold text-slate-800">
            Note (optional)
            <input value={topupNotes} onChange={e => setTopupNotes(e.target.value)} placeholder="e.g. Delivered to the service desk" className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-[14px] font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setTopupFor(null)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={topupQty <= 0}
              onClick={() => {
                onLogKeyfetchTopup(topupFor.id, topupQty, topupNotes || undefined);
                setTopupFor(null);
              }}
            >
              Save top-up
            </Btn>
          </div>
        </Dialog>
      )}

      {upsellFor && (
        <Dialog title={`Pitch a product — ${upsellFor.dealershipName}`} onClose={() => setUpsellFor(null)}>
          <label className="block text-[14px] font-semibold text-slate-800">
            Product
            <select value={upsellProductId} onChange={e => setUpsellProductId(e.target.value)} className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-normal">
              {products
                .filter(p => !(upsellFor.signedProducts ?? []).includes(p.id))
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isNewLaunch ? ' (new)' : ''}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-[14px] font-semibold text-slate-800">
            Next step
            <input value={upsellNextStep} onChange={e => setUpsellNextStep(e.target.value)} className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-[14px] font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setUpsellFor(null)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={!upsellProductId}
              onClick={() => {
                onCreateUpsell(upsellFor.id, upsellProductId, upsellNextStep);
                setUpsellFor(null);
              }}
            >
              Add upsell
            </Btn>
          </div>
        </Dialog>
      )}
    </Page>
  );
};
