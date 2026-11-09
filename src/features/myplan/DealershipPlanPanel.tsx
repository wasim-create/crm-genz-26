// Shown on every dealership card: what's planned in My Plan and the open
// action points for this dealership (tick them off here, in My Plan, or in
// Google Tasks — they stay in sync).

import React from 'react';
import { CalendarCheck, Inbox, ListTodo } from 'lucide-react';
import { Dealership, User } from '../../types/crm';
import { updateActionPoint, useMyPlanState } from './data/store';
import { HOW_LABEL } from './engine/tasks';
import { formatDayShort, todayISO } from './engine/time';

export const DealershipPlanPanel: React.FC<{ dealership: Dealership; user: User }> = ({ dealership, user }) => {
  const state = useMyPlanState();
  const today = todayISO();
  const relevant = (targetId: string, rooftops?: string[]) => targetId === dealership.id || (rooftops ?? []).includes(dealership.id);
  const upcoming = state.slots
    .filter(s => s.status === 'planned' && s.date && s.date >= today && relevant(s.target.id, s.target.rooftopIds))
    .sort((a, b) => (a.date! < b.date! ? -1 : 1));
  const inBasket = state.slots.some(s => s.status === 'basket' && s.userId === user.id && relevant(s.target.id));
  const aps = state.actionPoints.filter(a => a.dealershipId === dealership.id || a.dealershipName === dealership.dealershipName);
  const open = aps.filter(a => !a.done);
  if (upcoming.length === 0 && !inBasket && aps.length === 0) return null;

  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <CalendarCheck className="h-4 w-4 text-blue-700" /> My Plan
      </div>
      {upcoming.slice(0, 3).map(s => {
        const who = s.userId === user.id ? 'You' : 'Team';
        return (
          <div key={s.id} className="text-sm text-slate-800">
            <span className="font-semibold">{formatDayShort(s.date!)}</span> · {HOW_LABEL[s.how]} · {who}
            {s.locked ? ' · locked' : ''}
          </div>
        );
      })}
      {inBasket && (
        <div className="flex items-center gap-1.5 text-sm text-slate-700">
          <Inbox className="h-4 w-4" /> In your plan-later basket
        </div>
      )}
      {aps.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
            <ListTodo className="h-3.5 w-3.5" /> Action points ({open.length} open)
          </div>
          <div className="space-y-1">
            {aps.slice(0, 6).map(a => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-emerald-600"
                  checked={a.done}
                  disabled={a.userId !== user.id}
                  onChange={e => updateActionPoint(a.id, { done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : undefined })}
                />
                <span className={a.done ? 'text-slate-400 line-through' : 'text-slate-800'}>{a.title}</span>
                {a.dueDate && !a.done && <span className="ml-auto text-xs text-slate-500">{a.dueDate < today ? 'Overdue' : formatDayShort(a.dueDate)}</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
