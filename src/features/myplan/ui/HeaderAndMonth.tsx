import React from 'react';
import { ChevronLeft, ChevronRight, ClipboardCheck, CircleHelp, Eye, Inbox, ListTodo, Plus, Settings, Star, WifiOff } from 'lucide-react';
import { User } from '../../../types/crm';
import { addDays, formatDayLong, parseISODate, startOfWeek, toISODate, weekDates } from '../engine/time';
import { isScheduled } from '../engine/schedule';
import { useMyPlanState } from '../data/store';
import { Button, Card, WORK_STYLE } from './primitives';
import { useMyPlan } from './context';
import { WorkType } from '../types';

export const Header: React.FC<{ viewers: User[]; onViewUser: (id: string) => void }> = ({ viewers, onViewUser }) => {
  const { view, setView, date, setDate, today, openSheet, basket, viewUser, user, readOnly } = useMyPlan();
  const state = useMyPlanState();
  const offline = state.simulateOffline || !state.online;
  const todo = state.actionPoints.filter(a => a.userId === viewUser.id && !a.done && a.dueDate && a.dueDate <= today).length;

  const shift = (dir: 1 | -1) => {
    if (view === 'day') setDate(addDays(date, dir));
    else if (view === 'week') setDate(addDays(startOfWeek(date), 7 * dir));
    else {
      const d = parseISODate(date);
      setDate(toISODate(new Date(d.getFullYear(), d.getMonth() + dir, 1)));
    }
  };

  const title =
    view === 'day'
      ? formatDayLong(date)
      : view === 'week'
        ? `Week of ${parseISODate(weekDates(date)[0]).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
        : parseISODate(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900">My Plan</h1>
          <button
            type="button"
            aria-label="Help: how My Plan works"
            title="How My Plan works"
            onClick={() => openSheet({ kind: 'walkthrough', start: view === 'week' ? 3 : 0 })}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-700"
          >
            <CircleHelp className="h-6 w-6" />
          </button>
          {offline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-2 px-3 py-1 text-[13px] font-semibold text-onaccent">
              <WifiOff className="h-4 w-4" /> Offline — will sync when you’re back online
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewers.length > 0 && (
            <label className="flex items-center gap-2 text-[15px] font-medium text-slate-700">
              <Eye className="h-5 w-5 text-slate-500" />
              <select
                aria-label="Whose plan to view"
                className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-3 text-[16px]"
                value={viewUser.id}
                onChange={e => onViewUser(e.target.value)}
              >
                <option value={user.id}>My own plan</option>
                {viewers.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.firstName} {v.lastName} ({v.region})
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button variant="secondary" aria-label="To do" onClick={() => openSheet({ kind: 'todo' })} icon={<ListTodo className="h-5 w-5" />}>
            <span className="hidden sm:inline">To do</span>{todo ? <span className="ml-1 rounded-full bg-danger px-2 text-[13px] text-onaccent">{todo}</span> : null}
          </Button>
          <Button variant="secondary" aria-label="Basket" onClick={() => openSheet({ kind: 'basket' })} icon={<Inbox className="h-5 w-5" />}>
            <span className="hidden sm:inline">Basket</span> <span className="ml-1 rounded-full bg-slate-100 px-2 text-[13px]">{basket.length}</span>
          </Button>
          {!readOnly && <Button variant="ghost" aria-label="My Plan settings" onClick={() => openSheet({ kind: 'settings' })} icon={<Settings className="h-5 w-5" />} />}
        </div>
      </div>

      {readOnly && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-indigo-200 bg-indigo-50 p-3">
          <span className="text-[16px] font-semibold text-indigo-950">
            You’re viewing {viewUser.firstName}’s plan (read-only).
          </span>
          <Button
            variant="primary"
            icon={<Star className="h-5 w-5" />}
            onClick={() => openSheet({ kind: 'add', preset: { planLater: true, priorityFrom: `${user.firstName} ${user.lastName}`, nonce: Date.now() } })}
          >
            Suggest a priority for {viewUser.firstName}
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1" role="tablist" aria-label="Plan view">
        {(
          [
            ['day', 'Day'],
            ['week', 'Plan my week'],
            ['month', 'Month']
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => {
              // On Fri / Sat / Sun, "Plan my week" means next week.
              if (v === 'week' && date === today) {
                const dow = parseISODate(today).getDay();
                if (dow === 5 || dow === 6 || dow === 0) setDate(addDays(startOfWeek(today), 7));
              }
              setView(v);
            }}
            className={`min-h-[52px] rounded-xl text-[16px] font-bold transition ${view === v ? 'bg-white text-slate-900 shadow' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button variant="secondary" aria-label="Previous" onClick={() => shift(-1)} icon={<ChevronLeft className="h-6 w-6" />} />
        <div className="min-w-0 flex-1 text-center text-[17px] font-bold text-slate-900 sm:text-[19px]">
          <span className="hidden sm:inline">{title}</span>
          <span className="whitespace-nowrap text-[15px] sm:hidden">{view === 'day' ? parseISODate(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : title.replace('Week of ', 'Wk of ')}</span>
        </div>
        <Button variant="secondary" aria-label="Next" onClick={() => shift(1)} icon={<ChevronRight className="h-6 w-6" />} />
        <Button variant={date === today ? 'ghost' : 'soft'} onClick={() => setDate(today)}>
          Today
        </Button>
        {view === 'day' && !readOnly && date === today && viewUser.id === user.id && (
          <span className="hidden sm:block">
            <Button variant="secondary" onClick={() => openSheet({ kind: 'logpick' })} icon={<ClipboardCheck className="h-5 w-5" />}>
              Log a visit
            </Button>
          </span>
        )}
        {view === 'day' && !readOnly && date >= today && (
          <span className="hidden sm:block">
            <Button variant="primary" onClick={() => openSheet({ kind: 'add', preset: { date, nonce: Date.now() } })} icon={<Plus className="h-5 w-5" />}>
            <span className="hidden sm:inline">Add</span>
          </Button>
          </span>
        )}
      </div>
    </div>
  );
};

export const MonthView: React.FC = () => {
  const { date, today, daySlots, layout, setDate, setView, basket, slots, viewUser } = useMyPlan();
  const d = parseISODate(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const gridStart = startOfWeek(toISODate(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthKey = toISODate(first).slice(0, 7);
  const monthSlots = slots.filter(s => s.userId === viewUser.id && s.date?.startsWith(monthKey) && isScheduled(s));
  const visits = monthSlots.filter(s => s.how === 'in_person' && s.target.kind !== 'block');
  const doneCount = monthSlots.filter(s => s.status === 'done').length;
  const trips = cells.filter(c => c.startsWith(monthKey) && layout(c).warnings.some(w => w.code === 'out_of_town'));
  const order: WorkType[] = ['prospect', 'signup', 'client', 'group'];

  return (
    <div className="pb-16">
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        {[
          ['Planned visits', visits.length],
          ['Done so far', doneCount],
          ['Trip days', trips.length],
          ['In your basket', basket.length]
        ].map(([l, v]) => (
          <Card key={l as string} className="p-3">
            <div className="text-[14px] font-medium text-slate-500">{l}</div>
            <div className="text-[24px] font-extrabold text-slate-900">{v}</div>
          </Card>
        ))}
      </div>
      <Card className="p-2 sm:p-3">
        <div className="grid grid-cols-7 gap-1 text-center text-[13px] font-semibold text-slate-500">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => (
            <div key={x} className="py-1">
              {x}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map(c => {
            const inMonth = c.startsWith(monthKey);
            const items = daySlots(c).filter(isScheduled);
            const counts = order.map(w => items.filter(s => s.workType === w).length);
            const trip = layout(c).warnings.some(w => w.code === 'out_of_town');
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setDate(c);
                  setView('day');
                }}
                className={`flex min-h-[76px] flex-col items-start rounded-xl border p-1.5 text-left transition hover:border-blue-400 sm:min-h-[92px] ${
                  c === today ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
                } ${inMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}
                aria-label={`${formatDayLong(c)}: ${items.length} items`}
              >
                <span className={`text-[15px] font-bold ${c < today && inMonth ? 'text-slate-500' : ''}`}>{parseISODate(c).getDate()}</span>
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {order.map((w, i) =>
                    counts[i] ? (
                      <span key={w} className={`inline-flex items-center gap-0.5 rounded-full px-1 text-[12px] font-bold text-onaccent ${WORK_STYLE[w].dot}`}>
                        {counts[i]}
                      </span>
                    ) : null
                  )}
                </div>
                {trip && <span className="mt-auto rounded bg-rose-100 px-1 text-[11px] font-bold text-rose-800">Trip</span>}
              </button>
            );
          })}
        </div>
      </Card>
      <div className="mt-3 flex flex-wrap gap-4 text-[14px] text-slate-600">
        {order.map(w => (
          <span key={w} className="inline-flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${WORK_STYLE[w].dot}`} />
            {w === 'prospect' ? 'Prospect' : w === 'signup' ? 'Sign-up & Onboarding' : w === 'client' ? 'Client' : 'Dealer group'}
          </span>
        ))}
        <span>· Tap a day to open it</span>
      </div>
    </div>
  );
};
