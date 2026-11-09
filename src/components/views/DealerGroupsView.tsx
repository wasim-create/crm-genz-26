import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Layers, Phone } from 'lucide-react';
import { DealerGroup, Dealership, User } from '../../types/crm';
import { Badge, EmptyState, Page, PageHeader, Panel, SectionTitle, Toolbar } from '../ui/kit';
import { stageLabel, stageTone } from '../../utils/stages';
import { lastContactText, matches, plural } from '../../utils/format';
import { formatUSPhone } from '../../utils/territory';

interface DealerGroupsViewProps {
  groups: DealerGroup[];
  dealerships: Dealership[];
  users: User[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
}

const SIGNED = ['Signed', 'Client', 'Onboarding'];
const LIVE = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won'];

export const DealerGroupsView: React.FC<DealerGroupsViewProps> = ({ groups, dealerships, users, currentUser, onOpenDealership }) => {
  const isRep = ['new_rep', 'veteran_rep', 'team_lead'].includes(currentUser.role);
  const [q, setQ] = useState('');
  const [state, setState] = useState('all');
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState('name');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const list = groups
      .map(g => {
        const stores = dealerships.filter(d => d.groupId === g.id);
        return { g, stores, signed: stores.filter(s => SIGNED.includes(s.stage)).length, live: stores.filter(s => LIVE.includes(s.stage)).length, mineCount: stores.filter(s => s.assignedRepId === currentUser.id).length };
      })
      .filter(r => (state === 'all' || r.g.hqState === state) && (!mine || r.mineCount > 0) && (!open || r.signed < r.stores.length) && matches(q, r.g.name, r.g.hqCity, r.g.mainDecisionMaker, ...r.stores.map(s => s.dealershipName)));
    const cmp: Record<string, (a: (typeof list)[number], b: (typeof list)[number]) => number> = {
      name: (a, b) => a.g.name.localeCompare(b.g.name),
      stores: (a, b) => b.stores.length - a.stores.length,
      signed: (a, b) => b.signed / Math.max(1, b.stores.length) - a.signed / Math.max(1, a.stores.length),
      open: (a, b) => b.stores.length - b.signed - (a.stores.length - a.signed)
    };
    return list.sort(cmp[sort]);
  }, [groups, dealerships, state, mine, open, q, sort, currentUser.id]);

  useEffect(() => {
    if (!rows.some(r => r.g.id === selectedId)) setSelectedId(rows[0]?.g.id ?? null);
  }, [rows, selectedId]);
  const sel = rows.find(r => r.g.id === selectedId);
  const userName = (id?: string | null) => {
    const u = users.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : 'Unassigned';
  };

  return (
    <Page>
      <PageHeader
        icon={<Layers className="h-6 w-6" />}
        title="Dealer groups"
        subtitle="Groups that own several stores. When one store signs, its sister stores become warm leads; each store keeps its own rep and credit."
      />
      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search group, city, store or contact' }}
        filters={[{ id: 'state', allLabel: 'All states', value: state, onChange: setState, options: [...new Set(groups.map(g => g.hqState))].sort().map(s => ({ value: s, label: s })) }]}
        chips={[
          ...(isRep ? [{ id: 'mine', label: 'Has my stores', active: mine, onClick: () => setMine(m => !m) }] : []),
          { id: 'open', label: 'Stores still to sign', active: open, onClick: () => setOpen(o => !o) }
        ]}
        sort={{ value: sort, onChange: setSort, options: [{ value: 'name', label: 'Name (A–Z)' }, { value: 'stores', label: 'Most stores' }, { value: 'signed', label: 'Most signed' }, { value: 'open', label: 'Most left to sign' }] }}
        count={plural(rows.length, 'group')}
        onClear={() => {
          setQ('');
          setState('all');
          setMine(false);
          setOpen(false);
        }}
      />

      {rows.length === 0 ? (
        <EmptyState title="No groups match" hint="Try clearing a filter." />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            {rows.map(r => {
              const on = r.g.id === selectedId;
              return (
                <button
                  key={r.g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(r.g.id)}
                  className={`w-full cursor-pointer rounded-2xl border bg-white p-4 text-left transition ${on ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="text-[15px] font-bold text-slate-900">{r.g.name}</div>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    {r.g.hqCity}, {r.g.hqState} · {plural(r.stores.length, 'store')}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${r.signed} of ${r.stores.length} signed`}>
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.signed / Math.max(1, r.stores.length)) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[13px] text-slate-600">
                    {r.signed} of {r.stores.length} signed{r.live ? ` · ${r.live} in progress` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          {sel && (
            <Panel className="space-y-5 p-5 lg:col-span-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-extrabold text-slate-900">{sel.g.name}</h2>
                  <p className="text-[14px] text-slate-600">
                    Head office: {sel.g.hqAddress}, {sel.g.hqCity}, {sel.g.hqState} {sel.g.hqZip}
                  </p>
                  <p className="mt-1 text-[14px] text-slate-800">
                    Main contact: <strong>{sel.g.mainDecisionMaker}</strong>
                    {sel.g.mainPhone && (
                      <a href={`tel:${sel.g.mainPhone}`} className="ml-2 inline-flex items-center gap-1 text-blue-700 hover:underline">
                        <Phone className="h-4 w-4" />
                        {formatUSPhone(sel.g.mainPhone)}
                      </a>
                    )}
                  </p>
                  {sel.g.groupAccountOwnerId && <p className="text-[14px] text-slate-600">Group account owner: {userName(sel.g.groupAccountOwnerId)}</p>}
                </div>
                <Badge tone={sel.signed === sel.stores.length ? 'green' : 'neutral'}>
                  {sel.signed} of {sel.stores.length} signed
                </Badge>
              </div>
              {sel.g.notes && <p className="rounded-xl bg-slate-50 p-3 text-[14px] text-slate-700">{sel.g.notes}</p>}
              <div className="space-y-2">
                <SectionTitle>Stores</SectionTitle>
                {sel.stores.map(s => (
                  <button key={s.id} type="button" onClick={() => onOpenDealership(s)} className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left hover:border-blue-400">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-slate-900">{s.dealershipName}</span>
                        <Badge tone={stageTone(s.stage)}>{stageLabel(s.stage)}</Badge>
                        {s.isPlaceholder && <Badge tone="amber">Details needed</Badge>}
                      </div>
                      <div className="mt-0.5 text-[13px] text-slate-500">
                        {s.city}, {s.state} · {s.usedCarsOnLot} cars · {userName(s.assignedRepId)} · {lastContactText(s.lastTouchpointDate).toLowerCase()}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}
    </Page>
  );
};
