// Form pieces shared by the Add flow and the Edit screen.

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Contact, Dealership } from '../../../types/crm';
import { HowType, PlanSlot, SlotTask, WorkType } from '../types';
import { HOW_LABEL, TASK_BY_ID, tasksForWorkType } from '../engine/tasks';
import { addDays, formatDayShort, nextWeekday, relativeDayLabel } from '../engine/time';
import { hasKeyfetch } from '../services/suggestions';
import { contactsFor } from '../data/seed';
import { Button, Checkbox, ChoiceCard, HOW_ICON } from './primitives';
import { ContactForm } from '../../../components/forms/ContactForm';
import { isKeyDecisionMaker } from '../../../data/jobTitles';
import { useMyPlan } from './context';
import { defaultProducts, productOptions } from './slotHelpers';

export const HOW_ORDER: HowType[] = ['in_person', 'phone', 'meet', 'email', 'text'];

const HOW_HINT: Record<HowType, string> = {
  in_person: 'Go to the dealership',
  phone: 'Call one person',
  meet: 'Video call on Google Meet',
  email: 'You can pick several dealerships',
  text: 'You can pick several dealerships'
};

export const HowPicker: React.FC<{ value?: HowType; onChange: (h: HowType) => void; only?: HowType[] }> = ({ value, onChange, only }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    {(only ?? HOW_ORDER).map(h => {
      const Icon = HOW_ICON[h];
      return (
        <ChoiceCard
          key={h}
          selected={value === h}
          onClick={() => onChange(h)}
          icon={<Icon className="h-7 w-7" />}
          title={HOW_LABEL[h]}
          subtitle={HOW_HINT[h]}
        />
      );
    })}
  </div>
);

/** Task checkboxes for the stage, with product choices inline. */
export const TasksEditor: React.FC<{
  workType: WorkType;
  dealership?: Dealership;
  tasks: SlotTask[];
  onChange: (t: SlotTask[]) => void;
}> = ({ workType, dealership, tasks, onChange }) => {
  const { catalog } = useMyPlan();
  const keyfetch = dealership ? hasKeyfetch(dealership, catalog) : false;
  const options = tasksForWorkType(workType, keyfetch);
  const isOn = (id: string) => tasks.some(t => t.taskId === id);

  const toggle = (id: string, on: boolean) => {
    if (on) {
      const products = defaultProducts(id, dealership, catalog);
      onChange([...tasks, products.length ? { taskId: id, productIds: products } : { taskId: id }]);
    } else {
      onChange(tasks.filter(t => t.taskId !== id));
    }
  };

  const toggleProduct = (taskId: string, productId: string) =>
    onChange(
      tasks.map(t => {
        if (t.taskId !== taskId) return t;
        const set = new Set(t.productIds ?? []);
        if (set.has(productId)) set.delete(productId);
        else set.add(productId);
        return { ...t, productIds: [...set] };
      })
    );

  return (
    <div className="space-y-2">
      {options.map(def => {
        const on = isOn(def.id);
        const task = tasks.find(t => t.taskId === def.id);
        const products = def.products ? productOptions(def.id, dealership, catalog) : [];
        return (
          <div key={def.id}>
            <Checkbox checked={on} onChange={v => toggle(def.id, v)} label={def.label} hint={def.hint} />
            {on && def.products && (
              <div className="ml-4 mt-2 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[15px] font-semibold text-slate-700">
                  {def.products === 'not_owned' ? 'Which products? (ones they don’t have yet)' : 'Which products?'}
                </div>
                {products.length === 0 ? (
                  <div className="text-[15px] text-slate-500">They already have every product.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {products.map(p => {
                      const chosen = task?.productIds?.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          aria-pressed={chosen}
                          onClick={() => toggleProduct(def.id, p.id)}
                          className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold transition ${
                            chosen ? 'border-blue-600 bg-brand text-onaccent' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {p.name}
                          {p.isNewLaunch ? ' ✨' : ''}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {tasks.length === 0 && <p className="text-[15px] text-amber-700">Pick at least one thing to do.</p>}
    </div>
  );
};

/** Choose who to speak with: existing contacts, or add a new one. Groups also choose rooftops. */
export const ContactsEditor: React.FC<{
  slot: Pick<PlanSlot, 'target' | 'contactIds' | 'contactNames' | 'how'>;
  onChange: (patch: Partial<PlanSlot>) => void;
  label?: string;
}> = ({ slot, onChange, label = 'Who will you speak with?' }) => {
  const { contacts, dealerships, groups, onAddContact, user } = useMyPlan();
  const [adding, setAdding] = useState(false);

  const isGroup = slot.target.kind === 'group';
  const group = isGroup ? groups.find(g => g.id === slot.target.id) : undefined;
  const rooftops = isGroup ? dealerships.filter(d => d.groupId === slot.target.id) : [];
  const contactPool: Contact[] = isGroup
    ? (slot.target.rooftopIds ?? []).flatMap(id => contactsFor(id, contacts))
    : contactsFor(slot.target.id, contacts);

  const selected = new Set(slot.contactIds);
  const toggleContact = (c: Contact) => {
    const next = new Set(selected);
    if (next.has(c.id)) next.delete(c.id);
    else next.add(c.id);
    const ids = [...next];
    const names = ids.map(id => contactPool.find(x => x.id === id)).filter(Boolean).map(x => `${x!.firstName} ${x!.lastName}`);
    onChange({ contactIds: ids, contactNames: names.length ? names : group ? [group.mainDecisionMaker] : [] });
  };

  const toggleRooftop = (id: string) => {
    const set = new Set(slot.target.rooftopIds ?? []);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ target: { ...slot.target, rooftopIds: [...set] } });
  };

  const addTo = isGroup ? slot.target.rooftopIds?.[0] ?? rooftops[0]?.id : slot.target.id;
  const addToName = isGroup ? dealerships.find(d => d.id === addTo)?.dealershipName : slot.target.name;
  const saved = (c: Contact) => {
    onAddContact(c);
    onChange({ contactIds: [...slot.contactIds, c.id], contactNames: [...slot.contactNames.filter(n => n !== group?.mainDecisionMaker), `${c.firstName} ${c.lastName}`] });
    setAdding(false);
  };

  return (
    <div className="space-y-4">
      {isGroup && (
        <div>
          <div className="mb-2 text-[17px] font-bold text-slate-900">Which rooftops does this cover?</div>
          <div className="space-y-2">
            {rooftops.map(r => (
              <Checkbox
                key={r.id}
                checked={(slot.target.rooftopIds ?? []).includes(r.id)}
                onChange={() => toggleRooftop(r.id)}
                label={r.dealershipName}
                hint={`${r.city}, ${r.state} · ${r.stage}`}
              />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="mb-2 text-[17px] font-bold text-slate-900">{label}</div>
        {group && (
          <p className="mb-2 text-[15px] text-slate-600">
            Group lead: <span className="font-semibold">{group.mainDecisionMaker}</span>
          </p>
        )}
        <div className="space-y-2">
          {contactPool.map(c => (
            <Checkbox
              key={c.id}
              checked={selected.has(c.id)}
              onChange={() => toggleContact(c)}
              label={`${c.firstName} ${c.lastName}${c.isDecisionMaker || isKeyDecisionMaker(c.jobTitle) ? ' ★' : ''}`}
              hint={[c.jobTitle, c.phone].filter(Boolean).join(' · ')}
            />
          ))}
          {contactPool.length === 0 && !adding && <p className="text-[15px] text-slate-600">No contacts saved yet for this dealership.</p>}
        </div>
        <Button variant="soft" className="mt-3" onClick={() => setAdding(true)} icon={<UserPlus className="h-5 w-5" />} disabled={!addTo}>
          Add a new contact
        </Button>
        {adding && addTo && (
          <ContactForm dealershipId={addTo} dealershipName={addToName} existingContacts={contacts} currentUser={user} onCancel={() => setAdding(false)} onSave={saved} />
        )}
      </div>
    </div>
  );
};

/** Big day buttons: Today, Tomorrow, the next weekdays, or any date. */
export const DayChooser: React.FC<{ value?: string; onChange: (d: string) => void }> = ({ value, onChange }) => {
  const { today } = useMyPlan();
  const days: string[] = [today];
  let d = today;
  while (days.length < 7) {
    d = nextWeekday(d);
    days.push(d);
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {days.map(x => (
          <button
            key={x}
            type="button"
            onClick={() => onChange(x)}
            aria-pressed={value === x}
            className={`min-h-[52px] rounded-xl border-2 px-4 text-[16px] font-semibold transition ${
              value === x ? 'border-blue-600 bg-brand text-onaccent' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
            }`}
          >
            {relativeDayLabel(x, today) === formatDayShort(x) ? formatDayShort(x) : `${relativeDayLabel(x, today)} · ${formatDayShort(x).split(', ')[0]}`}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-3 text-[16px] text-slate-700">
        <span className="font-medium">Another date:</span>
        <input
          type="date"
          className="min-h-[48px] rounded-xl border border-slate-300 px-3 text-[16px]"
          value={value ?? ''}
          min={addDays(today, -60)}
          onChange={e => e.target.value && onChange(e.target.value)}
        />
      </label>
    </div>
  );
};

export const taskLabels = (tasks: SlotTask[]) => tasks.map(t => TASK_BY_ID[t.taskId]?.label ?? t.taskId).join(', ');
