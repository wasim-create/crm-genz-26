// Edit a slot (everything about it) and "Move / can't do it".

import React, { useState } from 'react';
import { Inbox, Lock, Phone, SkipForward, Trash2 } from 'lucide-react';
import { HowType, PlanSlot, TimeMode } from '../types';
import { durationFor, HOW_LABEL, isMessage } from '../engine/tasks';
import { format12h, formatDayShort, nextWeekday } from '../engine/time';
import { indexForTime, insertAt, sendTimeAdvice } from '../engine/schedule';
import { addSlots, moveSlotToDay, removeSlot, reorderWithinDay, updateSlot, upsertSlots } from '../data/store';
import { Button, Card, Checkbox, ChoiceCard, Segmented, Sheet } from './primitives';
import { useMyPlan } from './context';
import { ContactsEditor, DayChooser, HowPicker, TasksEditor } from './parts';
import { newId } from './slotHelpers';

export const EditSlotSheet: React.FC<{ slotId: string; onClose: () => void }> = ({ slotId, onClose }) => {
  const ctx = useMyPlan();
  const original = ctx.slots.find(s => s.id === slotId);
  const [draft, setDraft] = useState<PlanSlot | undefined>(original);
  const [time, setTime] = useState(original?.fixedTime ?? '11:00');
  if (!original || !draft) return null;

  const patch = (p: Partial<PlanSlot>) =>
    setDraft(d => {
      if (!d) return d;
      const next = { ...d, ...p };
      if (!next.durationOverridden && (p.tasks || p.how)) next.durationMin = durationFor(next.how, next.tasks);
      return next;
    });

  const dealership = draft.target.kind === 'dealership' ? ctx.dealershipById.get(draft.target.id) : undefined;
  const message = isMessage(draft.how);

  const save = () => {
    let final: PlanSlot = { ...draft };
    if (final.timeMode === 'exact' || final.locked) final.fixedTime = time;
    else final.fixedTime = undefined;
    if (!final.date) {
      upsertSlots([{ ...final, status: 'basket' }], `Updated ${final.target.name}`);
      onClose();
      return;
    }
    final.status = final.status === 'basket' ? 'planned' : final.status;
    if (final.date !== original.date || final.timeMode === 'exact') {
      const day = ctx.daySlots(final.date).filter(s => s.id !== final.id);
      const index = final.timeMode === 'exact' ? indexForTime(day, { home: ctx.home, settings: ctx.engine }, time) : day.length;
      upsertSlots(insertAt(day, final, index), `Updated ${final.target.name}${final.date !== original.date ? ` — now on ${formatDayShort(final.date)}` : ''}`);
    } else {
      upsertSlots([final], `Updated ${final.target.name}. Times recalculated.`);
    }
    onClose();
  };

  const modeOptions: { value: TimeMode; label: string }[] = [
    { value: 'flow', label: 'Anytime' },
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'exact', label: 'Exact time' }
  ];

  return (
    <Sheet
      title={`Change: ${original.target.name}`}
      onClose={onClose}
      summary={`${HOW_LABEL[draft.how]}${draft.date ? ` · ${formatDayShort(draft.date)}` : ' · In basket'}`}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" size="lg" className="flex-1" onClick={save}>
            Save changes
          </Button>
          <Button
            variant="danger"
            size="lg"
            icon={<Trash2 className="h-5 w-5" />}
            onClick={() => {
              removeSlot(original.id);
              onClose();
            }}
          >
            Remove
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-[17px] font-bold text-slate-900">Day</h3>
          <DayChooser value={draft.date} onChange={d => patch({ date: d })} />
          <Button variant="ghost" className="mt-2" icon={<Inbox className="h-5 w-5" />} onClick={() => patch({ date: undefined, status: 'basket' })}>
            Send back to plan-later basket
          </Button>
        </section>

        {message ? (
          <section>
            <h3 className="mb-2 text-[17px] font-bold text-slate-900">Send time</h3>
            <input type="time" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]" value={draft.sendTime ?? '10:15'} onChange={e => patch({ sendTime: e.target.value })} />
            {draft.date && sendTimeAdvice(draft.how as 'email' | 'text', draft.date, draft.sendTime ?? '10:15') && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">{sendTimeAdvice(draft.how as 'email' | 'text', draft.date, draft.sendTime ?? '10:15')}</p>
            )}
            <h3 className="mb-2 mt-4 text-[17px] font-bold text-slate-900">Message</h3>
            <textarea className="min-h-[140px] w-full rounded-2xl border border-slate-300 p-3 text-[16px]" value={draft.message ?? ''} onChange={e => patch({ message: e.target.value })} />
          </section>
        ) : (
          <section>
            <h3 className="mb-2 text-[17px] font-bold text-slate-900">Time</h3>
            <Segmented ariaLabel="Time" value={draft.locked ? 'exact' : draft.timeMode} onChange={v => patch({ timeMode: v })} options={modeOptions} />
            {(draft.timeMode === 'exact' || draft.locked) && (
              <div className="mt-3 flex items-center gap-3">
                <input type="time" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]" value={time} onChange={e => setTime(e.target.value)} />
                <span className="text-[15px] text-slate-600">{format12h(time)}</span>
              </div>
            )}
            <div className="mt-3">
              <Checkbox
                checked={!!draft.locked}
                onChange={v => patch({ locked: v, timeMode: v ? 'exact' : draft.timeMode })}
                label="Lock this time"
                hint="For a confirmed appointment. Other items move around it."
              />
            </div>
            <h3 className="mb-2 mt-4 text-[17px] font-bold text-slate-900">How long?</h3>
            <Segmented
              ariaLabel="Duration"
              value={String(draft.durationMin)}
              onChange={v => patch({ durationMin: Number(v), durationOverridden: true })}
              options={[15, 20, 30, 45, 60, 90].map(m => ({ value: String(m), label: `${m} min` }))}
            />
            {draft.durationOverridden && (
              <Button variant="ghost" className="mt-1" onClick={() => setDraft(d => (d ? { ...d, durationOverridden: false, durationMin: durationFor(d.how, d.tasks) } : d))}>
                Use the suggested length ({durationFor(draft.how, draft.tasks)} min)
              </Button>
            )}
          </section>
        )}

        {draft.target.kind !== 'block' && (
          <>
            <section>
              <h3 className="mb-2 text-[17px] font-bold text-slate-900">How</h3>
              <HowPicker value={draft.how} onChange={(h: HowType) => patch({ how: h })} />
            </section>
            <section>
              <h3 className="mb-2 text-[17px] font-bold text-slate-900">What you’ll do</h3>
              <TasksEditor workType={draft.workType} dealership={dealership} tasks={draft.tasks} onChange={tasks => patch({ tasks })} />
            </section>
            <section>
              <ContactsEditor slot={draft} onChange={patch} />
            </section>
          </>
        )}

        <section>
          <h3 className="mb-2 text-[17px] font-bold text-slate-900">Notes</h3>
          <textarea
            className="min-h-[90px] w-full rounded-2xl border border-slate-300 p-3 text-[16px]"
            placeholder="Anything to remember"
            value={draft.notes ?? ''}
            onChange={e => patch({ notes: e.target.value })}
          />
        </section>
      </div>
    </Sheet>
  );
};

export const MoveSheet: React.FC<{ slotId: string; onClose: () => void }> = ({ slotId, onClose }) => {
  const ctx = useMyPlan();
  const slot = ctx.slots.find(s => s.id === slotId);
  const [pickDay, setPickDay] = useState<string | undefined>();
  const [skipReason, setSkipReason] = useState('');
  const [keepInBasket, setKeepInBasket] = useState(true);
  const [mode, setMode] = useState<'menu' | 'pick' | 'skip'>('menu');
  if (!slot) return null;
  const isToday = slot.date === ctx.today;
  const tomorrow = nextWeekday(slot.date ?? ctx.today);

  const done = (fn: () => void) => {
    fn();
    onClose();
  };

  return (
    <Sheet title={`Move or change: ${slot.target.name}`} onClose={onClose} onBack={mode !== 'menu' ? () => setMode('menu') : undefined}>
      {mode === 'menu' && (
        <div className="space-y-2">
          {isToday && !isMessage(slot.how) && (
            <ChoiceCard
              onClick={() =>
                done(() => reorderWithinDay(slot.userId, slot.date!, slot.id, 999, `${slot.target.name} moved to later today`))
              }
              title="Later today"
              subtitle="Move it to the end of today"
            />
          )}
          <ChoiceCard
            onClick={() => done(() => moveSlotToDay(slot.id, tomorrow, { message: `${slot.target.name} moved to ${formatDayShort(tomorrow)}` }))}
            title={`Move to ${formatDayShort(tomorrow)}`}
            subtitle="Next working day"
          />
          <ChoiceCard onClick={() => setMode('pick')} title="Pick another day" />
          {slot.how === 'in_person' && (
            <ChoiceCard
              icon={<Phone className="h-6 w-6" />}
              onClick={() =>
                done(() =>
                  updateSlot(
                    slot.id,
                    { how: 'phone', durationMin: durationFor('phone', slot.tasks), timeMode: 'flow', fixedTime: undefined, locked: false },
                    { message: `${slot.target.name} is now a phone call — no drive needed` }
                  )
                )
              }
              title="Turn it into a phone call"
              subtitle="Saves the drive"
            />
          )}
          <ChoiceCard
            icon={<Inbox className="h-6 w-6" />}
            onClick={() => done(() => moveSlotToDay(slot.id, undefined, { message: `${slot.target.name} is in your plan-later basket` }))}
            title="Plan it later"
            subtitle="Put it in the plan-later basket"
          />
          <ChoiceCard icon={<SkipForward className="h-6 w-6" />} onClick={() => setMode('skip')} title="Skip it" subtitle="Say why — it won’t be lost" />
        </div>
      )}
      {mode === 'pick' && (
        <div className="space-y-4">
          <DayChooser value={pickDay} onChange={setPickDay} />
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!pickDay}
            onClick={() => done(() => moveSlotToDay(slot.id, pickDay!, { message: `${slot.target.name} moved to ${formatDayShort(pickDay!)}` }))}
          >
            Move to {pickDay ? formatDayShort(pickDay) : '…'}
          </Button>
        </div>
      )}
      {mode === 'skip' && (
        <Card className="space-y-3 p-4">
          <label className="block">
            <span className="text-[16px] font-semibold text-slate-800">Why are you skipping it?</span>
            <input
              className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]"
              placeholder="e.g. Dealership asked to reschedule"
              value={skipReason}
              onChange={e => setSkipReason(e.target.value)}
            />
          </label>
          <Checkbox checked={keepInBasket} onChange={setKeepInBasket} label="Put it back in my plan-later basket" hint="So it isn’t forgotten" />
          <Button
            variant="primary"
            size="lg"
            block
            disabled={!skipReason.trim()}
            onClick={() =>
              done(() => {
                updateSlot(slot.id, { status: 'skipped', skippedReason: skipReason.trim() }, { message: `Skipped ${slot.target.name}` });
                if (keepInBasket) {
                  const now = new Date().toISOString();
                  addSlots([{ ...slot, id: newId('slot'), date: undefined, status: 'basket', timeMode: 'flow', fixedTime: undefined, locked: false, basketNote: `Skipped: ${skipReason.trim()}`, createdAt: now, updatedAt: now }]);
                }
              })
            }
          >
            Skip
          </Button>
        </Card>
      )}
      {slot.locked && mode === 'menu' && (
        <p className="mt-4 flex items-center gap-2 text-[15px] text-slate-600">
          <Lock className="h-4 w-4" /> This one is locked — moving it keeps its time on the new day.
        </p>
      )}
    </Sheet>
  );
};
