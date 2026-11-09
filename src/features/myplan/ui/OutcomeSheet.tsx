// "How did it go?" — one simple card per task, who you spoke with, a note,
// smart action points and a one-tap stage change. Saving writes everything
// back to the CRM (queued if there's no signal). Past slots stay editable for
// 24 hours (outcomes, contacts, notes, action points only).

import React, { useMemo, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Lock, Mic, Plus, Trophy, WifiOff } from 'lucide-react';
import { PipelineStage } from '../../../types/crm';
import { ActionPoint, HowType, InterestLevel, PlanSlot, SimpleResult, SlotTask, TaskOutcome, UpsellResult } from '../types';
import { durationFor, HOW_LABEL, HOW_SHORT, isMessage, TASK_BY_ID } from '../engine/tasks';
import { indexForTime, insertAt } from '../engine/schedule';
import { format12h, formatDuration, toHHMM } from '../engine/time';
import { pastEditWindow, replanPreview } from '../engine/schedule';
import { addActionPoints, dismissToast, isOffline, submitWriteback, updateActionPoint, updateSlot, upsertSlots, useMyPlanState } from '../data/store';
import { buildWriteback, describeTask, suggestActionPoints, suggestStageChange } from '../services/writeback';
import { Button, Card, Checkbox, Segmented, Sheet } from './primitives';
import { useMyPlan } from './context';
import { ContactsEditor, TasksEditor } from './parts';
import { newId, productName } from './slotHelpers';
import { readNote } from '../engine/nextStep';
import { NextStepCard, NextStepValue, buildNextSlot, nextStepSummary, placeNextSlot, valueFromReading } from './NextStepCard';
import { NEXT_SKIP_REASONS } from '../engine/nextStep';

const SIMPLE: { value: SimpleResult; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'follow_up', label: 'Needs follow-up' },
  { value: 'not_now', label: 'Not now' },
  { value: 'issue', label: 'Issue to fix' }
];
const INTEREST: { value: InterestLevel; label: string }[] = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
  { value: 'None', label: 'Not interested' }
];
const UPSELL: { value: UpsellResult; label: string }[] = [
  { value: 'Pitched', label: 'Pitched' },
  { value: 'Interested', label: 'Interested' },
  { value: 'Won', label: 'Won 🎉' },
  { value: 'Lost', label: 'Lost' }
];

function emptyOutcome(task: SlotTask): TaskOutcome {
  const kind = TASK_BY_ID[task.taskId]?.outcome ?? 'simple';
  const products = task.productIds ?? [];
  switch (kind) {
    case 'interest':
      return { kind, levels: Object.fromEntries(products.map(p => [p, 'Medium'])) };
    case 'upsell':
      return { kind, results: Object.fromEntries(products.map(p => [p, 'Pitched'])) };
    case 'keyfetch':
      return { kind, needsRefill: false };
    case 'signed':
      return { kind, productIds: products };
    default:
      return { kind: 'simple', result: 'done' };
  }
}

const MANAGER_ROLES = ['manager', 'team_lead', 'owner', 'executive'];

export const OutcomeSheet: React.FC<{ slotId: string; draft?: PlanSlot; onClose: () => void }> = ({ slotId, draft, onClose }) => {
  const ctx = useMyPlan();
  const { user, viewUser, catalog, dealershipById, gameRules, productBonuses, dealerships, now, openSheet } = ctx;
  const state = useMyPlanState();
  // A draft is something logged without being planned; it joins the plan when saved.
  const slot = ctx.slots.find(s => s.id === slotId) ?? draft;
  const isDraft = !!draft && !ctx.slots.some(s => s.id === slotId);
  // Captured when the sheet opens, so saving doesn't flip the screen into "edit" mode.
  const [wasDone] = useState(() => slot?.status === 'done');
  const editWin: { open: boolean; closesAt?: Date } = slot && wasDone ? pastEditWindow(slot, now) : { open: true };
  const isManager = MANAGER_ROLES.includes(user.role);
  const ownPlan = user.id === slot?.userId;
  const canEdit = !!slot && ((ownPlan && editWin.open) || (isManager && wasDone));
  const needsReason = wasDone && !editWin.open && isManager;

  const [tasks, setTasks] = useState<SlotTask[]>(() => (slot?.tasks ?? []).map(t => ({ ...t, outcome: t.outcome ?? emptyOutcome(t) })));
  const [spoke, setSpoke] = useState<Pick<PlanSlot, 'target' | 'contactIds' | 'contactNames' | 'how'>>(() => ({
    target: slot!.target,
    how: slot!.how,
    contactIds: slot?.spokeWithContactIds ?? slot?.contactIds ?? [],
    contactNames: slot?.spokeWithNames ?? slot?.contactNames ?? []
  }));
  const [note, setNote] = useState(slot?.outcomeNote ?? '');
  const [addingTask, setAddingTask] = useState(false);
  const [acceptedTips, setAcceptedTips] = useState<Record<string, boolean>>({});
  const [tipEdits, setTipEdits] = useState<Record<string, string>>({});
  const [manualAp, setManualAp] = useState('');
  const [stageYes, setStageYes] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  const [correction, setCorrection] = useState('');
  const [result, setResult] = useState<{ points: number; queued: boolean } | null>(null);
  const [listening, setListening] = useState(false);
  const [replanAnswered, setReplanAnswered] = useState(false);
  const [nsTouched, setNsTouched] = useState<NextStepValue | null>(null);
  const [noteTipOff, setNoteTipOff] = useState<Record<string, boolean>>({});
  const [savedNext, setSavedNext] = useState<NextStepValue | null>(null);
  const [startTime, setStartTime] = useState(slot?.fixedTime ?? '10:00');

  const preview: PlanSlot | undefined = slot ? { ...slot, tasks } : undefined;
  const dealership = slot?.target.kind === 'dealership' ? dealershipById.get(slot.target.id) : undefined;
  const stageSuggestion = useMemo(() => (preview && dealership && !wasDone ? suggestStageChange(preview, dealership) : null), [preview, dealership, wasDone]);
  const tips = useMemo(() => (preview && !wasDone ? suggestActionPoints(preview, catalog) : []), [preview, wasDone, catalog]);
  // Read the note as the rep types: next step, dated action points and stage hints.
  const reading = useMemo(
    () =>
      readNote({
        note,
        today: ctx.today,
        stage: dealership?.stage,
        workType: slot?.workType ?? 'prospect',
        tasks,
        dealershipName: slot?.target.name ?? '',
        contacts: dealership ? ctx.contacts.filter(c => c.dealershipId === dealership.id) : []
      }),
    [note, ctx.today, dealership, slot?.workType, tasks, slot?.target.name, ctx.contacts]
  );
  const nextValue: NextStepValue = nsTouched ?? valueFromReading(reading, ctx.today);
  const noteTips = reading.actionPoints.filter(a => !tips.includes(a.title));
  const stageSug = stageSuggestion ?? (reading.stage && dealership && reading.stage.to !== dealership.stage ? { to: reading.stage.to, reason: `${reading.stage.reason} (“${reading.stage.from}”)` } : null);
  const showNext = !wasDone && !!slot && slot.target.kind !== 'block';

  if (!slot) return null;

  const setOutcome = (taskId: string, outcome: TaskOutcome) => setTasks(ts => ts.map(t => (t.taskId === taskId ? { ...t, outcome } : t)));

  const listen = () => {
    const SR = (window as unknown as { webkitSpeechRecognition?: any; SpeechRecognition?: any }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SR) {
      alertless('Voice notes need Chrome or Safari. You can type instead.');
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => setNote(n => `${n ? `${n} ` : ''}${e.results[0][0].transcript}`);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  };

  const keyfetchQty = tasks.map(t => t.outcome).find(o => o?.kind === 'keyfetch' && o.needsRefill) as Extract<TaskOutcome, { kind: 'keyfetch' }> | undefined;
  const missingQty = keyfetchQty && !(keyfetchQty.quantity && keyfetchQty.quantity > 0);

  const save = () => {
    const nowISO = new Date().toISOString();
    const timing = ctx.layout(slot.date ?? ctx.today).timings[slot.id];
    const startedAt = slot.unplanned ? startTime : slot.checkInAt ? toHHMM(new Date(slot.checkInAt).getHours() * 60 + new Date(slot.checkInAt).getMinutes()) : timing ? toHHMM(timing.start) : slot.sendTime;
    const finalSlot: PlanSlot = {
      ...slot,
      ...(slot.unplanned
        ? {
            how: spoke.how,
            fixedTime: startTime,
            durationMin: slot.durationOverridden ? slot.durationMin : durationFor(spoke.how, tasks),
            checkInAt: new Date(`${slot.date ?? ctx.today}T${startTime}:00`).toISOString(),
            sendTime: isMessage(spoke.how) ? startTime : undefined
          }
        : {}),
      tasks,
      spokeWithContactIds: spoke.contactIds,
      spokeWithNames: spoke.contactNames,
      outcomeNote: note.trim() || undefined
    };
    const extraAps: ActionPoint[] = [
      ...tips.filter(t => acceptedTips[t]).map(t => tipEdits[t] ?? t),
      ...(manualAp.trim() ? [manualAp.trim()] : []),
      ...noteTips.filter(t => !noteTipOff[t.title]).map(t => t.title)
    ].map(title => ({
      id: newId('ap'),
      userId: slot.userId,
      title,
      dealershipId: slot.target.kind === 'dealership' ? slot.target.id : undefined,
      dealershipName: slot.target.name,
      slotId: slot.id,
      dueDate: noteTips.find(t => t.title === title)?.dueDate ?? ctx.today,
      done: false,
      source: acceptedTips[title] !== undefined || noteTips.some(t => t.title === title) ? 'suggestion' : 'manual',
      createdAt: nowISO,
      updatedAt: nowISO
    }));
    const stageChanges: Record<string, PipelineStage> = stageSug && stageYes && dealership ? { [dealership.id]: stageSug.to } : {};
    const nv = showNext ? nextValue : null;
    const skipLabel = nv?.mode === 'skip' ? NEXT_SKIP_REASONS.find(r => r.id === nv.skipReason)?.label ?? '' : '';

    const wb = buildWriteback({
      slot: finalSlot,
      user: users(ctx, slot.userId),
      dealerships,
      catalog,
      gameRules,
      productBonuses,
      startedAt,
      now: nowISO,
      acceptedStageChanges: stageChanges,
      extraActionPoints: extraAps,
      nextStep: nv && nv.mode !== 'skip' ? { action: nv.mode === 'later' ? `${nv.label} (plan later)` : nv.label, date: nv.mode === 'plan' ? nv.date : undefined, time: nv.mode === 'plan' ? nv.time : undefined } : undefined,
      nextSkipped: nv?.mode === 'skip' ? { reason: nv.skipReason ?? 'waiting', label: skipLabel, nurtureDate: nv.skipReason === 'not_now' ? nv.nurtureDate : undefined } : undefined
    });

    if (wasDone) {
      // Editing within the window: no duplicate activity; adjust points by the difference.
      const delta = wb.totalPoints - (slot.pointsAwarded ?? 0);
      const changes = tasks
        .map((t, i) => [describeTask(slot.tasks[i] ?? t, catalog), describeTask(t, catalog)] as const)
        .filter(([a, b]) => a !== b);
      const log = changes.map(([from, to]) => ({ at: nowISO, byUserId: user.id, byName: `${user.firstName} ${user.lastName}`, field: 'outcome', from, to, reason: reason || undefined }));
      const queued = submitWriteback({
        ...wb,
        activities: [],
        actionPoints: [],
        points: delta !== 0 ? [{ ...wb.points[0], id: newId('ple'), actionType: 'outcome_edit', description: `Outcome corrected — ${slot.target.name}`, pointsAwarded: delta }] : [],
        totalPoints: delta,
        audit: wb.audit.map(a => ({ ...a, action: 'My Plan outcome edited', details: `${changes.map(([f, t]) => `${f} → ${t}`).join('; ')}${reason ? ` · Reason: ${reason}` : ''}` }))
      });
      updateSlot(slot.id, { ...finalSlot, pointsAwarded: wb.totalPoints }, { log, message: 'Changes saved' });
      // Keep the Keyfetch order action point in step with the new quantity.
      const kf = state.actionPoints.find(a => a.slotId === slot.id && a.title.startsWith('Place Keyfetch order'));
      if (kf && keyfetchQty?.quantity) updateActionPoint(kf.id, { title: kf.title.replace(/— \d+ units/, `— ${keyfetchQty.quantity} units`) });
      setResult({ points: delta, queued: queued === 'queued' });
      return;
    }

    const queued = submitWriteback(wb);
    const doneSlot: PlanSlot = { ...finalSlot, status: 'done', completedAt: nowISO, pointsAwarded: wb.totalPoints };
    let dayNow: PlanSlot[] | null = null;
    if (isDraft) {
      // Put the unplanned visit into today's plan at the time it happened.
      const day = ctx.daySlots(doneSlot.date ?? ctx.today);
      dayNow = insertAt(day, doneSlot, indexForTime(day, ctx.layoutCtx(doneSlot.date ?? ctx.today), startTime));
      upsertSlots(dayNow);
    } else updateSlot(slot.id, doneSlot, { message: undefined, undoable: false });
    addActionPoints(wb.actionPoints);
    if (nv && nv.mode !== 'skip') {
      const nextSlot = buildNextSlot(nv, { userId: slot.userId, target: slot.target, workType: slot.workType, contactIds: spoke.contactIds, contactNames: spoke.contactNames, contacts: dealership ? ctx.contacts.filter(c => c.dealershipId === dealership.id) : [] }, dealership);
      const placeCtx = { daySlots: (d: string) => (dayNow && d === doneSlot.date ? dayNow : ctx.daySlots(d)), layoutCtx: ctx.layoutCtx };
      placeNextSlot(placeCtx, nextSlot, nv.index, '', dayNow ? undefined : slot.id);
    }
    setSavedNext(nv);
    if (wb.totalPoints > 0) {
      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
      } catch {
        /* no canvas */
      }
    }
    dismissToast();
    setResult({ points: wb.totalPoints, queued: queued === 'queued' });
  };

  // ---- Read-only view (window closed, not a manager) ----
  if (wasDone && !canEdit) {
    return (
      <Sheet title={slot.target.name} onClose={onClose} summary={`${HOW_LABEL[slot.how]} · done`}>
        <Card className="mb-4 flex items-start gap-2 border-slate-200 bg-slate-100 p-3 text-[15px] text-slate-700">
          <Lock className="mt-0.5 h-5 w-5" />
          {ownPlan ? 'The 24-hour edit window has closed. You can still add a correction note; your manager can make changes.' : 'Viewing only.'}
        </Card>
        <OutcomeSummary slot={slot} />
        {ownPlan && (
          <Card className="mt-4 space-y-2 p-4">
            <div className="text-[16px] font-bold text-slate-900">Add a correction note</div>
            <textarea className="min-h-[80px] w-full rounded-xl border border-slate-300 p-3 text-[16px]" value={correction} onChange={e => setCorrection(e.target.value)} />
            <Button
              variant="primary"
              disabled={!correction.trim()}
              onClick={() => {
                updateSlot(slot.id, { corrections: [...(slot.corrections ?? []), { at: new Date().toISOString(), byName: `${user.firstName} ${user.lastName}`, note: correction.trim() }] }, { message: 'Correction note added' });
                setCorrection('');
              }}
            >
              Save note
            </Button>
          </Card>
        )}
      </Sheet>
    );
  }

  // ---- Saved: celebration + next step ----
  if (result) {
    // At the END of the appointment: offer to move the rest of today.
    const rp = !wasDone && !replanAnswered && slot.date === ctx.today ? replanPreview(ctx.daySlots(slot.date), ctx.layoutCtx(slot.date)) : null;
    const first = rp?.changes[0];
    const shift = first ? first.to - first.from : 0;
    return (
      <Sheet title="Saved" onClose={onClose}>
        {first && Math.abs(shift) >= 5 && (
          <Card className="mb-4 space-y-3 border-blue-300 bg-blue-50 p-4">
            <div className="text-[18px] font-bold text-blue-950">
              {shift < 0 ? `You finished early — the rest of today can move ${formatDuration(Math.abs(shift))} earlier.` : `You ran over — the rest of today needs to move ${formatDuration(shift)} later.`}
            </div>
            <div className="text-[15px] text-blue-900">
              {rp!.changes.length} stop{rp!.changes.length === 1 ? '' : 's'} would change. Locked appointments stay where they are.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  upsertSlots(rp!.slots, `Moved the rest of today ${shift < 0 ? 'earlier' : 'later'}`);
                  setReplanAnswered(true);
                }}
              >
                Yes, move them
              </Button>
              <Button variant="secondary" onClick={() => setReplanAnswered(true)}>
                No, keep my times
              </Button>
            </div>
          </Card>
        )}
        <Card className="flex flex-col items-center p-6 text-center">
          {result.points > 0 ? <Trophy className="h-12 w-12 text-amber-500" /> : <CheckCircle2 className="h-12 w-12 text-emerald-600" />}
          <div className="mt-2 text-[22px] font-extrabold text-slate-900">{result.points > 0 ? `+${result.points} points` : wasDone ? 'Changes saved' : 'Saved'}</div>
          <p className="mt-1 text-[16px] text-slate-600">
            {result.queued ? 'No signal right now — saved on your phone and will sync to the CRM when you’re back online.' : 'The CRM has been updated for you.'}
          </p>
          {result.queued && <WifiOff className="mt-2 h-6 w-6 text-slate-500" />}
        </Card>
        {!wasDone && savedNext && (
          <Card className={`mt-4 space-y-3 p-4 ${savedNext.mode === 'skip' ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="text-[17px] font-bold text-slate-900">{savedNext.mode === 'skip' ? 'No next step' : 'Next step'}</div>
            <div className="text-[16px] text-slate-800">{nextStepSummary(savedNext)}</div>
            <div className="flex flex-wrap gap-2">
              {savedNext.mode === 'plan' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    ctx.setView('day');
                    ctx.setDate(savedNext.date);
                    onClose();
                  }}
                >
                  See {formatDayLabel(savedNext.date)}
                </Button>
              )}
              {savedNext.mode === 'skip' && slot.target.kind === 'dealership' && (
                <Button variant="primary" onClick={() => openSheet({ kind: 'nextstep', dealershipId: slot.target.id })}>
                  Plan it now
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </Card>
        )}
        {!wasDone && !savedNext && slot.target.kind !== 'block' && (
          <Button variant="primary" size="lg" className="mt-6" onClick={onClose}>
            Done
          </Button>
        )}
        {wasDone && (
          <Button variant="primary" size="lg" className="mt-6" onClick={onClose}>
            Done
          </Button>
        )}
      </Sheet>
    );
  }

  // ---- Form ----
  return (
    <Sheet
      title={wasDone ? `Edit: ${slot.target.name}` : slot.unplanned ? 'Log a visit' : 'How did it go?'}
      summary={`${HOW_LABEL[spoke.how]} · ${slot.target.name}`}
      onClose={onClose}
      footer={
        <Button variant="primary" size="lg" block onClick={save} disabled={!!missingQty || (needsReason && !reason.trim())}>
          {wasDone ? 'Save changes' : 'Save'}
        </Button>
      }
    >
      <div className="space-y-6">
        {wasDone && editWin.closesAt && ownPlan && editWin.open && (
          <Card className="flex items-center gap-2 bg-blue-50 p-3 text-[15px] text-blue-900">
            <Clock className="h-5 w-5" /> You can change outcomes, contacts, notes and action points until {editWin.closesAt.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
          </Card>
        )}
        {needsReason && (
          <Card className="space-y-2 border-amber-300 bg-amber-50 p-3">
            <div className="text-[15px] font-semibold text-amber-950">Manager edit after 24 hours — a reason is required and will be recorded.</div>
            <input className="min-h-[48px] w-full rounded-xl border border-amber-300 px-3 text-[16px]" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} />
          </Card>
        )}
        {isOffline() && (
          <Card className="flex items-center gap-2 bg-slate-100 p-3 text-[15px] text-slate-700">
            <WifiOff className="h-5 w-5" /> No signal — your answers are saved on this device and sync later.
          </Card>
        )}

        {slot.unplanned && !wasDone && (
          <Card className="space-y-4 p-4">
            <div>
              <div className="mb-2 text-[17px] font-bold text-slate-900">How did you talk to them?</div>
              <Segmented
                ariaLabel="How did you talk to them?"
                value={spoke.how}
                onChange={v => setSpoke(s => ({ ...s, how: v }))}
                options={(['in_person', 'phone', 'meet', 'email', 'text'] as HowType[]).map(h => ({ value: h, label: HOW_SHORT[h] }))}
              />
            </div>
            <label className="flex flex-wrap items-center gap-3 text-[16px] text-slate-800">
              <span className="font-semibold">{isMessage(spoke.how) ? 'Sent at' : 'Started at'}</span>
              <input
                type="time"
                className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]"
                value={startTime}
                onChange={e => e.target.value && setStartTime(e.target.value)}
              />
              <span className="text-[15px] text-slate-500">today</span>
            </label>
          </Card>
        )}

        {tasks.map(task => (
          <TaskOutcomeCard key={task.taskId} task={task} onChange={o => setOutcome(task.taskId, o)} />
        ))}
        {tasks.length === 0 && isMessage(spoke.how) && <Card className="p-4 text-[16px]">Mark this message as sent.</Card>}

        {slot.target.kind !== 'block' && (
          <div>
            {addingTask ? (
              <Card className="p-3">
                <div className="mb-2 text-[16px] font-bold text-slate-900">Did you do anything else?</div>
                <TasksEditor
                  workType={slot.workType}
                  dealership={dealership}
                  tasks={tasks}
                  onChange={next => setTasks(next.map(t => ({ ...t, outcome: t.outcome ?? emptyOutcome(t) })))}
                />
              </Card>
            ) : (
              <Button variant="soft" icon={<Plus className="h-5 w-5" />} onClick={() => setAddingTask(true)}>
                I did something else too
              </Button>
            )}
          </div>
        )}

        {slot.target.kind !== 'block' && !isMessage(spoke.how) && (
          <Card className="p-4">
            <ContactsEditor slot={spoke} onChange={p => setSpoke(s => ({ ...s, ...p }))} label="Who did you speak with?" />
          </Card>
        )}

        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[17px] font-bold text-slate-900">Notes (optional)</span>
            <Button variant="secondary" onClick={listen} icon={<Mic className="h-5 w-5" />} disabled={listening}>
              {listening ? 'Listening…' : 'Speak'}
            </Button>
          </div>
          <textarea
            className="min-h-[100px] w-full rounded-xl border border-slate-300 p-3 text-[16px]"
            placeholder="What happened? What did they say?"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </Card>

        {showNext && (
          <NextStepCard
            value={nextValue}
            onChange={v => setNsTouched(v)}
            target={slot.target}
            workType={slot.workType}
            dealership={dealership}
            ignoreSlotId={slot.id}
          />
        )}

        {!wasDone && slot.target.kind !== 'block' && (
          <Card className="space-y-2 p-4">
            <div className="text-[17px] font-bold text-slate-900">Action points</div>
            {noteTips.map(t => (
              <Checkbox
                key={t.title}
                checked={!noteTipOff[t.title]}
                onChange={v => setNoteTipOff(x => ({ ...x, [t.title]: !v }))}
                label={`${t.title} — due ${formatDayLabel(t.dueDate)}`}
                hint={`From your note: “${t.from}”`}
              />
            ))}
            {keyfetchQty?.quantity ? (
              <div className="rounded-xl bg-blue-50 p-3 text-[15px] text-blue-900">
                ✓ “Place Keyfetch order for {slot.target.name} — {keyfetchQty.quantity} units” will be added to your to-dos and Google Tasks.
              </div>
            ) : null}
            {tips.map(t => (
              <div key={t}>
                <Checkbox checked={!!acceptedTips[t]} onChange={v => setAcceptedTips(a => ({ ...a, [t]: v }))} label={tipEdits[t] ?? t} hint="Suggested" />
                {acceptedTips[t] && (
                  <input
                    className="ml-4 mt-1 min-h-[44px] w-[calc(100%-1rem)] rounded-xl border border-slate-300 px-3 text-[15px]"
                    value={tipEdits[t] ?? t}
                    onChange={e => setTipEdits(x => ({ ...x, [t]: e.target.value }))}
                    aria-label="Edit action point"
                  />
                )}
              </div>
            ))}
            <input
              className="min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]"
              placeholder="+ Add your own action point"
              value={manualAp}
              onChange={e => setManualAp(e.target.value)}
            />
          </Card>
        )}

        {stageSug && dealership && (
          <Card className="space-y-2 border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[17px] font-bold text-emerald-950">
              Move {dealership.dealershipName} from {dealership.stage} to {stageSug.to}?
            </div>
            <div className="text-[15px] text-emerald-900">{stageSug.reason}.</div>
            <div className="flex gap-2">
              <Button variant={stageYes === true ? 'primary' : 'secondary'} onClick={() => setStageYes(true)}>
                Yes, move it
              </Button>
              <Button variant={stageYes === false ? 'primary' : 'secondary'} onClick={() => setStageYes(false)}>
                Not yet
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Sheet>
  );

  function users(c: typeof ctx, id: string) {
    return c.users.find(u => u.id === id) ?? viewUser;
  }
};

function formatDayLabel(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function alertless(msg: string) {
  // Avoid blocking browser dialogs; surface through the console for the demo.
  console.info(msg);
}

const TaskOutcomeCard: React.FC<{ task: SlotTask; onChange: (o: TaskOutcome) => void }> = ({ task, onChange }) => {
  const { catalog } = useMyPlan();
  const def = TASK_BY_ID[task.taskId];
  const o = task.outcome!;
  const name = (id: string) => productName(catalog, id);
  return (
    <Card className="p-4">
      <div className="mb-3 text-[18px] font-bold text-slate-900">{def?.label ?? task.taskId}</div>
      {o.kind === 'simple' && <Segmented ariaLabel={def?.label ?? 'Result'} value={o.result} onChange={v => onChange({ kind: 'simple', result: v })} options={SIMPLE} />}
      {o.kind === 'interest' && (
        <div className="space-y-3">
          {Object.keys(o.levels).length === 0 && <p className="text-[15px] text-slate-600">No products picked for this task.</p>}
          {Object.entries(o.levels).map(([p, level]) => (
            <div key={p}>
              <div className="mb-1 text-[16px] font-semibold text-slate-800">{name(p)}</div>
              <Segmented ariaLabel={`${name(p)} interest`} value={level} onChange={v => onChange({ kind: 'interest', levels: { ...o.levels, [p]: v } })} options={INTEREST} />
            </div>
          ))}
          <AddProduct exclude={Object.keys(o.levels)} onAdd={p => onChange({ kind: 'interest', levels: { ...o.levels, [p]: 'Medium' } })} />
        </div>
      )}
      {o.kind === 'upsell' && (
        <div className="space-y-3">
          {Object.entries(o.results).map(([p, r]) => (
            <div key={p}>
              <div className="mb-1 text-[16px] font-semibold text-slate-800">{name(p)}</div>
              <Segmented ariaLabel={`${name(p)} upsell`} value={r} onChange={v => onChange({ kind: 'upsell', results: { ...o.results, [p]: v } })} options={UPSELL} />
            </div>
          ))}
          <AddProduct exclude={Object.keys(o.results)} onAdd={p => onChange({ kind: 'upsell', results: { ...o.results, [p]: 'Pitched' } })} />
        </div>
      )}
      {o.kind === 'keyfetch' && (
        <div className="space-y-3">
          <div className="text-[16px] text-slate-700">Does their Keyfetch stock need a refill?</div>
          <Segmented
            ariaLabel="Needs refill"
            value={o.needsRefill ? 'yes' : 'no'}
            onChange={v => onChange({ kind: 'keyfetch', needsRefill: v === 'yes', quantity: v === 'yes' ? o.quantity : undefined })}
            options={[
              { value: 'no', label: 'No, stock is fine' },
              { value: 'yes', label: 'Yes, needs a refill' }
            ]}
          />
          {o.needsRefill && (
            <div>
              <div className="mb-1 text-[16px] font-semibold text-slate-800">How many units?</div>
              <div className="flex flex-wrap items-center gap-2">
                {[100, 150, 200, 250, 300].map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onChange({ ...o, quantity: q })}
                    className={`min-h-[48px] rounded-xl border-2 px-4 text-[16px] font-semibold ${o.quantity === q ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white'}`}
                  >
                    {q}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  aria-label="Other quantity"
                  className="min-h-[48px] w-28 rounded-xl border border-slate-300 px-3 text-[16px]"
                  placeholder="Other"
                  value={o.quantity && ![100, 150, 200, 250, 300].includes(o.quantity) ? o.quantity : ''}
                  onChange={e => onChange({ ...o, quantity: Number(e.target.value) || undefined })}
                />
              </div>
              {!o.quantity && <p className="mt-1 text-[14px] text-amber-700">Enter how many units they need.</p>}
            </div>
          )}
        </div>
      )}
      {o.kind === 'signed' && (
        <div>
          <div className="mb-2 text-[16px] text-slate-700">Which products did they sign up for?</div>
          <div className="flex flex-wrap gap-2">
            {catalog
              .filter(p => p.isActive)
              .map(p => {
                const on = o.productIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ kind: 'signed', productIds: on ? o.productIds.filter(x => x !== p.id) : [...o.productIds, p.id] })}
                    className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white'}`}
                  >
                    {p.name}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </Card>
  );
};

const AddProduct: React.FC<{ exclude: string[]; onAdd: (id: string) => void }> = ({ exclude, onAdd }) => {
  const { catalog } = useMyPlan();
  const options = catalog.filter(p => p.isActive && !exclude.includes(p.id));
  if (options.length === 0) return null;
  return (
    <label className="flex flex-wrap items-center gap-2 text-[15px] text-slate-700">
      <span className="font-medium">Add another product:</span>
      <select className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3 text-[15px]" value="" onChange={e => e.target.value && onAdd(e.target.value)}>
        <option value="">Choose…</option>
        {options.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
};

const OutcomeSummary: React.FC<{ slot: PlanSlot }> = ({ slot }) => {
  const { catalog } = useMyPlan();
  return (
    <Card className="space-y-2 p-4 text-[16px] text-slate-800">
      {slot.status === 'skipped' ? (
        <div>Skipped — {slot.skippedReason}</div>
      ) : (
        <>
          {slot.tasks.map(t => (
            <div key={t.taskId}>• {describeTask(t, catalog)}</div>
          ))}
          {slot.spokeWithNames?.length ? <div>Spoke with: {slot.spokeWithNames.join(', ')}</div> : null}
          {slot.outcomeNote && <div className="text-slate-600">“{slot.outcomeNote}”</div>}
          {slot.pointsAwarded ? <div className="font-semibold text-amber-700">+{slot.pointsAwarded} pts</div> : null}
          {slot.completedAt && <div className="text-[14px] text-slate-500">Logged {new Date(slot.completedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>}
        </>
      )}
      {slot.corrections?.map((c, i) => (
        <div key={i} className="rounded-lg bg-slate-100 p-2 text-[14px]">
          Correction by {c.byName}: {c.note}
        </div>
      ))}
      {slot.editLog?.map((e, i) => (
        <div key={i} className="text-[13px] text-slate-500">
          Edited by {e.byName}: {e.from} → {e.to}
          {e.reason ? ` (${e.reason})` : ''}
        </div>
      ))}
    </Card>
  );
};

export { format12h };
