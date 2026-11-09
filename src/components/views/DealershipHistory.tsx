// Read-only pieces of a dealership record: the activity timeline, account
// status (lost / not now / disqualified / referral / placeholder), the
// onboarding checklist, lot-count history and the audit trail.

import React, { useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Circle, Mail, MessageSquare, Mic, Package, Phone, StickyNote, UserPlus, Video, MapPin, Ban, Clock } from 'lucide-react';
import { Activity, AuditLogRecord, Dealership, User } from '../../types/crm';

const ICON: Record<Activity['activityType'], React.FC<{ className?: string }>> = {
  'In-Person Visit': MapPin,
  'Phone Call': Phone,
  Email: Mail,
  'Text Message': MessageSquare,
  'Google Meet': Video,
  Chat: MessageSquare,
  'System Note': StickyNote,
  'Keyfetch Top-up': Package
};

const LIVE: Activity['activityType'][] = ['In-Person Visit', 'Phone Call', 'Google Meet'];

const fmtWhen = (a: Activity, tz: string) => {
  const iso = a.completedAt;
  if (!iso) return `${a.plannedDate ?? ''} ${a.plannedTime ?? ''}`.trim();
  return new Date(iso).toLocaleString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

export const AccountStatusBanner: React.FC<{ dealership: Dealership; users: User[] }> = ({ dealership: d, users }) => {
  const items: { tone: string; icon: React.ReactNode; text: string }[] = [];
  if (d.isPlaceholder) items.push({ tone: 'amber', icon: <AlertTriangle className="h-4 w-4" />, text: 'Placeholder rooftop created with the dealer group — add the address, phone and contacts when you have them.' });
  if (d.stage === 'Lost' && d.lostReason) items.push({ tone: 'rose', icon: <Ban className="h-4 w-4" />, text: `Lost: ${d.lostReason}` });
  if (d.stage === 'Not Now') items.push({ tone: 'slate', icon: <Clock className="h-4 w-4" />, text: `Not now — nurture follow-up on ${d.nurtureFollowUpDate ? new Date(`${d.nurtureFollowUpDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'a later date'}.` });
  if (d.stage === 'Disqualified' && d.disqualifiedReason) items.push({ tone: 'slate', icon: <Ban className="h-4 w-4" />, text: `Disqualified: ${d.disqualifiedReason}` });
  if (d.referral) {
    const r = d.referral;
    items.push({
      tone: 'indigo',
      icon: <UserPlus className="h-4 w-4" />,
      text: r.internalName ? `Internal referral from ${r.internalName}${r.relationship ? ` — ${r.relationship}` : ''}` : `Referred by ${r.externalName}${r.externalCompany ? ` (${r.externalCompany})` : ''}${r.relationship ? ` — ${r.relationship}` : ''}`
    });
  }
  if (d.source === 'Assigned' && d.ownershipTransfers?.length) {
    const t = d.ownershipTransfers[d.ownershipTransfers.length - 1];
    const from = users.find(u => u.id === t.fromRepId);
    items.push({ tone: 'purple', icon: <UserPlus className="h-4 w-4" />, text: `Handed over from ${from ? `${from.firstName} ${from.lastName}` : 'a manager'} — origin attribution stays with them.` });
  }
  if (!items.length) return null;
  const TONE: Record<string, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    rose: 'bg-rose-50 border-rose-200 text-rose-900',
    slate: 'bg-slate-50 border-slate-200 text-slate-800',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    purple: 'bg-purple-50 border-purple-200 text-purple-900'
  };
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className={`flex items-start gap-2 rounded-xl border p-3 text-[14px] font-medium ${TONE[it.tone]}`}>
          <span className="mt-0.5 shrink-0">{it.icon}</span>
          <span>{it.text}</span>
        </div>
      ))}
    </div>
  );
};

export const ActivityTimeline: React.FC<{ dealership: Dealership; activities: Activity[] }> = ({ dealership, activities }) => {
  const [showAll, setShowAll] = useState(false);
  const list = [...activities].sort((a, b) => (b.completedAt ?? b.plannedDate ?? '').localeCompare(a.completedAt ?? a.plannedDate ?? ''));
  const shown = showAll ? list : list.slice(0, 8);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Activity history</h4>
        <span className="text-[13px] text-slate-500">{list.length} logged · times in the dealership’s local time</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-[14px] text-slate-500">Nothing logged yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
          {shown.map(a => {
            const Icon = ICON[a.activityType] ?? StickyNote;
            const live = LIVE.includes(a.activityType);
            return (
              <li key={a.id} className="relative">
                <span className="absolute -left-[25px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600">
                  <Icon className="h-3 w-3" />
                </span>
                <div className={`rounded-xl border p-3 ${a.status === 'cancelled' ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'}`}>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <span className="font-bold text-slate-900">{a.activityType}</span>
                    <span className="text-slate-500">{fmtWhen(a, dealership.timeZone)}</span>
                    <span className="text-slate-500">· {a.userName}</span>
                    {a.contactName && <span className="text-slate-500">· with {a.contactName}</span>}
                    {a.status === 'cancelled' && <span className="rounded bg-slate-200 px-1.5 font-semibold text-slate-700">Cancelled</span>}
                    {live && a.status !== 'cancelled' && a.isGoodWindow === false && <span className="rounded bg-rose-100 px-1.5 font-semibold text-rose-700">Outside 10–4</span>}
                    {a.tags?.includes('voicemail') && <span className="rounded bg-slate-100 px-1.5 font-semibold text-slate-600">Voicemail · no points</span>}
                    {!!a.pointsEarned && <span className="ml-auto rounded bg-amber-100 px-1.5 font-bold text-amber-800">+{a.pointsEarned} pts</span>}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700 whitespace-pre-line">{a.notes}</p>
                  {a.voiceNotesTranscript && (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-slate-50 p-2 text-[13px] italic text-slate-600">
                      <Mic className="mt-0.5 h-3 w-3 shrink-0" /> Voice note: “{a.voiceNotesTranscript}”
                    </p>
                  )}
                  {(a.productsDiscussed.length > 0 || a.nextAction) && (
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]">
                      {a.productsDiscussed.map(p => (
                        <span key={p} className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
                          {p}
                          {a.interestLevel ? ` · ${a.interestLevel}` : ''}
                        </span>
                      ))}
                      {a.nextAction && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                          <Calendar className="h-3 w-3" /> Next: {a.nextAction}
                          {a.nextActionDate ? ` · ${new Date(`${a.nextActionDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {list.length > 8 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="w-full rounded-xl border border-slate-200 py-2 text-[14px] font-semibold text-slate-700 hover:bg-slate-50">
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </div>
  );
};

export const OnboardingChecklist: React.FC<{ dealership: Dealership; users: User[] }> = ({ dealership, users }) => {
  const tasks = dealership.onboardingTasks;
  if (!tasks?.length) return null;
  const done = tasks.filter(t => t.completed).length;
  return (
    <div className="space-y-2 rounded-2xl border border-teal-200 bg-teal-50/50 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900">Onboarding checklist</h4>
        <span className="text-[13px] font-semibold text-teal-800">
          {done} of {tasks.length} done
        </span>
      </div>
      <ul className="space-y-1.5">
        {tasks.map(t => {
          const owner = users.find(u => u.id === t.ownerUserId);
          return (
            <li key={t.id} className="flex items-center gap-2 text-[14px]">
              {t.completed ? <CheckCircle2 className="h-4 w-4 text-teal-600" /> : <Circle className="h-4 w-4 text-slate-400" />}
              <span className={t.completed ? 'text-slate-500 line-through' : 'font-medium text-slate-800'}>{t.title}</span>
              <span className="ml-auto text-[13px] text-slate-500">
                {owner?.firstName} · due {new Date(`${t.dueDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const LotHistory: React.FC<{ dealership: Dealership; users: User[] }> = ({ dealership, users }) => {
  const h = dealership.inventoryHistory ?? [];
  if (!h.length) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-bold text-slate-900">Lot counts</h4>
      <table className="w-full text-left text-[14px]">
        <thead className="text-[12px] text-slate-500">
          <tr>
            <th className="py-1">Date</th>
            <th>Used cars on lot</th>
            <th>Sales / month</th>
            <th>Counted by</th>
          </tr>
        </thead>
        <tbody>
          {h.map((r, i) => {
            const u = users.find(x => x.id === r.recordedBy);
            return (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5">{new Date(`${r.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td className=" font-bold">{r.count}</td>
                <td className="">{r.monthlySales ?? '—'}</td>
                <td>{u ? `${u.firstName} ${u.lastName}` : r.recordedBy}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const AuditList: React.FC<{ logs: AuditLogRecord[]; timeZone?: string }> = ({ logs, timeZone }) => {
  if (!logs.length) return <p className="text-[14px] text-slate-500">No audit entries yet.</p>;
  return (
    <ul className="space-y-2">
      {[...logs]
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .map(l => (
          <li key={l.id} className="rounded-xl border border-slate-200 bg-white p-3 text-[14px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{l.action}</span>
              <span className="text-slate-500">{new Date(l.timestamp).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              <span className="text-slate-500">· {l.userName}</span>
            </div>
            <p className="mt-1 text-slate-700">{l.details}</p>
          </li>
        ))}
    </ul>
  );
};
