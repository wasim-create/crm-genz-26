// Adding anything to My Plan starts with one question: what are you adding?
//   - Dealership work (the existing Add flow)
//   - A meeting or time block (anything not tied to a dealership visit)
//   - A to-do
//   - Something that already happened
// The meeting / time block form lives here too, for adding and editing.

import React, { useMemo, useRef, useState } from 'react';
import { Building2, CalendarClock, CalendarPlus, CheckCircle2, History, ListTodo, Repeat, Trash2, XCircle } from 'lucide-react';
import type { Activity } from '../../../types/crm';
import { indexForTime, insertAt } from '../engine/schedule';
import { addDays, format12h, toHHMM, toMin } from '../engine/time';
import { removeSlot, showToast, submitWriteback, updateSlot, upsertSlots } from '../data/store';
import type { BlockType, HowType, PlanSlot } from '../types';
import { useMyPlan } from './context';
import { Button, Card, ChoiceCard, Sheet } from './primitives';
import { newId } from './slotHelpers';
import { instantAt } from '../engine/timezones';

export const BLOCK_TYPES: { id: BlockType; label: string; placeholder: string }[] = [
  { id: 'meeting', label: 'Meeting', placeholder: 'e.g. Pipeline review with Jason' },
  { id: 'training', label: 'Training', placeholder: 'e.g. Ceramic Pro product training' },
  { id: 'travel', label: 'Travel', placeholder: 'e.g. Drive to Hartford' },
  { id: 'admin', label: 'Admin', placeholder: 'e.g. Expenses and paperwork' },
  { id: 'personal', label: 'Personal', placeholder: 'e.g. Dentist' },
  { id: 'focus', label: 'Time for a to-do', placeholder: 'e.g. Write the Golden Mile proposal' }
];
export const BLOCK_LABEL: Record<BlockType, string> = Object.fromEntries(BLOCK_TYPES.map(b => [b.id, b.label])) as Record<BlockType, string>;

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const durationText = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} hour${m === 60 ? '' : 's'}`);
const WORKDAY_START = '08:00';
const WORKDAY_MIN = 9 * 60;
const REPEAT_WEEKS = 8;

// ───────────────────────── What are you adding? ─────────────────────────

export const AddChooserSheet: React.FC<{ date?: string; insertIndex?: number; onClose: () => void }> = ({ date, insertIndex, onClose }) => {
  const { openSheet, today } = useMyPlan();
  const [past, setPast] = useState(false);
  const day = date ?? today;
  if (past) {
    return (
      <Sheet title="Something that already happened" onBack={() => setPast(false)} onClose={onClose}>
        <div className="space-y-3">
          <ChoiceCard
            onClick={() => openSheet({ kind: 'logpick' })}
            icon={<Building2 className="h-6 w-6" />}
            title="A dealership visit, call or Meet"
            subtitle="Log how it went; the dealership's record updates"
          />
          <ChoiceCard
            onClick={() => openSheet({ kind: 'block', date: day > today ? today : day, past: true })}
            icon={<CalendarClock className="h-6 w-6" />}
            title="A meeting or other time"
            subtitle="So your day shows what really happened"
          />
        </div>
      </Sheet>
    );
  }
  return (
    <Sheet title="What are you adding?" onClose={onClose}>
      <div className="space-y-3">
        <ChoiceCard
          onClick={() => openSheet({ kind: 'add', preset: { date: day, insertIndex, nonce: Date.now() } })}
          icon={<Building2 className="h-6 w-6" />}
          title="Dealership work"
          subtitle="A visit, call, Google Meet, email or text with a dealership"
        />
        <ChoiceCard
          onClick={() => openSheet({ kind: 'block', date: day, insertIndex })}
          icon={<CalendarPlus className="h-6 w-6" />}
          title="A meeting or time block"
          subtitle="Internal meetings, training, travel, admin, personal time, or time to get a task done"
        />
        <ChoiceCard onClick={() => openSheet({ kind: 'todo' })} icon={<ListTodo className="h-6 w-6" />} title="A to-do" subtitle="Something to get done, with or without a date. No set time." />
        <ChoiceCard onClick={() => setPast(true)} icon={<History className="h-6 w-6" />} title="Something that already happened" subtitle="A visit you didn't plan, or a meeting that came up" />
      </div>
    </Sheet>
  );
};

// ───────────────────────── Meeting or time block ─────────────────────────

const field = 'min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px]';

export const BlockSheet: React.FC<{ date?: string; slotId?: string; past?: boolean; title?: string; insertIndex?: number; blockType?: BlockType; onClose: () => void }> = props => {
  const ctx = useMyPlan();
  const { user, viewUser, today, now, nowMin: clockMin, slots, dealerships, readOnly, repZone } = ctx;
  const existing = props.slotId ? slots.find(s => s.id === props.slotId) : undefined;

  // A sensible start: the gap it was added into, else the next half hour (or an hour ago for "already happened").
  const defaultStart = useMemo(() => {
    if (existing?.fixedTime) return existing.fixedTime;
    const nowMin = clockMin;
    if (props.past) return toHHMM(Math.max(7 * 60, Math.floor((nowMin - 60) / 15) * 15));
    if (props.date && props.insertIndex !== undefined) {
      const lay = ctx.layout(props.date);
      const prev = lay.sequence[props.insertIndex - 1];
      if (prev) return toHHMM(Math.ceil(lay.timings[prev].end / 15) * 15);
    }
    if ((props.date ?? today) === today) return toHHMM(Math.max(8 * 60, Math.ceil((nowMin + 15) / 30) * 30));
    return '10:00';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [type, setType] = useState<BlockType>(existing?.blockType ?? props.blockType ?? (props.title ? 'focus' : 'meeting'));
  const [title, setTitle] = useState(existing?.target.name ?? props.title ?? '');
  const [date, setDate] = useState(existing?.date ?? props.date ?? today);
  const [start, setStart] = useState(defaultStart);
  const [duration, setDuration] = useState(existing?.durationMin ?? 60);
  const [allDay, setAllDay] = useState(!!existing?.allDay);
  const [how, setHow] = useState<HowType>(existing?.how ?? 'in_person');
  const [place, setPlace] = useState(existing?.target.address ?? '');
  const [withWho, setWithWho] = useState(existing?.contactNames.join(', ') ?? '');
  const [dealerId, setDealerId] = useState(existing?.relatedDealershipId ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [repeat, setRepeat] = useState(false);
  const [toCalendar, setToCalendar] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // The main button stays usable: pressing it with something missing says what, next to the field.
  const [tried, setTried] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);

  const mine = dealerships.filter(d => d.assignedRepId === viewUser.id && !d.isPlaceholder).sort((a, b) => a.dealershipName.localeCompare(b.dealershipName));
  const deal = dealerships.find(d => d.id === dealerId);
  const endMin = toMin(start) + duration;
  const happened = props.past || date < today || (date === today && endMin <= clockMin);
  const isPersonal = type === 'personal';
  const placeholder = BLOCK_TYPES.find(b => b.id === type)!.placeholder;
  const valid = title.trim().length > 0 && !!date && (allDay || !!start);

  /** Count it as contact with the dealership once it has happened. */
  const logContact = (slot: PlanSlot) => {
    if (!slot.relatedDealershipId) return;
    const d = dealerships.find(x => x.id === slot.relatedDealershipId);
    if (!d) return;
    const at = instantAt(slot.date!, toMin(slot.fixedTime ?? '12:00'), repZone).toISOString();
    const act: Activity = {
      id: `act_${slot.id}`,
      dealershipId: d.id,
      dealershipName: d.dealershipName,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      activityType: slot.how === 'phone' ? 'Phone Call' : slot.how === 'meet' ? 'Google Meet' : 'In-Person Visit',
      communicationType: slot.how === 'phone' ? 'Phone' : slot.how === 'meet' ? 'Virtual' : 'In-Person',
      status: 'completed',
      plannedDate: slot.date,
      plannedTime: slot.fixedTime,
      completedAt: at,
      notes: `${BLOCK_LABEL[slot.blockType ?? 'meeting']}: ${slot.target.name}${slot.contactNames.length ? ` (with ${slot.contactNames.join(', ')})` : ''}${slot.notes ? `. ${slot.notes}` : ''}`,
      productsDiscussed: [],
      tags: ['meeting_block']
    };
    submitWriteback({
      activities: [act],
      dealershipUpdates: [{ ...d, lastTouchpointDate: at }],
      newContacts: [],
      actionPoints: [],
      points: [],
      audit: [],
      totalPoints: 0
    });
  };

  const build = (id: string, onDate: string, base?: PlanSlot): PlanSlot => {
    const nowISO = new Date().toISOString();
    return {
      ...(base ?? {}),
      id,
      userId: viewUser.id,
      date: onDate,
      orderIndex: base?.orderIndex ?? 0,
      status: happened && !base ? 'done' : base?.status ?? 'planned',
      how,
      workType: 'block',
      target: { kind: 'block', id: base?.target.id ?? `blk_user_${type}_${id}`, name: title.trim(), address: place.trim() || undefined },
      tasks: [],
      contactIds: [],
      contactNames: withWho
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      timeMode: 'exact',
      fixedTime: allDay ? WORKDAY_START : start,
      durationMin: allDay ? WORKDAY_MIN : duration,
      durationOverridden: true,
      locked: true,
      allDay: allDay || undefined,
      blockType: type,
      relatedDealershipId: deal?.id,
      relatedDealershipName: deal?.dealershipName,
      notes: notes.trim() || undefined,
      source: base?.source ?? 'manual',
      unplanned: happened && !base ? true : base?.unplanned,
      completedAt: happened && !base ? nowISO : base?.completedAt,
      createdAt: base?.createdAt ?? nowISO,
      updatedAt: nowISO
    } as PlanSlot;
  };

  const place1 = (slot: PlanSlot) => {
    const day = ctx.daySlots(slot.date!).filter(s => s.id !== slot.id);
    const at = indexForTime(day, ctx.layoutCtx(slot.date!), slot.fixedTime!);
    return insertAt(day, slot, at);
  };

  const save = () => {
    if (!valid) {
      setTried(true);
      if (!title.trim()) titleRef.current?.focus();
      else if (!allDay && !start) startRef.current?.focus();
      return;
    }
    const id = existing?.id ?? newId('slot');
    const batch = repeat && !existing ? newId('rep') : undefined;
    const first = { ...build(id, date, existing), ...(batch ? { batchId: batch } : {}) };
    const list = place1(first);
    if (batch) {
      let d = date;
      const extra: PlanSlot[] = [];
      for (let w = 1; w < REPEAT_WEEKS; w++) {
        d = addDays(d, 7);
        const copy = { ...build(newId('slot'), d), status: 'planned' as const, unplanned: undefined, completedAt: undefined, batchId: batch };
        extra.push(...place1(copy));
      }
      upsertSlots([...list, ...extra]);
    } else upsertSlots(list);
    if (first.status === 'done' && !existing) logContact(first);
    const where = toCalendar && !isPersonal && !happened ? ' and your Google Calendar' : '';
    showToast(`${existing ? 'Updated' : happened ? 'Logged' : 'Added to your plan'}${where}${repeat && !existing ? `, every week for ${REPEAT_WEEKS} weeks` : ''}`);
    props.onClose();
  };

  const markDone = () => {
    if (!existing) return;
    const done = { ...existing, status: 'done' as const, completedAt: new Date().toISOString() };
    updateSlot(existing.id, { status: 'done', completedAt: done.completedAt }, { message: 'Marked as done' });
    logContact(done);
    props.onClose();
  };
  const markSkipped = () => {
    if (!existing) return;
    updateSlot(existing.id, { status: 'skipped', skippedReason: "Didn't happen" }, { message: 'Marked as not happened' });
    props.onClose();
  };
  const remove = (all: boolean) => {
    if (!existing) return;
    const ids = all && existing.batchId ? slots.filter(s => s.batchId === existing.batchId && (s.date ?? '') >= (existing.date ?? '')).map(s => s.id) : [existing.id];
    ids.forEach(removeSlot);
    showToast(ids.length > 1 ? `Removed ${ids.length} repeats` : 'Removed from your plan');
    props.onClose();
  };

  const isPastOrNow = existing && existing.status === 'planned' && (existing.date! < today || (existing.date === today && toMin(existing.fixedTime) <= clockMin));
  const sheetTitle = existing ? (readOnly ? existing.target.name : 'Edit meeting or time block') : props.past ? 'Log a meeting or other time' : 'Add a meeting or time block';

  return (
    <Sheet
      title={sheetTitle}
      onClose={props.onClose}
      footer={
        readOnly ? undefined : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" size="lg" block onClick={save}>
              {existing ? 'Save changes' : happened ? 'Log it' : 'Add to my plan'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {isPastOrNow && !readOnly && (
          <Card className="flex flex-wrap items-center gap-2 border-blue-200 p-3">
            <span className="flex-1 text-[15px] text-slate-800">Did it happen?</span>
            <Button variant="secondary" icon={<CheckCircle2 className="h-5 w-5" />} onClick={markDone}>
              Yes, done
            </Button>
            <Button variant="ghost" icon={<XCircle className="h-5 w-5" />} onClick={markSkipped}>
              It didn't happen
            </Button>
          </Card>
        )}

        <fieldset disabled={readOnly} className="space-y-5">
          <div>
            <div className="mb-2 text-[15px] font-semibold text-slate-700">What is it?</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What is it?">
              {BLOCK_TYPES.map(b => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={type === b.id}
                  onClick={() => setType(b.id)}
                  className={`min-h-[44px] cursor-pointer rounded-xl border px-3.5 text-[15px] font-semibold transition ${type === b.id ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[15px] font-semibold text-slate-700">Title</span>
            <input
              ref={titleRef}
              autoFocus={!existing}
              className={`mt-1 ${field}`}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={placeholder}
              aria-invalid={tried && !title.trim()}
              aria-describedby={tried && !title.trim() ? 'block-title-msg' : undefined}
            />
            {tried && !title.trim() && (
              <span id="block-title-msg" className="mt-1 block text-[14px] font-medium text-rose-700">
                Add a title first, so you can spot it in your plan.
              </span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[15px] font-semibold text-slate-700">Day</span>
              <input type="date" className={`mt-1 ${field}`} value={date} max={props.past ? today : undefined} onChange={e => setDate(e.target.value)} />
            </label>
            {!allDay && (
              <>
                <label className="block">
                  <span className="text-[15px] font-semibold text-slate-700">Starts</span>
                  <input ref={startRef} type="time" step={300} className={`mt-1 ${field}`} value={start} onChange={e => setStart(e.target.value)} aria-invalid={tried && !start} />
                  {tried && !start && <span className="mt-1 block text-[14px] font-medium text-rose-700">Pick a start time.</span>}
                </label>
                <label className="block">
                  <span className="text-[15px] font-semibold text-slate-700">How long</span>
                  <select className={`mt-1 ${field}`} value={duration} onChange={e => setDuration(Number(e.target.value))}>
                    {[...new Set([...DURATIONS, duration])]
                      .sort((a, b) => a - b)
                      .map(m => (
                        <option key={m} value={m}>
                          {durationText(m)} (until {format12h(toMin(start) + m)})
                        </option>
                      ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px] text-slate-700">
            <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={allDay} onChange={e => setAllDay(e.target.checked)} /> All day (no visits planned that day)
          </label>

          {!isPersonal && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[15px] font-semibold text-slate-700">Where</span>
                <select className={`mt-1 ${field}`} value={how} onChange={e => setHow(e.target.value as HowType)}>
                  <option value="in_person">In person</option>
                  <option value="meet">Online (Google Meet)</option>
                  <option value="phone">Phone</option>
                </select>
              </label>
              {how === 'in_person' && (
                <label className="block">
                  <span className="text-[15px] font-semibold text-slate-700">Place (optional)</span>
                  <input className={`mt-1 ${field}`} value={place} onChange={e => setPlace(e.target.value)} placeholder="e.g. Head office, Boston" />
                </label>
              )}
              <label className="block">
                <span className="text-[15px] font-semibold text-slate-700">With (optional)</span>
                <input className={`mt-1 ${field}`} value={withWho} onChange={e => setWithWho(e.target.value)} placeholder="Names, separated by commas" />
              </label>
              <label className="block">
                <span className="text-[15px] font-semibold text-slate-700">About a dealership? (optional)</span>
                <select className={`mt-1 ${field}`} value={dealerId} onChange={e => setDealerId(e.target.value)}>
                  <option value="">No, not about a dealership</option>
                  {mine.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.dealershipName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {deal && <p className="-mt-2 text-[14px] text-slate-600">Once it has happened, it counts as contact with {deal.dealershipName} and shows on its record.</p>}

          <label className="block">
            <span className="text-[15px] font-semibold text-slate-700">Notes (optional)</span>
            <textarea className={`mt-1 ${field} py-2`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </label>

          {!existing && !happened && (
            <div className="space-y-2">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                <Repeat className="h-4 w-4 text-slate-500" /> Repeats every week (next {REPEAT_WEEKS} weeks)
              </label>
              {!isPersonal && (
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px] text-slate-700">
                  <input type="checkbox" className="h-5 w-5 accent-blue-600" checked={toCalendar} onChange={e => setToCalendar(e.target.checked)} /> Add it to my Google Calendar too
                </label>
              )}
            </div>
          )}
        </fieldset>

        {existing && !readOnly && (
          <div className="border-t border-slate-200 pt-4">
            {!confirmDelete ? (
              <Button variant="ghost" icon={<Trash2 className="h-5 w-5" />} onClick={() => setConfirmDelete(true)}>
                Remove from my plan
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] text-slate-700">Remove {existing.batchId ? 'just this one, or every repeat from here?' : 'this?'}</span>
                <Button variant="secondary" onClick={() => remove(false)}>
                  {existing.batchId ? 'Just this one' : 'Yes, remove'}
                </Button>
                {existing.batchId && (
                  <Button variant="secondary" onClick={() => remove(true)}>
                    All repeats from here
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
};

