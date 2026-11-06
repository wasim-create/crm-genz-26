// Dealership quick view, Change time, Lunch for a day, Re-plan the rest of my day.

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ExternalLink, ListTodo, MapPin, Phone, Star, Users } from 'lucide-react';
import { LunchSettings } from '../types';
import { distanceBand, milesBetween } from '../engine/geo';
import { HOW_LABEL, workTypeForStage } from '../engine/tasks';
import { format12h, formatDayShort, toHHMM, toMin, weekDates } from '../engine/time';
import { layoutDay, nudgedTime, replanPreview, roundUp5 } from '../engine/schedule';
import { hasDayLunchOverride, lunchFor, setDayLunch, updateSlot, upsertSlots, useMyPlanState } from '../data/store';
import { BandChip, Button, Card, Checkbox, Segmented, Sheet, WorkChip } from './primitives';
import { useMyPlan } from './context';
import { mapsUrl, productName } from './slotHelpers';
import { isKeyDecisionMaker } from '../../../data/jobTitles';

// ---------- Dealership quick view ----------

export const QuickViewSheet: React.FC<{ dealershipId?: string; groupId?: string; onClose: () => void }> = ({ dealershipId, groupId, onClose }) => {
  const { dealershipById, dealerships, groups, contacts, activities, catalog, home, engine, today, onOpenDealership, users } = useMyPlan();
  const state = useMyPlanState();
  const d = dealershipId ? dealershipById.get(dealershipId) : undefined;
  const g = groupId ? groups.find(x => x.id === groupId) : d?.groupId ? groups.find(x => x.id === d.groupId) : undefined;
  if (!d && !g) return null;

  const rooftops = g ? dealerships.filter(x => x.groupId === g.id) : [];
  const ids = d ? [d.id] : rooftops.map(r => r.id);
  const cs = contacts.filter(c => ids.includes(c.dealershipId));
  const acts = activities.filter(a => ids.includes(a.dealershipId)).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 3);
  const aps = state.actionPoints.filter(a => !a.done && a.dealershipId && ids.includes(a.dealershipId));
  const next = state.slots
    .filter(s => s.status === 'planned' && s.date && s.date >= today && (ids.includes(s.target.id) || s.target.id === groupId))
    .sort((a, b) => a.date!.localeCompare(b.date!))[0];
  const miles = d ? milesBetween(home, d.coordinates) : undefined;
  const has = (d?.signedProducts ?? []).map(p => productName(catalog, p));
  const interest = (d?.productInterests ?? []).map(p => `${p.productName} (${p.interestLevel})`);
  const owner = d?.assignedRepId ? users.find(u => u.id === d.assignedRepId) : undefined;
  const address = d ? [d.address, d.city, `${d.state} ${d.zipCode}`].filter(Boolean).join(', ') : g ? [g.hqAddress, g.hqCity, g.hqState].filter(Boolean).join(', ') : '';

  return (
    <Sheet title={d ? d.dealershipName : g!.name} onClose={onClose} summary={d ? `${d.city}, ${d.state}` : `Dealer group · ${rooftops.length} rooftops`}>
      <div className="space-y-4">
        <Card className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {d && workTypeForStage(d.stage) && <WorkChip workType={workTypeForStage(d.stage)!} />}
            {d && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[14px] font-semibold text-slate-700">{d.stage}</span>}
            {d && miles !== undefined && <BandChip band={distanceBand(miles, engine)} miles={miles} />}
            {d?.heatLevel === 'Hot' && <span className="rounded-full bg-rose-100 px-2 text-[13px] font-bold text-rose-700">HOT</span>}
          </div>
          {address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[16px] text-blue-700 underline">
              <MapPin className="h-5 w-5" /> {address}
            </a>
          )}
          {d?.phone && (
            <div className="flex items-center gap-2 text-[16px] text-slate-800">
              <Phone className="h-5 w-5 text-slate-500" /> <a href={`tel:${d.phone}`}>{d.phone}</a>
            </div>
          )}
          {d && (
            <div className="text-[15px] text-slate-600">
              {d.dealershipType}
              {d.groupName ? ` · ${d.groupName}` : ''} · {d.usedCarsOnLot} used cars · F&I: {d.fiSystem || '—'}
              {owner ? ` · Owner: ${owner.firstName} ${owner.lastName}` : ''}
            </div>
          )}
        </Card>

        {g && !d && (
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-[17px] font-bold text-slate-900">
              <Users className="h-5 w-5" /> Rooftops
            </div>
            <div className="space-y-1">
              {rooftops.map(r => (
                <div key={r.id} className="text-[15px] text-slate-800">
                  {r.dealershipName} <span className="text-slate-500">· {r.city}, {r.state} · {r.stage}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="mb-2 text-[17px] font-bold text-slate-900">Contacts</div>
          {cs.length === 0 && <p className="text-[15px] text-amber-800">No contacts yet — find the decision maker on your next contact.</p>}
          <div className="space-y-2">
            {cs.map(c => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[16px] font-semibold text-slate-900">
                    {c.firstName} {c.lastName}
                    {(c.isDecisionMaker || isKeyDecisionMaker(c.jobTitle)) && <Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-label="Decision maker" />}
                  </div>
                  <div className="text-[14px] text-slate-600">{c.jobTitle}</div>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[15px] font-semibold text-slate-800">
                    <Phone className="h-4 w-4" /> {c.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
          {cs.length > 0 && !cs.some(c => c.isDecisionMaker || isKeyDecisionMaker(c.jobTitle)) && (
            <p className="mt-2 text-[14px] text-amber-800">No decision maker on file — try to meet one.</p>
          )}
        </Card>

        {d && (
          <Card className="space-y-1 p-4 text-[15px]">
            <div className="text-[17px] font-bold text-slate-900">Products</div>
            <div>
              <span className="font-semibold">Has:</span> {has.length ? has.join(', ') : 'None yet'}
            </div>
            <div>
              <span className="font-semibold">Interested in:</span> {interest.length ? interest.join(', ') : 'Not recorded'}
            </div>
          </Card>
        )}

        <Card className="p-4">
          <div className="mb-2 text-[17px] font-bold text-slate-900">Recent contact</div>
          {acts.length === 0 && <p className="text-[15px] text-slate-600">Nothing logged yet.</p>}
          {acts.map(a => (
            <div key={a.id} className="border-b border-slate-100 py-2 text-[15px] last:border-0">
              <div className="font-semibold text-slate-800">
                {a.activityType} · {a.completedAt ? new Date(a.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : a.plannedDate} · {a.userName}
              </div>
              <div className="line-clamp-2 text-slate-600">{a.notes}</div>
            </div>
          ))}
        </Card>

        {(aps.length > 0 || next) && (
          <Card className="space-y-2 p-4 text-[15px]">
            {next && (
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-blue-600" /> Next planned: <span className="font-semibold">{formatDayShort(next.date!)}</span> · {HOW_LABEL[next.how]}
              </div>
            )}
            {aps.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-slate-500" /> {a.title}
              </div>
            ))}
          </Card>
        )}

        {d && (
          <Button
            variant="secondary"
            size="lg"
            block
            icon={<ExternalLink className="h-5 w-5" />}
            onClick={() => {
              onClose();
              onOpenDealership(d);
            }}
          >
            Open the full record
          </Button>
        )}
      </div>
    </Sheet>
  );
};

// ---------- Change time ----------

export const TimeSheet: React.FC<{ slotId: string; onClose: () => void }> = ({ slotId, onClose }) => {
  const ctx = useMyPlan();
  const slot = ctx.slots.find(s => s.id === slotId);
  const date = slot?.date ?? ctx.today;
  const lay = ctx.layout(date);
  const current = slot ? lay.timings[slot.id]?.start ?? toMin(slot.sendTime ?? '10:00') : 600;
  const [target, setTarget] = useState<number>(current);
  const isMsg = slot?.how === 'email' || slot?.how === 'text';

  const trial = useMemo(() => {
    if (!slot || isMsg) return null;
    const day = ctx.daySlots(date).map(s => (s.id === slot.id ? { ...s, timeMode: 'exact' as const, fixedTime: toHHMM(target), autoPinned: false } : s));
    return layoutDay(day, ctx.layoutCtx(date));
  }, [slot, target, date, ctx, isMsg]);

  if (!slot) return null;
  const actual = trial?.timings[slot.id]?.start ?? target;
  const pushedLater = trial ? Object.keys(trial.timings).filter(id => id !== slot.id && (trial.timings[id].start - (lay.timings[id]?.start ?? 0)) >= 5).length : 0;
  const newWarnings = trial ? trial.warnings.filter(w => !lay.warnings.some(b => b.code === w.code && b.slotId === w.slotId)) : [];

  const nowMin = roundUp5(ctx.now.getHours() * 60 + ctx.now.getMinutes());
  const chips = [-30, -15, -5, 5, 15, 30, 60];

  const save = () => {
    if (isMsg) updateSlot(slot.id, { sendTime: toHHMM(target) }, { message: `${slot.target.name} now sends at ${format12h(target)}` });
    else updateSlot(slot.id, { timeMode: 'exact', fixedTime: toHHMM(target), autoPinned: false }, { message: `${slot.target.name} moved to ${format12h(actual)}${pushedLater ? ` · ${pushedLater} later stop${pushedLater === 1 ? '' : 's'} moved too` : ''}` });
    onClose();
  };

  return (
    <Sheet
      title={`Change time: ${slot.target.name}`}
      onClose={onClose}
      summary={`Now ${format12h(current)} · ${formatDayShort(date)}`}
      footer={
        <Button variant="primary" size="lg" block onClick={save}>
          Set to {format12h(actual)}
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[17px] font-bold text-slate-900">Earlier or later</div>
          <div className="flex flex-wrap gap-2">
            {chips.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setTarget(t => nudgedTime(t, c))}
                className="min-h-[52px] min-w-[72px] rounded-xl border-2 border-slate-200 bg-white px-3 text-[17px] font-bold text-slate-800 hover:border-blue-400"
              >
                {c < 0 ? '−' : '+'}
                {Math.abs(c) === 60 ? '1 hr' : `${Math.abs(c)} min`}
              </button>
            ))}
            {date === ctx.today && (
              <button type="button" onClick={() => setTarget(nowMin)} className="min-h-[52px] rounded-xl border-2 border-blue-200 bg-blue-50 px-3 text-[17px] font-bold text-blue-800">
                Start now
              </button>
            )}
          </div>
        </div>
        <label className="flex flex-wrap items-center gap-3 text-[16px] font-medium text-slate-700">
          Or type a time:
          <input type="time" className="min-h-[52px] rounded-xl border border-slate-300 px-3 text-[17px]" value={toHHMM(target)} onChange={e => setTarget(toMin(e.target.value))} />
        </label>
        <Card className="p-4 text-[16px]">
          <div className="text-[20px] font-extrabold text-slate-900">{format12h(actual)}</div>
          {actual !== target && <p className="text-amber-800">That’s the earliest you can get there after the stop before it.</p>}
          {pushedLater > 0 && <p className="text-slate-700">This moves {pushedLater} later stop{pushedLater === 1 ? '' : 's'} too.</p>}
          {slot.locked && <p className="text-indigo-800">This was a locked appointment — it stays locked at the new time.</p>}
        </Card>
        {newWarnings.map((w, i) => (
          <div key={i} className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[15px] text-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> {w.message}
          </div>
        ))}
      </div>
    </Sheet>
  );
};

// ---------- Lunch for a day ----------

export const LunchSheet: React.FC<{ date: string; onClose: () => void }> = ({ date, onClose }) => {
  const { viewUser, openSheet } = useMyPlan();
  const [lunch, setLunch] = useState<LunchSettings>(() => lunchFor(viewUser.id, date));
  const changed = hasDayLunchOverride(viewUser.id, date);
  const restOfWeek = weekDates(date).filter(d => d >= date);
  return (
    <Sheet title={`Lunch on ${formatDayShort(date)}`} onClose={onClose} summary={changed ? 'Changed for this day' : 'Using your usual lunch'}>
      <div className="space-y-4">
        <Checkbox checked={lunch.enabled} onChange={v => setLunch({ ...lunch, enabled: v })} label="Take a lunch break this day" />
        {lunch.enabled && (
          <Card className="space-y-4 p-4">
            <label className="flex flex-wrap items-center gap-3 text-[16px] font-medium text-slate-700">
              Lunch at
              <input type="time" className="min-h-[52px] rounded-xl border border-slate-300 px-3 text-[17px]" value={lunch.time} onChange={e => setLunch({ ...lunch, time: e.target.value })} />
            </label>
            <div>
              <div className="mb-2 text-[16px] font-medium text-slate-700">How long?</div>
              <Segmented
                ariaLabel="Lunch length"
                value={String(lunch.durationMin)}
                onChange={v => setLunch({ ...lunch, durationMin: Number(v) })}
                options={[15, 30, 45, 60].map(m => ({ value: String(m), label: `${m} min` }))}
              />
            </div>
            <Checkbox
              checked={lunch.flexible}
              onChange={v => setLunch({ ...lunch, flexible: v })}
              label="Flexible"
              hint="Fit lunch around visits, up to an hour either side of this time"
            />
          </Card>
        )}
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              setDayLunch(viewUser.id, [date], lunch, `Lunch updated for ${formatDayShort(date)}`);
              onClose();
            }}
          >
            Save for this day
          </Button>
          {restOfWeek.length > 1 && (
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                setDayLunch(viewUser.id, restOfWeek, lunch, `Lunch updated for the rest of this week`);
                onClose();
              }}
            >
              Save for this day and the rest of the week
            </Button>
          )}
          {changed && (
            <Button
              variant="ghost"
              onClick={() => {
                setDayLunch(viewUser.id, [date], null, 'Back to your usual lunch');
                onClose();
              }}
            >
              Go back to my usual lunch
            </Button>
          )}
          <Button variant="ghost" onClick={() => openSheet({ kind: 'settings' })}>
            Change my usual lunch for every day
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

// ---------- Re-plan the rest of my day ----------

export const ReplanSheet: React.FC<{ date: string; onClose: () => void }> = ({ date, onClose }) => {
  const ctx = useMyPlan();
  const preview = replanPreview(ctx.daySlots(date), ctx.layoutCtx(date));
  return (
    <Sheet
      title="Re-plan the rest of my day"
      onClose={onClose}
      footer={
        preview.changes.length > 0 ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={() => {
                upsertSlots(preview.slots, `Re-planned ${preview.changes.length} stop${preview.changes.length === 1 ? '' : 's'}`);
                onClose();
              }}
            >
              Apply these times
            </Button>
            <Button variant="secondary" size="lg" onClick={onClose}>
              Keep my times
            </Button>
          </div>
        ) : undefined
      }
    >
      {preview.changes.length === 0 ? (
        <Card className="flex items-center gap-2 p-4 text-[16px] text-emerald-900">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" /> Your day already fits. Nothing to change.
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-[16px] text-slate-700">Here’s how the rest of your day would look from where you are now. Locked appointments don’t move.</p>
          {preview.changes.map(c => (
            <Card key={c.slotId} className="flex items-center justify-between gap-3 p-4">
              <span className="text-[17px] font-semibold text-slate-900">{c.name}</span>
              <span className="text-[16px] tabular-nums">
                <span className="text-slate-500 line-through">{format12h(c.from)}</span> → <span className="font-bold text-slate-900">{format12h(c.to)}</span>
              </span>
            </Card>
          ))}
        </div>
      )}
    </Sheet>
  );
};

export { mapsUrl };
