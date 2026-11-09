// "Add Contact to Roster" — the one contact form used everywhere in the CRM.

import React, { useState } from 'react';
import { AlertTriangle, Contact as ContactIcon, Star } from 'lucide-react';
import { Contact, User } from '../../types/crm';
import { isKeyDecisionMaker, KEY_DECISION_MAKER_TITLES, OTHER_TITLE, OTHER_TITLES } from '../../data/jobTitles';
import { newRecordId } from '../../utils/dealershipFactory';
import { Field, FormShell, inputCls } from './FormShell';
import { Btn } from '../ui/kit';

const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

export const ContactForm: React.FC<{
  dealershipId: string;
  dealershipName?: string;
  existingContacts: Contact[];
  currentUser: User;
  onCancel: () => void;
  onSave: (c: Contact) => void;
  /** Pre-filled values (e.g. editing). */
  initial?: Partial<Contact>;
}> = ({ dealershipId, dealershipName, existingContacts, currentUser, onCancel, onSave, initial }) => {
  const [f, setF] = useState({
    firstName: initial?.firstName ?? '',
    lastName: initial?.lastName ?? '',
    jobTitle: initial?.jobTitle ?? '',
    customTitle: initial?.customTitle ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    linkedInUrl: initial?.linkedInUrl ?? '',
    otherSocials: initial?.otherSocials ?? '',
    notes: initial?.notes ?? '',
    isDecisionMaker: initial?.isDecisionMaker ?? false
  });
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const set = (p: Partial<typeof f>) => setF(prev => ({ ...prev, ...p }));

  const chooseTitle = (title: string) => set({ jobTitle: title, isDecisionMaker: isKeyDecisionMaker(title) ? true : title === OTHER_TITLE ? f.isDecisionMaker : false });

  const dupes = existingContacts.filter(
    c =>
      c.dealershipId === dealershipId &&
      c.id !== initial?.id &&
      ((f.email && c.email.toLowerCase() === f.email.trim().toLowerCase()) ||
        (digits(f.phone).length === 10 && digits(c.phone) === digits(f.phone)) ||
        (f.firstName && f.lastName && `${c.firstName} ${c.lastName}`.toLowerCase() === `${f.firstName} ${f.lastName}`.trim().toLowerCase()))
  );
  const valid = f.firstName.trim() && f.lastName.trim() && f.jobTitle && (f.jobTitle !== OTHER_TITLE || f.customTitle.trim());

  const save = () => {
    if (!valid) return;
    if (dupes.length && !confirmDuplicate) {
      setConfirmDuplicate(true);
      return;
    }
    onSave({
      id: initial?.id ?? newRecordId('cont'),
      dealershipId,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      jobTitle: f.jobTitle === OTHER_TITLE ? f.customTitle.trim() : f.jobTitle,
      customTitle: f.jobTitle === OTHER_TITLE ? f.customTitle.trim() : undefined,
      phone: f.phone.trim(),
      email: f.email.trim(),
      linkedInUrl: f.linkedInUrl.trim() || undefined,
      otherSocials: f.otherSocials.trim() || undefined,
      notes: f.notes.trim() || undefined,
      isDecisionMaker: f.isDecisionMaker,
      createdByUserId: currentUser.id,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <FormShell
      title={initial?.id ? 'Edit contact' : 'Add a contact'}
      icon={<ContactIcon className="h-6 w-6" />}
      onClose={onCancel}
      footer={
        <>
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn variant="primary" onClick={save} disabled={!valid}>
            {confirmDuplicate ? 'Save anyway' : initial?.id ? 'Save' : 'Add contact'}
          </Btn>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {dealershipName && <p className="text-[15px] text-slate-600 sm:col-span-2">For {dealershipName}</p>}
        <Field label="First name" required>
          <input className={inputCls} value={f.firstName} onChange={e => set({ firstName: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Last name" required>
          <input className={inputCls} value={f.lastName} onChange={e => set({ lastName: e.target.value })} autoComplete="off" />
        </Field>
        <Field label="Job title" required className="sm:col-span-2">
          <select className={inputCls} value={f.jobTitle} onChange={e => chooseTitle(e.target.value)}>
            <option value="">Choose a title…</option>
            <optgroup label="★ Key decision makers">
              {KEY_DECISION_MAKER_TITLES.map(t => (
                <option key={t} value={t}>
                  ★ {t}
                </option>
              ))}
            </optgroup>
            <optgroup label="Other roles">
              {OTHER_TITLES.map(t => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER_TITLE}>Other (type it in)</option>
            </optgroup>
          </select>
        </Field>
        {f.jobTitle === OTHER_TITLE && (
          <Field label="Their job title" required className="sm:col-span-2">
            <input className={inputCls} value={f.customTitle} onChange={e => set({ customTitle: e.target.value })} placeholder="e.g. Fleet Manager" />
          </Field>
        )}
        <Field label="Direct phone">
          <input className={inputCls} type="tel" inputMode="tel" value={f.phone} onChange={e => set({ phone: e.target.value })} placeholder="(555) 555-5555" />
        </Field>
        <Field label="Email">
          <input className={inputCls} type="email" inputMode="email" value={f.email} onChange={e => set({ email: e.target.value })} />
        </Field>
        <Field label="LinkedIn">
          <input className={inputCls} type="url" value={f.linkedInUrl} onChange={e => set({ linkedInUrl: e.target.value })} />
        </Field>
        <Field label="Other social">
          <input className={inputCls} value={f.otherSocials} onChange={e => set({ otherSocials: e.target.value })} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-[90px] py-3`} value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="What matters to them, how they like to be contacted, who they report to…" />
        </Field>
        <label className="flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 sm:col-span-2">
          <input type="checkbox" className="h-6 w-6 accent-amber-600" checked={f.isDecisionMaker} onChange={e => set({ isDecisionMaker: e.target.checked })} />
          <span className="flex items-center gap-1.5 text-[16px] font-bold text-amber-900">
            <Star className="h-4 w-4 fill-amber-400 text-amber-500" /> Decision maker
          </span>
          {isKeyDecisionMaker(f.jobTitle) && <span className="text-[13px] text-amber-800">Ticked because of their title. Untick if not.</span>}
        </label>
        {confirmDuplicate && dupes.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-[15px] text-amber-950 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <span>
              This looks like {dupes.map(d => `${d.firstName} ${d.lastName} (${d.jobTitle})`).join(', ')}, who is already saved. Save anyway only if it’s a different person.
            </span>
          </div>
        )}
      </div>
    </FormShell>
  );
};
