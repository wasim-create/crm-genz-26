// The rep's own view of their flags, at the top of My Plan. Same facts the
// manager sees, worded for the rep, each with a way to fix it. Nudges from
// the manager show here too until the rep ticks them off.

import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Send } from 'lucide-react';
import type { Dealership, ManagerPriority } from '../../types/crm';
import { Btn, Panel } from '../../components/ui/kit';
import { formatRelative } from '../../utils/format';
import type { RepReport } from './signals';
import { FlagGlyph, flagColour } from './flagUi';

const HIDE_KEY = 'apexdrive_worth_a_look_hidden';
const todayKey = () => new Date().toDateString();

export const WorthALook: React.FC<{
  report: RepReport;
  nudges: ManagerPriority[];
  dealerships: Dealership[];
  onOpenDealership: (d: Dealership) => void;
  onPlanNext: (d: Dealership) => void;
  onAckNudge: (p: ManagerPriority) => void;
}> = ({ report, nudges, dealerships, onOpenDealership, onPlanNext, onAckNudge }) => {
  const [hiddenOn, setHiddenOn] = useState<string | null>(() => {
    try {
      return localStorage.getItem(HIDE_KEY);
    } catch {
      return null;
    }
  });
  const [expanded, setExpanded] = useState(false);
  // Rep-facing flags only (some are for the manager alone), most urgent first.
  const flags = report.flags.filter(f => f.repTitle);
  if (!flags.length && !nudges.length) return null;

  const hidden = hiddenOn === todayKey() && !nudges.length;
  const hide = () => {
    try {
      localStorage.setItem(HIDE_KEY, todayKey());
    } catch {
      /* ignore */
    }
    setHiddenOn(todayKey());
  };
  if (hidden) return null;

  const deal = (id?: string) => dealerships.find(d => d.id === id);
  const shown = expanded ? flags : flags.slice(0, 3);

  return (
    <div className="mx-auto mb-4 max-w-6xl">
      <Panel className="border-amber-200 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold text-slate-900">Worth a look</h2>
          {!nudges.length && (
            <button type="button" onClick={hide} className="cursor-pointer rounded-lg px-2 py-1 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              Hide for today
            </button>
          )}
        </div>

        {nudges.length > 0 && (
          <ul className="mt-2 space-y-2">
            {nudges.map(n => (
              <li key={n.id} className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 sm:flex-row sm:items-start">
                <div className="flex min-w-0 flex-1 items-start gap-2 text-[14px]">
                <Send className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-violet-900">
                    From {n.managerName.split(' ')[0]} · {formatRelative(n.createdAt).toLowerCase()}
                  </div>
                  <div className="text-slate-800">{n.title}</div>
                </div>
                </div>
                <div className="flex gap-1.5">
                  {deal(n.linkedDealershipId) && (
                    <Btn size="sm" onClick={() => onOpenDealership(deal(n.linkedDealershipId)!)}>
                      Open {deal(n.linkedDealershipId)!.dealershipName}
                    </Btn>
                  )}
                  <Btn size="sm" icon={<Check className="h-4 w-4" />} onClick={() => onAckNudge(n)}>
                    Got it
                  </Btn>
                </div>
              </li>
            ))}
          </ul>
        )}

        {flags.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100">
            {shown.map(f => {
              const deals = f.dealershipIds.map(deal).filter(Boolean) as Dealership[];
              const first = deals[0];
              return (
                <li key={f.id} className="flex flex-wrap items-start gap-2 py-2.5">
                  <span className={`mt-0.5 ${flagColour({ ...f, handled: undefined })}`}>
                    <FlagGlyph flag={f} />
                  </span>
                  <div className="min-w-0 flex-1 text-[14px] text-slate-800">
                    {f.repTitle}
                    {f.detail && f.id !== 'assist_waiting' && <div className="text-[13px] text-slate-500">{f.detail}</div>}
                  </div>
                  {first && f.id === 'no_next' && (
                    <Btn size="sm" onClick={() => onPlanNext(first)}>
                      Plan {deals.length > 1 ? 'the first one' : 'it'}
                    </Btn>
                  )}
                  {first && f.id !== 'no_next' && (
                    <Btn size="sm" onClick={() => onOpenDealership(first)}>
                      Open {first.dealershipName}
                    </Btn>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {flags.length > 3 && (
          <button type="button" onClick={() => setExpanded(e => !e)} className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-blue-700 hover:underline">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? 'Show fewer' : `Show all ${flags.length}`}
          </button>
        )}
        <p className="mt-2 text-[12px] text-slate-500">Your manager sees the same list on their team screen.</p>
      </Panel>
    </div>
  );
};
