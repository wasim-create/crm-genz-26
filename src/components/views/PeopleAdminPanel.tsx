// People (staff) list — admins and owners add or remove people. This list
// feeds the persona switcher, the Internal Referral dropdown and every
// "who" list in the CRM. Removed people stay in history but disappear from
// lists (and can be restored).

import React, { useState } from 'react';
import { RotateCcw, UserMinus, UserPlus } from 'lucide-react';
import { USRegion, User, UserRole } from '../../types/crm';
import { approximateCoords } from '../../utils/dealershipFactory';
import { Field, inputCls } from '../forms/FormShell';

export const ROLE_LABEL: Record<UserRole, string> = {
  new_rep: 'Sales Rep (new)',
  veteran_rep: 'Sales Rep',
  team_lead: 'Team Lead',
  manager: 'Sales Manager',
  finance: 'Finance Controller',
  executive: 'Executive',
  owner: 'Owner',
  inventory_manager: 'Inventory Manager',
  admin: 'Administrator'
};

const REGIONS: USRegion[] = ['Northeast', 'Midwest', 'Southeast', 'West', 'Texas / South Central'];

export const PeopleAdminPanel: React.FC<{
  currentUser: User;
  users: User[];
  knownLocations: { zipCode: string; city: string; state: string; coordinates: { lat: number; lng: number } }[];
  onChange: (users: User[], message: string) => void;
}> = ({ currentUser, users, knownLocations, onChange }) => {
  const canEdit = currentUser.role === 'admin' || currentUser.role === 'owner';
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', title: '', role: 'veteran_rep' as UserRole, region: 'Northeast' as USRegion, managerId: '', homeZipCode: '' });
  const managers = users.filter(u => u.role === 'manager' && u.active !== false);
  const admins = users.filter(u => u.role === 'admin' && u.active !== false);

  const add = () => {
    const loc = approximateCoords(f.homeZipCode, '', '', knownLocations, currentUser.homeCoords);
    const u: User = {
      id: `u_${f.firstName.toLowerCase().replace(/[^a-z]/g, '')}_${Date.now().toString(36)}`,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      title: f.title.trim() || undefined,
      role: f.role,
      region: f.region,
      managerId: f.managerId || null,
      homeZipCode: f.homeZipCode.trim(),
      homeCoords: loc?.coords ?? currentUser.homeCoords,
      hireDate: new Date().toISOString().slice(0, 10),
      isRookie: f.role === 'new_rep',
      active: true
    };
    onChange([...users, u], `${u.firstName} ${u.lastName} added`);
    setAdding(false);
    setF({ ...f, firstName: '', lastName: '', email: '', phone: '', title: '', homeZipCode: '' });
  };

  const setActive = (u: User, active: boolean) => {
    onChange(users.map(x => (x.id === u.id ? { ...x, active } : x)), active ? `${u.firstName} ${u.lastName} restored` : `${u.firstName} ${u.lastName} removed from lists`);
    setConfirmRemove(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">People at GenZ</h3>
          <p className="text-xs text-slate-500">
            Used for logins, the Internal Referral list and team views. {canEdit ? 'You can add and remove people.' : 'Only an administrator or owner can change this list.'}
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setAdding(a => !a)} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-onaccent hover:bg-brand-hover">
            <UserPlus className="h-4 w-4" /> Add a person
          </button>
        )}
      </div>

      {adding && canEdit && (
        <div className="grid gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 sm:grid-cols-2">
          <Field label="First name" required>
            <input className={inputCls} value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Last name" required>
            <input className={inputCls} value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input className={inputCls} type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} type="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Role" required>
            <select className={inputCls} value={f.role} onChange={e => setF({ ...f, role: e.target.value as UserRole })}>
              {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Job title / designation">
            <input className={inputCls} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Senior Account Executive" />
          </Field>
          <Field label="Region">
            <select className={inputCls} value={f.region} onChange={e => setF({ ...f, region: e.target.value as USRegion })}>
              {REGIONS.map(r => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Manager">
            <select className={inputCls} value={f.managerId} onChange={e => setF({ ...f, managerId: e.target.value })}>
              <option value="">None</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Home ZIP" hint="Sets their 60-mile territory">
            <input className={inputCls} inputMode="numeric" value={f.homeZipCode} onChange={e => setF({ ...f, homeZipCode: e.target.value })} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="button"
              disabled={!f.firstName.trim() || !f.lastName.trim() || !f.email.trim()}
              onClick={add}
              className="min-h-[48px] rounded-xl bg-brand px-5 text-sm font-bold text-onaccent disabled:bg-slate-300"
            >
              Save person
            </button>
            <button type="button" onClick={() => setAdding(false)} className="min-h-[48px] rounded-xl px-4 text-sm font-semibold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {users.map(u => {
          const inactive = u.active === false;
          const isSelf = u.id === currentUser.id;
          const lastAdmin = u.role === 'admin' && admins.length <= 1;
          return (
            <div key={u.id} className={`flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${inactive ? 'bg-slate-50 opacity-60' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-slate-900">
                  {u.firstName} {u.lastName} {inactive && <span className="ml-1 rounded bg-slate-200 px-1.5 text-[13px] font-semibold text-slate-600">Removed</span>}
                </div>
                <div className="text-xs text-slate-500">
                  {u.title ?? ROLE_LABEL[u.role]} · {u.region} · {u.email}
                </div>
              </div>
              {canEdit && !isSelf && !lastAdmin && (
                inactive ? (
                  <button type="button" onClick={() => setActive(u, true)} className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                    <RotateCcw className="h-3.5 w-3.5" /> Restore
                  </button>
                ) : confirmRemove === u.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    Remove {u.firstName}?
                    <button type="button" onClick={() => setActive(u, false)} className="rounded-xl bg-danger px-3 py-2 font-bold text-onaccent">
                      Yes, remove
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="rounded-xl px-3 py-2 font-semibold text-slate-600">
                      No
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmRemove(u.id)} className="flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                    <UserMinus className="h-3.5 w-3.5" /> Remove
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Removing someone hides them from lists and logins; their history, dealerships and points stay. Reassign their dealerships from the Bench if needed.</p>
    </div>
  );
};
