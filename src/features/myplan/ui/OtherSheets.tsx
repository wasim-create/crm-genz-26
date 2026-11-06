import React, { useEffect, useState } from 'react';
import { BellRing, CalendarRange, CheckCircle2, Inbox, ListTodo, Plus, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { ActionPoint } from '../types';
import { DAY_NAMES, format12h, formatDayShort, startOfWeek, toISODate } from '../engine/time';
import {
  addActionPoints,
  getTasksConnector,
  removeActionPoint,
  scheduleTasksSync,
  setSimulateOffline,
  syncGoogleTasks,
  updateActionPoint,
  updateSettings,
  useMyPlanState
} from '../data/store';
import { GoogleTask } from '../connectors/googleConnectors';
import { Button, Card, Checkbox, ChoiceCard, Segmented, Sheet } from './primitives';
import { useMyPlan } from './context';
import { newId } from './slotHelpers';

// ---------- To do (action points) ----------

export const TodoSheet: React.FC<{ onClose: () => void; dealershipId?: string }> = ({ onClose, dealershipId }) => {
  const { viewUser, today, readOnly, dealerships } = useMyPlan();
  const state = useMyPlanState();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [dealer, setDealer] = useState(dealershipId ?? '');
  const [showGoogle, setShowGoogle] = useState(false);
  const mine = state.actionPoints.filter(a => a.userId === viewUser.id && (!dealershipId || a.dealershipId === dealershipId));
  const open = mine.filter(a => !a.done);
  const groups: { label: string; items: ActionPoint[] }[] = [
    { label: 'Overdue', items: open.filter(a => a.dueDate && a.dueDate < today) },
    { label: 'Today', items: open.filter(a => a.dueDate === today) },
    { label: 'Coming up', items: open.filter(a => !a.dueDate || a.dueDate > today) },
    { label: 'Done', items: mine.filter(a => a.done).slice(0, 10) }
  ];

  const add = () => {
    const d = dealerships.find(x => x.id === dealer);
    const now = new Date().toISOString();
    addActionPoints(
      [
        {
          id: newId('ap'),
          userId: viewUser.id,
          title: title.trim(),
          dueDate: due || undefined,
          dealershipId: d?.id,
          dealershipName: d?.dealershipName,
          done: false,
          source: 'manual',
          createdAt: now,
          updatedAt: now
        }
      ],
      'Action point added — syncing to Google Tasks'
    );
    setTitle('');
  };

  const mineDealers = dealerships.filter(d => d.assignedRepId === viewUser.id);

  return (
    <Sheet title="To do" onClose={onClose} summary={<SyncBadge />}>
      {!readOnly && (
        <Card className="mb-5 space-y-3 p-4">
          <div className="text-[17px] font-bold text-slate-900">Add an action point</div>
          <input
            className="min-h-[52px] w-full rounded-xl border border-slate-300 px-3 text-[17px]"
            placeholder="e.g. Send brochure to Smith Motors"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[14px] font-medium text-slate-600">Due</span>
              <input type="date" className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]" value={due} onChange={e => setDue(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[14px] font-medium text-slate-600">Dealership (optional)</span>
              <select className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px]" value={dealer} onChange={e => setDealer(e.target.value)}>
                <option value="">None</option>
                {mineDealers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.dealershipName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button variant="primary" disabled={!title.trim()} onClick={add} icon={<Plus className="h-5 w-5" />}>
            Add
          </Button>
        </Card>
      )}

      {groups.map(g =>
        g.items.length === 0 ? null : (
          <div key={g.label} className="mb-5">
            <div className="mb-2 text-[15px] font-bold uppercase tracking-wide text-slate-500">
              {g.label} <span className="text-slate-400">({g.items.length})</span>
            </div>
            <Card className="divide-y divide-slate-100">
              {g.items.map(a => (
                <div key={a.id} className="flex min-h-[60px] items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Done: ${a.title}`}
                    className="h-6 w-6 accent-emerald-600"
                    checked={a.done}
                    disabled={readOnly}
                    onChange={e => updateActionPoint(a.id, { done: e.target.checked, doneAt: e.target.checked ? new Date().toISOString() : undefined }, e.target.checked ? 'Ticked off' : 'Re-opened')}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[16px] ${a.done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{a.title}</div>
                    <div className="text-[13px] text-slate-500">
                      {a.dueDate ? `Due ${formatDayShort(a.dueDate)}` : 'No due date'}
                      {a.googleTaskId ? ' · in Google Tasks' : ' · syncing…'}
                    </div>
                  </div>
                  {!readOnly && (
                    <button type="button" aria-label="Remove" onClick={() => removeActionPoint(a.id)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100">
                      <Trash2 className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </Card>
          </div>
        )
      )}
      {mine.length === 0 && <p className="text-[16px] text-slate-600">Nothing to do. 🎉</p>}

      <Button variant="ghost" className="mt-2" onClick={() => setShowGoogle(s => !s)}>
        {showGoogle ? 'Hide' : 'Show'} the Google Tasks side (demo)
      </Button>
      {showGoogle && <GoogleTasksDemo />}
    </Sheet>
  );
};

const SyncBadge: React.FC = () => {
  const state = useMyPlanState();
  if (state.simulateOffline || !state.online) return <span className="inline-flex items-center gap-1 text-slate-600"><WifiOff className="h-4 w-4" /> Offline — will sync later</span>;
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <RefreshCw className={`h-4 w-4 ${state.syncing ? 'animate-spin' : ''}`} /> Synced with Google Tasks (demo)
    </span>
  );
};

/** Shows the "remote" Google Tasks list so the team can tick items there and watch them sync back. */
const GoogleTasksDemo: React.FC = () => {
  const { viewUser } = useMyPlan();
  const state = useMyPlanState();
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const refresh = async () => setTasks(await getTasksConnector().list(viewUser.id));
  useEffect(() => {
    void refresh();
  }, [state.actionPoints, viewUser.id]);
  const toggle = async (t: GoogleTask) => {
    await getTasksConnector().upsert(viewUser.id, { ...t, status: t.status === 'completed' ? 'needsAction' : 'completed' });
    await syncGoogleTasks(viewUser.id);
    void refresh();
  };
  return (
    <Card className="mt-3 border-blue-200 p-4">
      <div className="mb-1 text-[16px] font-bold text-slate-900">Google Tasks — “My Tasks” (demo)</div>
      <p className="mb-3 text-[14px] text-slate-600">This is what the rep sees in Google Tasks on their phone. Tick one here and it ticks off in the CRM too.</p>
      <div className="space-y-1">
        {tasks.map(t => (
          <label key={t.id} className="flex min-h-[48px] items-center gap-3 rounded-lg px-2 hover:bg-slate-50">
            <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={t.status === 'completed'} onChange={() => toggle(t)} />
            <span className={`text-[15px] ${t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{t.title}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 text-[15px]" placeholder="New task in Google Tasks" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
        <Button
          variant="secondary"
          disabled={!newTitle.trim()}
          onClick={async () => {
            await getTasksConnector().upsert(viewUser.id, { title: newTitle.trim(), status: 'needsAction' });
            setNewTitle('');
            await syncGoogleTasks(viewUser.id);
            void refresh();
          }}
        >
          Add
        </Button>
      </div>
    </Card>
  );
};

// ---------- Basket ----------

export const BasketSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { basket, openSheet, readOnly, setView } = useMyPlan();
  return (
    <Sheet title="Plan-later basket" onClose={onClose} summary={`${basket.length} waiting`}>
      <p className="mb-4 text-[16px] text-slate-600">Dealerships you want to contact soon. Put each one on a day, or plan them all at once in “Plan my week”.</p>
      <Button
        variant="soft"
        size="lg"
        block
        className="mb-4"
        icon={<CalendarRange className="h-5 w-5" />}
        onClick={() => {
          setView('week');
          onClose();
        }}
      >
        Open Plan my week
      </Button>
      <div className="space-y-2">
        {basket.map(s => (
          <Card key={s.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-bold text-slate-900">{s.target.name}</div>
              <div className="text-[14px] text-slate-600">
                {s.target.city ? `${s.target.city}, ${s.target.state}` : ''}
                {s.basketNote ? ` · “${s.basketNote}”` : ''}
                {s.managerPriorityFrom ? ` · From ${s.managerPriorityFrom}` : ''}
              </div>
            </div>
            {!readOnly && (
              <Button variant="primary" onClick={() => openSheet({ kind: 'add', preset: { basketSlotId: s.id, nonce: Date.now() } })}>
                Put on a day
              </Button>
            )}
          </Card>
        ))}
        {basket.length === 0 && (
          <Card className="p-5 text-center text-[16px] text-slate-600">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-400" />
            Empty. Tap “Plan later” on any dealership to drop it here.
          </Card>
        )}
      </div>
      {!readOnly && (
        <Button variant="secondary" className="mt-4" icon={<Plus className="h-5 w-5" />} onClick={() => openSheet({ kind: 'add', preset: { planLater: true, nonce: Date.now() } })}>
          Add a dealership to the basket
        </Button>
      )}
    </Sheet>
  );
};

// ---------- Settings (incl. weekly reminder) ----------

export const SettingsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, settings, openSheet } = useMyPlan();
  const state = useMyPlanState();
  const set = (p: Partial<typeof settings>) => updateSettings(user.id, p);
  return (
    <Sheet title="My Plan settings" onClose={onClose}>
      <div className="space-y-5">
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
            <BellRing className="h-5 w-5" /> Weekly planning reminder
          </div>
          <Checkbox checked={settings.reminder.enabled} onChange={v => set({ reminder: { ...settings.reminder, enabled: v }, reminderAsked: true })} label="Remind me to plan my week" />
          {settings.reminder.enabled && (
            <>
              <div className="text-[15px] font-medium text-slate-700">Day</div>
              <Segmented
                ariaLabel="Reminder day"
                value={String(settings.reminder.day)}
                onChange={v => set({ reminder: { ...settings.reminder, day: Number(v) } })}
                options={[0, 1, 5, 6].map(d => ({ value: String(d), label: DAY_NAMES[d] }))}
              />
              <label className="flex items-center gap-3 text-[15px] font-medium text-slate-700">
                Time
                <input type="time" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]" value={settings.reminder.time} onChange={e => set({ reminder: { ...settings.reminder, time: e.target.value } })} />
                <span className="text-slate-500">{format12h(settings.reminder.time)}</span>
              </label>
              <Button variant="ghost" onClick={() => set({ reminder: { ...settings.reminder, lastShownWeek: undefined, forceShow: true } })}>
                Show the reminder now (demo)
              </Button>
            </>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <div className="text-[17px] font-bold text-slate-900">My working day</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-[15px] font-medium text-slate-700">
              I start at
              <input type="time" className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]" value={settings.dayStart} onChange={e => set({ dayStart: e.target.value })} />
            </label>
            <label className="block text-[15px] font-medium text-slate-700">
              I’d like to finish by
              <input type="time" className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]" value={settings.preferredFinish} onChange={e => set({ preferredFinish: e.target.value })} />
            </label>
          </div>
          <Checkbox checked={settings.lunch} onChange={v => set({ lunch: v })} label="Usual lunch break" hint="Applies to every day. Change a single day by tapping its lunch row." />
          {settings.lunch && (
            <div className="space-y-3 pl-2">
              <label className="flex flex-wrap items-center gap-3 text-[15px] font-medium text-slate-700">
                At
                <input type="time" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]" value={settings.lunchTime} onChange={e => set({ lunchTime: e.target.value })} />
              </label>
              <Segmented
                ariaLabel="Lunch length"
                value={String(settings.lunchDurationMin)}
                onChange={v => set({ lunchDurationMin: Number(v) })}
                options={[15, 30, 45, 60].map(m => ({ value: String(m), label: `${m} min` }))}
              />
              <Checkbox checked={settings.lunchFlexible} onChange={v => set({ lunchFlexible: v })} label="Flexible" hint="Fit lunch around visits, up to an hour either side" />
            </div>
          )}
          <p className="text-[14px] text-slate-500">Visits, calls and Meets are suggested between 10 AM and 4 PM (dealership time).</p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="text-[17px] font-bold text-slate-900">Display & help</div>
          <Checkbox checked={settings.biggerText} onChange={v => set({ biggerText: v })} label="Bigger text" />
          <Checkbox checked={settings.aiSuggestions} onChange={v => set({ aiSuggestions: v })} label="Show “Suggested for you”" hint="Turn off to plan completely by hand" />
          <Button variant="secondary" onClick={() => openSheet({ kind: 'walkthrough' })}>
            Replay the quick tour
          </Button>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="text-[17px] font-bold text-slate-900">Demo tools</div>
          <Checkbox
            checked={state.simulateOffline}
            onChange={v => setSimulateOffline(v)}
            label="Pretend I have no signal"
            hint="Log a visit while this is on, then turn it off to watch it sync"
          />
          {state.outbox.length > 0 && <p className="text-[15px] text-slate-700">{state.outbox.length} update(s) waiting to sync.</p>}
          <Button variant="secondary" onClick={() => scheduleTasksSync(0)} icon={<RefreshCw className="h-5 w-5" />}>
            Sync Google Tasks now
          </Button>
        </Card>
      </div>
    </Sheet>
  );
};

// ---------- Weekly reminder banner ----------

export const ReminderBanner: React.FC = () => {
  const { user, settings, now, basket, openSheet, setView, setDate, today, readOnly } = useMyPlan();
  const r = settings.reminder;
  if (readOnly || !r.enabled) return null;
  const weekKey = startOfWeek(today);
  const due =
    r.forceShow ||
    (now.getDay() === r.day && now.getHours() * 60 + now.getMinutes() >= Number(r.time.split(':')[0]) * 60 + Number(r.time.split(':')[1]) && r.lastShownWeek !== weekKey);
  if (!due) return null;
  const dismiss = () => updateSettings(user.id, { reminder: { ...settings.reminder, lastShownWeek: weekKey, forceShow: false } });
  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 border-blue-300 bg-blue-50 p-4">
      <BellRing className="h-7 w-7 text-blue-700" />
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-bold text-blue-950">Time to plan your week?</div>
        <div className="text-[15px] text-blue-900">Your basket has {basket.length} dealership{basket.length === 1 ? '' : 's'} waiting.</div>
      </div>
      <Button
        variant="primary"
        onClick={() => {
          dismiss();
          const nextMonday = now.getDay() === 0 || now.getDay() === 6 ? toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getDay() === 0 ? 1 : 2))) : today;
          setDate(nextMonday);
          setView('week');
        }}
      >
        Plan my week
      </Button>
      <Button variant="ghost" onClick={dismiss}>
        Later
      </Button>
      <Button variant="ghost" onClick={() => openSheet({ kind: 'settings' })}>
        Change reminder
      </Button>
    </Card>
  );
};

// ---------- First-time walkthrough ----------

const TOUR = [
  { title: 'This is your day', text: 'Everything you plan to do — visits, calls, Google Meets, emails and texts — in order, with real drive times and when to leave home.' },
  { title: 'Tap “Add to my plan”', text: 'Start with a dealership or with what you want to do. Tick everything you’ll do there, and we suggest the best times.' },
  { title: 'Tap a card to change it', text: 'Change the day, time, how or tasks any time. ▲ ▼ swaps the order. Hold ⋮⋮ and drag a little to move the time, or further to swap. “Details” shows the dealership.' },
  { title: 'Plan your week on Sunday', text: 'During the week, tap “Plan later” on any dealership. On Sunday, drag them into days in “Plan my week”.' }
];

export const Walkthrough: React.FC<{ onClose: () => void; start?: number }> = ({ onClose, start = 0 }) => {
  const { user, settings } = useMyPlan();
  const [i, setI] = useState(start);
  const last = i === TOUR.length;
  const finish = (enabled: boolean) => {
    updateSettings(user.id, { walkthroughDone: true, reminderAsked: true, reminder: { ...settings.reminder, enabled } });
    onClose();
  };
  return (
    <Sheet title="Welcome to My Plan" step={{ current: Math.min(i + 1, TOUR.length + 1), total: TOUR.length + 1 }} onBack={i > 0 ? () => setI(i - 1) : undefined} onClose={() => finish(settings.reminder.enabled)}>
      {!last ? (
        <Card className="p-6">
          <div className="text-[24px] font-extrabold text-slate-900">{TOUR[i].title}</div>
          <p className="mt-2 text-[18px] leading-relaxed text-slate-700">{TOUR[i].text}</p>
          <Button variant="primary" size="lg" className="mt-6" onClick={() => setI(i + 1)}>
            Next
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="text-[22px] font-extrabold text-slate-900">When do you like to plan your week?</div>
          <p className="text-[16px] text-slate-600">We’ll send a gentle reminder. You can change it any time in settings.</p>
          <ChoiceCard
            onClick={() => {
              updateSettings(user.id, { reminder: { ...settings.reminder, day: 0, time: '18:00', enabled: true } });
              finish(true);
            }}
            icon={<BellRing className="h-6 w-6" />}
            title="Sunday at 6:00 PM (recommended)"
          />
          <ChoiceCard
            onClick={() => {
              updateSettings(user.id, { reminder: { ...settings.reminder, day: 5, time: '15:00', enabled: true } });
              finish(true);
            }}
            title="Friday at 3:00 PM"
          />
          <ChoiceCard onClick={() => finish(false)} title="No reminder, thanks" />
          <p className="flex items-center gap-2 pt-2 text-[15px] text-slate-500">
            <CheckCircle2 className="h-4 w-4" /> Replay this tour any time from My Plan settings.
          </p>
        </div>
      )}
    </Sheet>
  );
};

export { ListTodo };
