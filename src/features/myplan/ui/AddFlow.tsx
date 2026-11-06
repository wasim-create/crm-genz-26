// "+ Add to my plan" — one flow, two ways in (dealership first or activity
// first), one decision per screen, "Step X of Y", a summary line, and a big
// Back button that never loses choices.

import React, { useMemo, useState } from 'react';
import { Building2, CheckCircle2, Compass, Inbox, ListChecks, MapPin, Plus, Search, SlidersHorizontal, Sparkles, Users } from 'lucide-react';
import { Dealership, DealerGroup } from '../../../types/crm';
import { HowType, PlanSlot, SlotTask, WorkType } from '../types';
import { distanceBand, milesBetween } from '../engine/geo';
import { durationFor, HOW_LABEL, isMessage, TASK_BY_ID, WORK_TYPE_LABEL, workTypeForStage } from '../engine/tasks';
import { format12h, formatDayLong, formatDayShort, nextWeekday, parseISODate, toMin } from '../engine/time';
import { indexForTime, insertAt, layoutDay, PlacementSuggestion, sendTimeAdvice, staggerSendTimes, suggestPlacements, suggestSendTime } from '../engine/schedule';
import { addSlots, upsertSlots } from '../data/store';
import { contactsFor } from '../data/seed';
import { BandChip, Button, Card, Checkbox, ChoiceCard, HOW_ICON, Segmented, Sheet, WorkChip } from './primitives';
import { AddPreset, useMyPlan } from './context';
import { ContactsEditor, DayChooser, HowPicker, TasksEditor } from './parts';
import { draftSlotForDealership, draftSlotForGroup, newId, productName } from './slotHelpers';

type Step = 'start' | 'how' | 'pick' | 'tasks' | 'who' | 'message' | 'when' | 'done';
type Tab = 'prospect' | 'signup' | 'client' | 'group';
type BatchPurpose = 'followup' | 'pitch' | 'promo' | 'checkin';

const TAB_LABEL: Record<Tab, string> = {
  prospect: 'Prospects',
  signup: 'Sign-up & Onboarding',
  client: 'Clients',
  group: 'Groups'
};

const BATCH_PURPOSES: { id: BatchPurpose; label: string; hint: string }[] = [
  { id: 'followup', label: 'Follow-up', hint: 'Keep the conversation going' },
  { id: 'pitch', label: 'Product pitch / upsell', hint: 'Share a product they don’t have yet' },
  { id: 'promo', label: 'Promotions / sales follow-up', hint: 'Ask how their promotion is going' },
  { id: 'checkin', label: 'Check-in', hint: 'A friendly “how are things?”' }
];

function batchTasks(purpose: BatchPurpose, work: WorkType, products: string[]): SlotTask[] {
  if (work === 'client') {
    if (purpose === 'pitch') return [{ taskId: 'c_upsell', productIds: products }];
    if (purpose === 'promo') return [{ taskId: 'c_promo' }];
    return [{ taskId: 'c_checkin' }];
  }
  if (work === 'signup') return [{ taskId: purpose === 'pitch' ? 's_confirm' : 's_setup', productIds: purpose === 'pitch' ? products : undefined }];
  if (purpose === 'pitch') return [{ taskId: 'p_pitch', productIds: products }];
  return [{ taskId: 'p_followup' }];
}

const DEFAULT_MESSAGE: Record<BatchPurpose, string> = {
  followup: 'Hi {first name}, thanks again for your time. I wanted to follow up — would a quick call this week work for you?',
  pitch: 'Hi {first name}, a few dealerships near you have started using {product} and are seeing good results. Could I show you how it works in 10 minutes?',
  promo: 'Hi {first name}, how is your current promotion going? Happy to help with anything you need on our side.',
  checkin: 'Hi {first name}, just checking in to see how everything is going. Anything I can help with?'
};

export const AddFlow: React.FC<{ preset?: AddPreset; onClose: () => void }> = ({ preset, onClose }) => {
  const ctx = useMyPlan();
  const { viewUser, user, dealerships, dealershipById, groups, contacts, catalog, today, home, engine, slots, onClaimDealership } = ctx;
  const basketSlot = preset?.basketSlotId ? slots.find(s => s.id === preset.basketSlotId) : undefined;
  const presetDealership = preset?.dealershipId ? dealershipById.get(preset.dealershipId) : undefined;
  const presetGroup = preset?.groupId ? groups.find(g => g.id === preset.groupId) : undefined;

  const initialDraft = (): PlanSlot | null => {
    if (basketSlot) return { ...basketSlot };
    if (presetDealership) return draftSlotForDealership({ user: viewUser, dealership: presetDealership, contacts, catalog, how: preset?.how });
    if (presetGroup) return draftSlotForGroup({ user: viewUser, group: presetGroup, dealerships, how: preset?.how });
    return null;
  };

  const [entry, setEntry] = useState<'dealership' | 'activity' | undefined>(
    presetDealership || presetGroup || basketSlot ? 'dealership' : preset?.how ? 'activity' : undefined
  );
  const [how, setHow] = useState<HowType | undefined>(preset?.how ?? basketSlot?.how);
  const [draft, setDraft] = useState<PlanSlot | null>(initialDraft);
  const [multi, setMulti] = useState<string[]>([]);
  const [purpose, setPurpose] = useState<BatchPurpose>('followup');
  const [batchProducts, setBatchProducts] = useState<string[]>(catalog.filter(p => p.isNewLaunch).map(p => p.id).slice(0, 1));
  const [message, setMessage] = useState<string>(DEFAULT_MESSAGE.followup);
  const [date, setDate] = useState<string>(preset?.date && preset.date >= today ? preset.date : today);
  const [choice, setChoice] = useState<
    | { type: 'suggest'; s: PlanSuggestionLike }
    | { type: 'mode'; mode: 'morning' | 'afternoon' | 'flow' }
    | { type: 'exact'; time: string }
    | null
  >(null);
  const [ownTime, setOwnTime] = useState('11:00');
  const [sendTime, setSendTime] = useState<string | undefined>(undefined);
  const [tripExtras, setTripExtras] = useState<string[]>([]);
  const [added, setAdded] = useState<PlanSlot[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const planLater = !!preset?.planLater;
  const messageHow = how ? isMessage(how) : false;
  const isBatch = entry === 'activity' && messageHow;

  // The steps for the current path (recomputed as choices are made).
  const steps: Step[] = useMemo(() => {
    const s: Step[] = [];
    if (basketSlot) return ['when', 'done'];
    if (!entry) return ['start'];
    s.push('start');
    if (entry === 'activity') s.push('how');
    if (!presetDealership && !presetGroup) s.push('pick');
    s.push('tasks');
    if (entry === 'dealership') s.push('how');
    if (planLater) return [...s.filter(x => x !== 'start' || (!presetDealership && !presetGroup)), 'done'];
    if (messageHow) s.push('message');
    else {
      const t = draft?.target;
      const contactCount = t && t.kind === 'dealership' ? contactsFor(t.id, contacts).length : 2;
      if (!t || t.kind === 'group' || contactCount !== 1) s.push('who');
    }
    s.push('when', 'done');
    if (presetDealership || presetGroup) return s.filter(x => x !== 'start');
    return s;
  }, [entry, how, draft?.target?.id, planLater, messageHow, basketSlot, presetDealership, presetGroup, contacts]);

  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const visibleSteps = steps.filter(s => s !== 'done');
  const go = (delta: number) => setStepIndex(i => Math.max(0, Math.min(steps.length - 1, i + delta)));
  const back = () => (stepIndex === 0 || step === 'done' ? onClose() : go(-1));

  const setDraftPatch = (patch: Partial<PlanSlot>) =>
    setDraft(d => {
      if (!d) return d;
      const next = { ...d, ...patch };
      if (!next.durationOverridden && (patch.tasks || patch.how)) next.durationMin = durationFor(next.how, next.tasks);
      return next;
    });

  const chooseHow = (h: HowType) => {
    setHow(h);
    if (draft) setDraftPatch({ how: h });
  };

  const pickTarget = (target: { kind: 'dealership'; d: Dealership } | { kind: 'group'; g: DealerGroup }) => {
    const d =
      target.kind === 'dealership'
        ? draftSlotForDealership({ user: viewUser, dealership: target.d, contacts, catalog, how })
        : draftSlotForGroup({ user: viewUser, group: target.g, dealerships, how });
    setDraft(d);
    if (!how) setHow(d.how);
    go(1);
  };

  // --- summary line ---
  const summary = (() => {
    const bits: string[] = [];
    if (how) bits.push(HOW_LABEL[how]);
    if (isBatch && multi.length) bits.push(`${multi.length} dealership${multi.length === 1 ? '' : 's'}`);
    else if (draft) bits.push(draft.target.name);
    if (step === 'when' || step === 'done') bits.push(formatDayShort(date));
    return bits.length ? bits.join(' · ') : undefined;
  })();

  // --- confirm ---
  const confirm = () => {
    if (planLater && draft) {
      const slot: PlanSlot = {
        ...draft,
        date: undefined,
        status: 'basket',
        basketNote: draft.basketNote,
        ...(preset?.priorityFrom ? { source: 'manager_priority' as const, managerPriorityFrom: preset.priorityFrom } : {})
      };
      if (slot.target.kind === 'dealership') {
        const d = dealershipById.get(slot.target.id);
        if (d && d.stage === 'Pool') onClaimDealership(d);
      }
      addSlots([slot], preset?.priorityFrom ? `Sent to ${viewUser.firstName}'s basket as a priority` : `Added ${slot.target.name} to your plan-later basket`);
      setAdded([slot]);
      go(1);
      return;
    }

    if (isBatch || (messageHow && draft)) {
      const ids = isBatch ? multi : [draft!.target.id];
      const base = sendTime ?? suggestSendTime(how as 'email' | 'text', date);
      const times = staggerSendTimes(how as 'email' | 'text', base, ids.length);
      const batchId = ids.length > 1 ? newId('batch') : undefined;
      const productLabel = batchProducts.map(p => productName(catalog, p)).join(' and ') || 'our products';
      const created: PlanSlot[] = ids.map((id, i) => {
        const d = dealershipById.get(id)!;
        const base = draftSlotForDealership({ user: viewUser, dealership: d, contacts, catalog, how: how!, date });
        const tasks = isBatch ? batchTasks(purpose, base.workType, batchProducts) : draft!.tasks;
        return {
          ...base,
          id: isBatch ? base.id : draft!.id,
          tasks,
          contactIds: isBatch ? base.contactIds : draft!.contactIds,
          contactNames: isBatch ? base.contactNames : draft!.contactNames,
          durationMin: durationFor(how!, tasks),
          sendTime: times[i],
          batchId,
          message: message.replace('{product}', productLabel)
        };
      });
      created.forEach(c => {
        const d = dealershipById.get(c.target.id);
        if (d && d.stage === 'Pool') onClaimDealership(d);
      });
      upsertSlots(
        created,
        created.length > 1
          ? `Added ${created.length} separate ${how === 'email' ? 'emails' : 'texts'} for ${formatDayShort(date)}`
          : `Added ${HOW_LABEL[how!].toLowerCase()} to ${created[0].target.name} for ${formatDayShort(date)}`
      );
      setAdded(created);
      go(1);
      return;
    }

    if (!draft) return;
    const daySlots = ctx.daySlots(date).filter(s => s.id !== draft.id);
    const lay = layoutDay(daySlots, { home, settings: engine });
    let index = lay.sequence.length;
    let slot: PlanSlot = { ...draft, date, status: 'planned', timeMode: 'flow', fixedTime: draft.locked ? draft.fixedTime : undefined };
    const ch = choice ?? (suggestions[0] ? { type: 'suggest' as const, s: suggestions[0] } : { type: 'mode' as const, mode: 'flow' as const });
    if (ch.type === 'suggest') index = ch.s.index;
    else if (ch.type === 'exact') {
      slot = { ...slot, timeMode: 'exact', fixedTime: ch.time };
      index = indexForTime(daySlots, { home, settings: engine }, ch.time);
    } else if (ch.type === 'mode') {
      slot = { ...slot, timeMode: ch.mode === 'flow' ? 'flow' : ch.mode };
      const pick =
        ch.mode === 'morning'
          ? suggestions.find(s => s.start < 12 * 60)
          : ch.mode === 'afternoon'
            ? suggestions.find(s => s.start >= 13 * 60)
            : undefined;
      index = pick ? pick.index : ch.mode === 'morning' ? 0 : lay.sequence.length;
    }
    let list = insertAt(daySlots, slot, index);
    const extras = tripExtras
      .map(id => dealershipById.get(id))
      .filter(Boolean)
      .map((d, i) => ({ ...draftSlotForDealership({ user: viewUser, dealership: d!, contacts, catalog, how: 'in_person', date }), notes: 'Trip day' }));
    extras.forEach((x, i) => (list = insertAt(list, x, index + 1 + i)));
    if (slot.target.kind === 'dealership') {
      const d = dealershipById.get(slot.target.id);
      if (d && d.stage === 'Pool') onClaimDealership(d);
    }
    const t = layoutDay(list, { home, settings: engine }).timings[slot.id];
    upsertSlots(
      list,
      `Added ${HOW_LABEL[slot.how].toLowerCase()} — ${slot.target.name}, ${formatDayShort(date)}${t ? ` at ${format12h(t.start)}` : ''}${extras.length ? ` (+${extras.length} nearby stops)` : ''}`
    );
    setAdded([slot, ...extras]);
    go(1);
  };

  // --- suggestions for "when" ---
  const suggestions: PlacementSuggestion[] = useMemo(() => {
    if (!draft || messageHow || step !== 'when') return [];
    const daySlots = ctx.daySlots(date).filter(s => s.id !== draft.id);
    return suggestPlacements(daySlots, { ...draft, date, status: 'planned' }, { home, settings: engine });
  }, [draft, date, step, messageHow, ctx, home, engine]);

  const roomElsewhere = useMemo(() => {
    if (!draft || messageHow || step !== 'when' || suggestions.some(s => s.fits)) return undefined;
    let d = date;
    for (let i = 0; i < 6; i++) {
      d = nextWeekday(d);
      const s = suggestPlacements(ctx.daySlots(d).filter(x => x.id !== draft.id), { ...draft, date: d, status: 'planned' }, { home, settings: engine }, 1)[0];
      if (s?.fits) return { date: d, s };
    }
    return undefined;
  }, [draft, date, step, messageHow, suggestions, ctx, home, engine]);

  const nextDisabled =
    (step === 'tasks' && !isBatch && (!draft || draft.tasks.length === 0)) ||
    (step === 'tasks' && isBatch && purpose === 'pitch' && batchProducts.length === 0) ||
    (step === 'how' && !how) ||
    (step === 'pick' && isBatch && multi.length === 0);

  const footer =
    step === 'start' || step === 'done' || (step === 'pick' && !isBatch) ? undefined : step === 'when' ? (
      <Button variant="primary" size="lg" block onClick={confirm} icon={<CheckCircle2 className="h-5 w-5" />}>
        {messageHow ? 'Add to my plan' : 'Add to my plan'}
      </Button>
    ) : step === 'how' && planLater ? (
      <Button variant="primary" size="lg" block onClick={confirm} disabled={!how} icon={<Inbox className="h-5 w-5" />}>
        Put in my plan-later basket
      </Button>
    ) : (
      <Button variant="primary" size="lg" block onClick={() => go(1)} disabled={nextDisabled}>
        {step === 'pick' ? `Continue with ${multi.length} dealership${multi.length === 1 ? '' : 's'}` : 'Next'}
      </Button>
    );

  const titles: Record<Step, string> = {
    start: planLater ? 'Plan later' : 'Add to my plan',
    how: 'How will you contact them?',
    pick: isBatch ? 'Who should get it?' : 'Choose a dealership',
    tasks: isBatch ? 'What is it about?' : 'What will you do?',
    who: 'Who will you speak with?',
    message: 'Your message',
    when: messageHow ? 'When should it go out?' : basketSlot ? `When will you do ${basketSlot.target.name}?` : 'When?',
    done: 'Added'
  };

  return (
    <Sheet
      title={titles[step]}
      step={step !== 'done' && visibleSteps.length > 1 ? { current: visibleSteps.indexOf(step) + 1, total: visibleSteps.length } : undefined}
      summary={step !== 'start' ? summary : undefined}
      onBack={step === 'done' ? undefined : back}
      onClose={onClose}
      footer={footer}
    >
      {step === 'start' && (
        <div className="space-y-3">
          <p className="text-[17px] text-slate-700">How would you like to start?</p>
          <ChoiceCard
            onClick={() => {
              setEntry('dealership');
              setStepIndex(1);
            }}
            icon={<Building2 className="h-8 w-8 text-blue-600" />}
            title="Choose a dealership"
            subtitle="Pick a prospect, a sign-up, a client or a dealer group"
          />
          <ChoiceCard
            onClick={() => {
              setEntry('activity');
              setStepIndex(1);
            }}
            icon={<ListChecks className="h-8 w-8 text-blue-600" />}
            title="Choose what to do"
            subtitle="Visit, call, Google Meet, or email / text several at once"
          />
        </div>
      )}

      {step === 'how' && (
        <div className="space-y-3">
          <HowPicker value={how} onChange={h => chooseHow(h)} />
        </div>
      )}

      {step === 'pick' && (
        <Picker
          multi={isBatch}
          selected={multi}
          onToggle={id => setMulti(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))}
          onPick={pickTarget}
          allowGroups={!isBatch}
        />
      )}

      {step === 'tasks' && !isBatch && draft && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <WorkChip workType={draft.workType} />
            <span className="text-[15px] text-slate-600">Tick everything you plan to do — you can pick more than one.</span>
          </div>
          <TasksEditor
            workType={draft.workType}
            dealership={draft.target.kind === 'dealership' ? dealershipById.get(draft.target.id) : undefined}
            tasks={draft.tasks}
            onChange={tasks => setDraftPatch({ tasks })}
          />
          {planLater && (
            <label className="block">
              <span className="text-[15px] font-semibold text-slate-700">Note for later (optional)</span>
              <input
                className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]"
                placeholder="e.g. GM back from vacation next week"
                value={draft.basketNote ?? ''}
                onChange={e => setDraftPatch({ basketNote: e.target.value })}
              />
            </label>
          )}
        </div>
      )}

      {step === 'tasks' && isBatch && (
        <div className="space-y-3">
          <p className="text-[16px] text-slate-600">One choice for all {multi.length}. Each dealership still gets its own separate slot.</p>
          {BATCH_PURPOSES.map(p => (
            <ChoiceCard
              key={p.id}
              selected={purpose === p.id}
              onClick={() => {
                setPurpose(p.id);
                setMessage(DEFAULT_MESSAGE[p.id]);
              }}
              title={p.label}
              subtitle={p.hint}
            />
          ))}
          {purpose === 'pitch' && (
            <Card className="p-3">
              <div className="mb-2 text-[15px] font-semibold text-slate-700">Which products?</div>
              <div className="flex flex-wrap gap-2">
                {catalog
                  .filter(p => p.isActive)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={batchProducts.includes(p.id)}
                      onClick={() => setBatchProducts(b => (b.includes(p.id) ? b.filter(x => x !== p.id) : [...b, p.id]))}
                      className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold ${
                        batchProducts.includes(p.id) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 'who' && draft && <ContactsEditor slot={draft} onChange={setDraftPatch} />}

      {step === 'message' && (
        <div className="space-y-3">
          <p className="text-[16px] text-slate-600">
            {isBatch ? `This goes to each of the ${multi.length} dealerships separately. ` : ''}
            <span className="font-semibold">{'{first name}'}</span> is filled in for each person. You can change any single one later.
          </p>
          <textarea
            className="min-h-[160px] w-full rounded-2xl border border-slate-300 p-4 text-[17px] leading-relaxed"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
        </div>
      )}

      {step === 'when' && (
        <WhenStep
          draft={draft}
          messageHow={messageHow ? (how as 'email' | 'text') : undefined}
          batchCount={isBatch ? multi.length : 1}
          date={date}
          setDate={d => {
            setDate(d);
            setChoice(null);
          }}
          suggestions={suggestions}
          choice={choice}
          setChoice={setChoice}
          ownTime={ownTime}
          setOwnTime={setOwnTime}
          sendTime={sendTime}
          setSendTime={setSendTime}
          roomElsewhere={roomElsewhere}
          tripExtras={tripExtras}
          setTripExtras={setTripExtras}
          onPlanLater={
            draft && !messageHow
              ? () => {
                  addSlots([{ ...draft, date: undefined, status: 'basket' }], `Added ${draft.target.name} to your plan-later basket`);
                  setAdded([{ ...draft, date: undefined, status: 'basket' }]);
                  setStepIndex(steps.indexOf('done'));
                }
              : undefined
          }
        />
      )}

      {step === 'done' && added && <DoneStep added={added} date={date} onClose={onClose} />}
    </Sheet>
  );
};

type PlanSuggestionLike = PlacementSuggestion;

// ---------- Step: pick a dealership ----------

const Picker: React.FC<{
  multi: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onPick: (t: { kind: 'dealership'; d: Dealership } | { kind: 'group'; g: DealerGroup }) => void;
  allowGroups: boolean;
}> = ({ multi, selected, onToggle, onPick, allowGroups }) => {
  const { viewUser, dealerships, groups, home, engine, suggestions, slots, today, onAddDealership } = useMyPlan();
  const [tab, setTab] = useState<Tab>('prospect');
  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [stateFilter, setStateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fiFilter, setFiFilter] = useState('');
  const [showPool, setShowPool] = useState(false);
  const [adding, setAdding] = useState(false);

  const mine = dealerships.filter(d => d.assignedRepId === viewUser.id && workTypeForStage(d.stage));
  const pool = dealerships.filter(d => d.stage === 'Pool' && !d.assignedRepId);
  const myGroupIds = new Set(mine.map(d => d.groupId).filter(Boolean) as string[]);
  const myGroups = groups.filter(g => myGroupIds.has(g.id) || g.groupAccountOwnerId === viewUser.id);
  const planned = new Map<string, string>();
  slots
    .filter(s => s.userId === viewUser.id && s.date && s.date >= today && s.status === 'planned')
    .forEach(s => planned.set(s.target.id, s.date!));
  const inBasket = new Set(slots.filter(s => s.userId === viewUser.id && s.status === 'basket').map(s => s.target.id));

  const withMiles = (list: Dealership[]) =>
    list.map(d => ({ d, miles: milesBetween(home, d.coordinates) })).map(x => ({ ...x, band: distanceBand(x.miles, engine) }));

  const counts: Record<Tab, number> = {
    prospect: mine.filter(d => workTypeForStage(d.stage) === 'prospect').length,
    signup: mine.filter(d => workTypeForStage(d.stage) === 'signup').length,
    client: mine.filter(d => workTypeForStage(d.stage) === 'client').length,
    group: myGroups.length
  };

  const source = showPool ? pool : mine.filter(d => workTypeForStage(d.stage) === tab);
  const q = query.trim().toLowerCase();
  let rows = withMiles(source).filter(({ d }) => {
    if (q && !`${d.dealershipName} ${d.city} ${d.state} ${d.primaryContactName ?? ''}`.toLowerCase().includes(q)) return false;
    if (stateFilter && d.state !== stateFilter) return false;
    if (typeFilter && d.dealershipType !== typeFilter) return false;
    if (fiFilter && d.fiSystem !== fiFilter) return false;
    if (quick === 'due' && !(suggestions.get(d.id)?.score ?? 0)) return false;
    if (quick === 'hot' && d.heatLevel !== 'Hot') return false;
    if (quick === 'priority' && !suggestions.get(d.id)?.priorityFrom) return false;
    if (quick === 'basket' && !inBasket.has(d.id)) return false;
    if (quick === 'quiet') {
      const days = d.lastTouchpointDate ? (parseISODate(today).getTime() - new Date(d.lastTouchpointDate).getTime()) / 86400000 : 999;
      if (days < 14) return false;
    }
    if (quick === 'nearby' && (milesBetween(home, d.coordinates) > 25)) return false;
    return true;
  });
  rows = rows.sort((a, b) => {
    if (showPool || quick === 'nearby') return a.miles - b.miles;
    const sa = suggestions.get(a.d.id)?.score ?? 0;
    const sb = suggestions.get(b.d.id)?.score ?? 0;
    return sb - sa || a.miles - b.miles;
  });

  const stateOptions = Array.from(new Set(source.map(d => d.state))).sort();
  const fiOptions = Array.from(new Set(source.map(d => d.fiSystem))).sort();

  const quickFilters = [
    { id: 'due', label: 'Suggested' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'hot', label: 'Hot' },
    { id: 'priority', label: 'Manager priority' },
    { id: 'quiet', label: 'Not contacted lately' },
    { id: 'basket', label: 'In basket' }
  ];

  if (adding) return <NewDealershipForm onCancel={() => setAdding(false)} onCreate={d => { onAddDealership(d); onPick({ kind: 'dealership', d }); }} />;

  return (
    <div>
      {!showPool ? (
        <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Dealership status">
          {(['prospect', 'signup', 'client', ...(allowGroups ? ['group' as Tab] : [])] as Tab[]).map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-[52px] shrink-0 rounded-xl border-2 px-4 text-[16px] font-bold transition ${
                tab === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {TAB_LABEL[t]} <span className={`ml-1 rounded-full px-2 text-[14px] ${tab === t ? 'bg-white/20' : 'bg-slate-100'}`}>{counts[t]}</span>
            </button>
          ))}
        </div>
      ) : (
        <Card className="mb-3 flex items-center justify-between gap-2 border-blue-200 bg-blue-50 p-3">
          <span className="text-[16px] font-semibold text-blue-900">Prospect pool — closest first. Planning one claims it for you.</span>
          <Button variant="secondary" onClick={() => setShowPool(false)}>
            Back to my list
          </Button>
        </Card>
      )}

      {tab === 'group' && !showPool ? (
        <div className="space-y-2">
          {myGroups.length === 0 && <p className="text-[16px] text-slate-600">You have no dealer groups yet.</p>}
          {myGroups.map(g => {
            const rooftops = dealerships.filter(d => d.groupId === g.id);
            return (
              <ChoiceCard
                key={g.id}
                onClick={() => onPick({ kind: 'group', g })}
                icon={<Users className="h-7 w-7 text-violet-600" />}
                title={g.name}
                subtitle={`${rooftops.length} rooftops · HQ ${g.hqCity}, ${g.hqState} · ${g.mainDecisionMaker}`}
              />
            );
          })}
        </div>
      ) : (
        <>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="min-h-[52px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-[17px]"
              placeholder="Search by name or city"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search dealerships"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickFilters.map(f => (
              <button
                key={f.id}
                type="button"
                aria-pressed={quick === f.id}
                onClick={() => setQuick(quick === f.id ? null : f.id)}
                className={`min-h-[40px] rounded-full border px-3 text-[14px] font-semibold ${
                  quick === f.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMoreOpen(o => !o)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-700"
            >
              <SlidersHorizontal className="h-4 w-4" /> More filters
            </button>
          </div>
          {moreOpen && (
            <Card className="mt-2 grid gap-2 p-3 sm:grid-cols-3">
              <Select label="State" value={stateFilter} onChange={setStateFilter} options={stateOptions} />
              <Select label="Type" value={typeFilter} onChange={setTypeFilter} options={['Standalone', 'Dealer Group']} />
              <Select label="F&I system" value={fiFilter} onChange={setFiFilter} options={fiOptions} />
            </Card>
          )}

          <div className="mt-3 space-y-2">
            {rows.length === 0 && <p className="py-4 text-center text-[16px] text-slate-600">No dealerships match. Try another tab or clear the filters.</p>}
            {rows.map(({ d, miles, band }) => {
              const sug = suggestions.get(d.id);
              const isSelected = selected.includes(d.id);
              const plannedOn = planned.get(d.id);
              const body = (
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[17px] font-bold text-slate-900">{d.dealershipName}</span>
                    {d.heatLevel === 'Hot' && workTypeForStage(d.stage) === 'prospect' && (
                      <span className="rounded-full bg-rose-100 px-2 text-[13px] font-bold text-rose-700">HOT</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] text-slate-600">
                    <span>
                      {d.city}, {d.state} · {d.stage}
                    </span>
                    <BandChip band={band} miles={miles} />
                  </div>
                  {sug && (
                    <div className="mt-1 flex items-center gap-1.5 text-[15px] font-medium text-blue-800">
                      <Sparkles className="h-4 w-4 shrink-0" /> {sug.reason}
                    </div>
                  )}
                  {(plannedOn || inBasket.has(d.id)) && (
                    <div className="mt-1 text-[14px] text-slate-500">
                      {plannedOn ? `Already planned · ${formatDayShort(plannedOn)}` : 'In your plan-later basket'}
                    </div>
                  )}
                </div>
              );
              return multi ? (
                <label
                  key={d.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 bg-white p-3 ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}
                >
                  <input type="checkbox" className="mt-1 h-6 w-6 accent-blue-600" checked={isSelected} onChange={() => onToggle(d.id)} />
                  {body}
                </label>
              ) : (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onPick({ kind: 'dealership', d })}
                  className="flex w-full items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left hover:border-blue-400"
                >
                  {body}
                  <span className="self-center rounded-xl bg-blue-600 px-3 py-2 text-[15px] font-semibold text-white">Choose</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {!showPool && (
              <Button variant="secondary" size="lg" icon={<Compass className="h-5 w-5" />} onClick={() => setShowPool(true)}>
                Find more nearby (pool)
              </Button>
            )}
            <Button variant="secondary" size="lg" icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
              Add a new dealership
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

const Select: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-[14px] font-medium text-slate-600">{label}</span>
    <select className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[16px]" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Any</option>
      {options.map(o => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </label>
);

const NewDealershipForm: React.FC<{ onCancel: () => void; onCreate: (d: Dealership) => void }> = ({ onCancel, onCreate }) => {
  const { viewUser, dealerships } = useMyPlan();
  const [form, setForm] = useState({ name: '', city: '', state: '', zip: '' });
  const create = () => {
    const near = dealerships.find(d => d.zipCode?.slice(0, 3) === form.zip.slice(0, 3)) ?? dealerships.find(d => d.city.toLowerCase() === form.city.trim().toLowerCase());
    const coords = near?.coordinates ?? viewUser.homeCoords;
    const now = new Date().toISOString();
    const template = dealerships[0];
    const d: Dealership = {
      ...template,
      id: newId('deal'),
      dealershipName: form.name.trim(),
      groupId: null,
      groupName: undefined,
      dealershipType: 'Standalone',
      rooftopCount: 1,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      zipCode: form.zip.trim(),
      address: '',
      phone: '',
      coordinates: coords,
      stage: 'Claimed',
      heatLevel: 'Cold',
      source: 'Manual Search',
      assignedRepId: viewUser.id,
      originRepId: viewUser.id,
      claimedAt: now,
      lastTouchpointDate: null,
      productInterests: [],
      signedProducts: [],
      topups: [],
      upsells: [],
      hasActiveAssist: false,
      activeAssistId: undefined,
      inventoryHistory: [],
      createdAt: now,
      updatedAt: now
    };
    onCreate(d);
  };
  return (
    <Card className="space-y-3 p-4">
      <div className="text-[18px] font-bold text-slate-900">Add a new dealership</div>
      <p className="text-[15px] text-slate-600">It’s added to your prospects. You can fill in the rest of the details later.</p>
      {(
        [
          ['name', 'Dealership name'],
          ['city', 'City'],
          ['state', 'State (e.g. TX)'],
          ['zip', 'ZIP code']
        ] as const
      ).map(([k, l]) => (
        <label key={k} className="block">
          <span className="text-[15px] font-medium text-slate-700">{l}</span>
          <input className="mt-1 min-h-[48px] w-full rounded-xl border border-slate-300 px-3 text-[16px]" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
        </label>
      ))}
      <div className="flex gap-2">
        <Button variant="primary" disabled={!form.name.trim() || !form.city.trim()} onClick={create}>
          Add and continue
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Card>
  );
};

// ---------- Step: when ----------

const WhenStep: React.FC<{
  draft: PlanSlot | null;
  messageHow?: 'email' | 'text';
  batchCount: number;
  date: string;
  setDate: (d: string) => void;
  suggestions: PlacementSuggestion[];
  choice: any;
  setChoice: (c: any) => void;
  ownTime: string;
  setOwnTime: (t: string) => void;
  sendTime?: string;
  setSendTime: (t: string) => void;
  roomElsewhere?: { date: string; s: PlacementSuggestion };
  tripExtras: string[];
  setTripExtras: (ids: string[]) => void;
  onPlanLater?: () => void;
}> = props => {
  const { draft, messageHow, date, setDate, suggestions, choice, setChoice, ownTime, setOwnTime, roomElsewhere, tripExtras, setTripExtras, onPlanLater } = props;
  const { home, engine, dealerships, viewUser } = useMyPlan();

  if (messageHow) {
    const suggested = suggestSendTime(messageHow, date);
    const value = props.sendTime ?? suggested;
    const advice = sendTimeAdvice(messageHow, date, value);
    return (
      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[17px] font-bold text-slate-900">Which day?</div>
          <DayChooser value={date} onChange={setDate} />
        </div>
        <div>
          <div className="mb-2 text-[17px] font-bold text-slate-900">What time should it go out?</div>
          <div className="flex flex-wrap items-center gap-3">
            <ChoiceCard
              selected={value === suggested}
              onClick={() => props.setSendTime(suggested)}
              title={`${format12h(suggested)} (recommended)`}
              subtitle={messageHow === 'email' ? 'Dealers read email best mid-morning or early afternoon' : 'Texts get the quickest replies late morning'}
            />
          </div>
          <label className="mt-3 flex items-center gap-3 text-[16px] text-slate-700">
            <span className="font-medium">Or pick a time:</span>
            <input type="time" className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]" value={value} onChange={e => props.setSendTime(e.target.value)} />
          </label>
          {props.batchCount > 1 && (
            <p className="mt-2 text-[15px] text-slate-600">
              Each one is sent separately, a few minutes apart, starting at {format12h(value)}.
            </p>
          )}
          {advice && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">{advice}</p>}
          <p className="mt-2 text-[15px] text-slate-500">Write or check them whenever suits you — before 10 AM or after 4 PM keeps your visit time free.</p>
        </div>
      </div>
    );
  }

  if (!draft) return null;
  const miles = draft.target.coords ? milesBetween(home, draft.target.coords) : 0;
  const outOfTown = draft.how === 'in_person' && distanceBand(miles, engine) === 'out_of_town';
  const nearby = outOfTown && draft.target.coords
    ? dealerships
        .filter(d => d.assignedRepId === viewUser.id && d.id !== draft.target.id && workTypeForStage(d.stage))
        .map(d => ({ d, m: milesBetween(draft.target.coords!, d.coordinates) }))
        .filter(x => x.m <= 15)
        .sort((a, b) => a.m - b.m)
        .slice(0, 5)
    : [];

  const isChosen = (c: any) => JSON.stringify(c) === JSON.stringify(choice ?? (suggestions[0] ? { type: 'suggest', s: suggestions[0] } : null));

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-[17px] font-bold text-slate-900">Which day?</div>
        <DayChooser value={date} onChange={setDate} />
      </div>

      {outOfTown && (
        <Card className="border-rose-200 bg-rose-50 p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-5 w-5 text-rose-600" />
            <div>
              <div className="text-[17px] font-bold text-rose-900">This is about a {Math.round(((miles * 1.3) / 50) * 2 * 10) / 10}-hour round trip</div>
              <p className="text-[15px] text-rose-900">Out-of-town visits work best as a trip day with a few stops close together.</p>
            </div>
          </div>
          {nearby.length > 0 ? (
            <div className="mt-3 space-y-2">
              <div className="text-[15px] font-semibold text-rose-900">Add nearby stops to the same day:</div>
              {nearby.map(({ d, m }) => (
                <Checkbox
                  key={d.id}
                  checked={tripExtras.includes(d.id)}
                  onChange={v => setTripExtras(v ? [...tripExtras, d.id] : tripExtras.filter(x => x !== d.id))}
                  label={d.dealershipName}
                  hint={`${Math.round(m)} mi from ${draft.target.name} · ${d.stage}`}
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[15px] text-rose-900">No other dealerships of yours are near it. Consider asking your manager before a single-stop trip.</p>
          )}
        </Card>
      )}

      <div>
        <div className="mb-2 text-[17px] font-bold text-slate-900">Best times on {formatDayLong(date)}</div>
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <ChoiceCard
              key={s.index}
              selected={isChosen({ type: 'suggest', s })}
              onClick={() => setChoice({ type: 'suggest', s })}
              title={`${i === 0 && s.fits ? '✅ ' : ''}${s.label}`}
              subtitle={s.reason}
            />
          ))}
          {!suggestions.some(s => s.fits) && (
            <Card className="border-amber-300 bg-amber-50 p-3 text-[15px] text-amber-950">
              This day is already full.
              {roomElsewhere && (
                <Button variant="secondary" className="ml-2 mt-2" onClick={() => setDate(roomElsewhere.date)}>
                  {formatDayShort(roomElsewhere.date)} has room at {roomElsewhere.s.label}
                </Button>
              )}
            </Card>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 text-[17px] font-bold text-slate-900">Or</div>
        <Segmented
          ariaLabel="Flexible time"
          value={choice?.type === 'mode' ? choice.mode : undefined}
          onChange={v => setChoice({ type: 'mode', mode: v })}
          options={[
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
            { value: 'flow', label: 'Anytime that day' }
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[16px] font-medium text-slate-700">Pick my own time:</span>
          <input
            type="time"
            className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]"
            value={ownTime}
            onChange={e => {
              setOwnTime(e.target.value);
              setChoice({ type: 'exact', time: e.target.value });
            }}
          />
          <Button variant={choice?.type === 'exact' ? 'primary' : 'secondary'} onClick={() => setChoice({ type: 'exact', time: ownTime })}>
            Use {format12h(ownTime)}
          </Button>
        </div>
        {choice?.type === 'exact' && (toMin(ownTime) < 600 || toMin(ownTime) + draft.durationMin > 960) && (
          <p className="mt-2 rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">Dealerships are usually busy before 10 AM and after 4 PM. You can still keep this time.</p>
        )}
      </div>

      {onPlanLater && (
        <Button variant="ghost" icon={<Inbox className="h-5 w-5" />} onClick={onPlanLater}>
          Not sure yet — put it in my plan-later basket
        </Button>
      )}
    </div>
  );
};

// ---------- Done ----------

const DoneStep: React.FC<{ added: PlanSlot[]; date: string; onClose: () => void }> = ({ added, date, onClose }) => {
  const { viewUser, dealerships, openSheet, catalog } = useMyPlan();
  const first = added[0];
  const inBasket = first.status === 'basket';
  const nearby =
    !inBasket && first.how === 'in_person' && first.target.coords
      ? dealerships
          .filter(d => d.assignedRepId === viewUser.id && d.id !== first.target.id && workTypeForStage(d.stage) && !added.some(a => a.target.id === d.id))
          .map(d => ({ d, m: milesBetween(first.target.coords!, d.coordinates) }))
          .filter(x => x.m <= 10)
          .sort((a, b) => a.m - b.m)
          .slice(0, 3)
      : [];
  void catalog;
  return (
    <div className="space-y-5">
      <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50 p-4">
        <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
        <div>
          <div className="text-[18px] font-bold text-emerald-900">
            {inBasket
              ? `${first.target.name} is in your plan-later basket`
              : added.length > 1
                ? `${added.length} slots added for ${formatDayShort(date)}`
                : `${first.target.name} added for ${formatDayShort(date)}`}
          </div>
          <p className="text-[15px] text-emerald-900">{inBasket ? 'Pull it into a day when you plan your week.' : 'You can change it any time — tap the card.'}</p>
        </div>
      </Card>
      {nearby.length > 0 && (
        <div>
          <div className="mb-2 text-[17px] font-bold text-slate-900">
            {nearby.length} more dealership{nearby.length === 1 ? '' : 's'} within 10 miles — add one?
          </div>
          <div className="space-y-2">
            {nearby.map(({ d, m }) => (
              <ChoiceCard
                key={d.id}
                onClick={() => openSheet({ kind: 'add', preset: { dealershipId: d.id, date, nonce: Date.now() } })}
                icon={<Building2 className="h-6 w-6" />}
                title={d.dealershipName}
                subtitle={`${Math.round(m)} mi away · ${WORK_TYPE_LABEL[workTypeForStage(d.stage)!]} · ${d.stage}`}
              />
            ))}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" size="lg" onClick={onClose}>
          Done
        </Button>
        <Button variant="secondary" size="lg" icon={<Plus className="h-5 w-5" />} onClick={() => openSheet({ kind: 'add', preset: { date, nonce: Date.now() } })}>
          Add another
        </Button>
      </div>
    </div>
  );
};

export { TASK_BY_ID, HOW_ICON };
