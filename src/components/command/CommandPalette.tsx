// One search box for the whole system: dealerships, people and pages.
// Arrow keys to move, Enter to open, Escape to close.

import React, { useEffect, useMemo, useState } from 'react';
import { useBackLayer } from '../../utils/backStack';
import { ArrowRight, Building2, CornerDownLeft, LayoutGrid, Search, User as UserIcon } from 'lucide-react';
import { Contact, Dealership } from '../../types/crm';
import { stageLabel } from '../../utils/stages';

export interface PaletteLink {
  id: string;
  label: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  dealerships: Dealership[];
  onSelectDealership: (dealership: Dealership) => void;
  contacts?: Contact[];
  pages?: PaletteLink[];
  onNavigate?: (id: string) => void;
}

type Hit = { kind: 'dealer'; d: Dealership } | { kind: 'person'; c: Contact; d: Dealership } | { kind: 'page'; p: PaletteLink };

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, dealerships, onSelectDealership, contacts = [], pages = [], onNavigate }) => {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setQ('');
      setActive(0);
    }
  }, [isOpen]);

  const hits: Hit[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pages.slice(0, 6).map(p => ({ kind: 'page' as const, p }));
    const byId = new Map(dealerships.map(d => [d.id, d]));
    const dealers = dealerships
      .filter(d => [d.dealershipName, d.city, d.state, d.zipCode, d.groupName].some(f => (f ?? '').toLowerCase().includes(s)))
      .sort((a, b) => Number(!a.dealershipName.toLowerCase().startsWith(s)) - Number(!b.dealershipName.toLowerCase().startsWith(s)))
      .slice(0, 6)
      .map(d => ({ kind: 'dealer' as const, d }));
    const people = contacts
      .filter(c => `${c.firstName} ${c.lastName}`.toLowerCase().includes(s) || (c.jobTitle ?? '').toLowerCase().includes(s))
      .map(c => ({ c, d: byId.get(c.dealershipId) }))
      .filter((x): x is { c: Contact; d: Dealership } => !!x.d)
      .slice(0, 4)
      .map(x => ({ kind: 'person' as const, ...x }));
    const pageHits = pages.filter(p => p.label.toLowerCase().includes(s)).map(p => ({ kind: 'page' as const, p }));
    return [...dealers, ...people, ...pageHits];
  }, [q, dealerships, contacts, pages]);

  useEffect(() => setActive(0), [q]);

  const open = (h?: Hit) => {
    if (!h) return;
    if (h.kind === 'page') onNavigate?.(h.p.id);
    else onSelectDealership(h.d);
    onClose();
  };

  useBackLayer(isOpen, onClose);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim/50 p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search" onClick={onClose}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive(a => Math.min(hits.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive(a => Math.max(0, a - 1));
              } else if (e.key === 'Enter') open(hits[active]);
              else if (e.key === 'Escape') onClose();
            }}
            placeholder="Dealership, city, ZIP, group, person or page"
            aria-label="Search"
            className="min-h-[56px] w-full text-[16px] text-slate-900 placeholder-slate-400 focus:outline-hidden"
          />
          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 text-[12px] text-slate-500">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!q.trim() && <div className="px-3 pb-1 pt-2 text-[12px] font-semibold text-slate-500">Go to</div>}
          {q.trim() && hits.length === 0 && <div className="p-6 text-center text-[14px] text-slate-500">Nothing matches “{q}”.</div>}
          {hits.map((h, i) => {
            const on = i === active;
            const base = `flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? 'bg-blue-50' : 'hover:bg-slate-50'}`;
            return (
              <button key={h.kind === 'dealer' ? h.d.id : h.kind === 'person' ? h.c.id : h.p.id} type="button" className={base} onMouseEnter={() => setActive(i)} onClick={() => open(h)}>
                {h.kind === 'dealer' && <Building2 className="h-5 w-5 shrink-0 text-slate-400" />}
                {h.kind === 'person' && <UserIcon className="h-5 w-5 shrink-0 text-slate-400" />}
                {h.kind === 'page' && <LayoutGrid className="h-5 w-5 shrink-0 text-slate-400" />}
                <span className="min-w-0 flex-1">
                  {h.kind === 'dealer' && (
                    <>
                      <span className="block truncate text-[15px] font-semibold text-slate-900">{h.d.dealershipName}</span>
                      <span className="block truncate text-[13px] text-slate-500">
                        {h.d.city}, {h.d.state} · {stageLabel(h.d.stage)}
                        {h.d.groupName ? ` · ${h.d.groupName}` : ''}
                      </span>
                    </>
                  )}
                  {h.kind === 'person' && (
                    <>
                      <span className="block truncate text-[15px] font-semibold text-slate-900">
                        {h.c.firstName} {h.c.lastName}
                      </span>
                      <span className="block truncate text-[13px] text-slate-500">
                        {h.c.jobTitle} · {h.d.dealershipName}
                      </span>
                    </>
                  )}
                  {h.kind === 'page' && <span className="block text-[15px] font-semibold text-slate-900">{h.p.label}</span>}
                </span>
                {on ? <CornerDownLeft className="h-4 w-4 text-slate-400" /> : <ArrowRight className="h-4 w-4 text-slate-300" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
