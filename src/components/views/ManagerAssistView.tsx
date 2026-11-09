import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Briefcase, CalendarClock, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';
import { AssistType, Dealership, ManagerAssist, User } from '../../types/crm';
import { Badge, Btn, Dialog, EmptyState, Page, PageHeader, Panel, Stat, Toolbar, Tone, useSticky } from '../ui/kit';
import { formatDayTime, formatRelative, matches, plural } from '../../utils/format';

interface ManagerAssistViewProps {
  assists: ManagerAssist[];
  dealerships: Dealership[];
  users: User[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onUpdateAssist: (assist: ManagerAssist) => void;
  onSignDealWithAssist: (dealership: Dealership, managerUser: User) => void;
  onTransferOwnership: (dealershipId: string, toRepId: string, reason: string) => void;
}

export const ASSIST_TYPE_LABEL: Record<AssistType, string> = {
  join_call: 'Join a call',
  in_person_visit: 'Join a visit',
  google_meet: 'Join a Google Meet',
  terms_approval: 'Approve terms',
  strategy_session: 'Plan the close',
  contract_signing_support: 'Help sign the contract'
};

const STATUS: Record<ManagerAssist['status'], { label: string; tone: Tone }> = {
  Pending: { label: 'Waiting for reply', tone: 'amber' },
  Accepted: { label: 'Booked', tone: 'blue' },
  'Reschedule Proposed': { label: 'New time suggested', tone: 'violet' },
  Declined: { label: 'Declined', tone: 'neutral' },
  Completed: { label: 'Done', tone: 'green' }
};

type StatusFilter = 'open' | 'pending' | 'booked' | 'done' | 'declined' | 'all';
const inStatus = (a: ManagerAssist, f: StatusFilter) =>
  f === 'all' ||
  (f === 'open' && ['Pending', 'Accepted', 'Reschedule Proposed'].includes(a.status)) ||
  (f === 'pending' && a.status === 'Pending') ||
  (f === 'booked' && (a.status === 'Accepted' || a.status === 'Reschedule Proposed')) ||
  (f === 'done' && a.status === 'Completed') ||
  (f === 'declined' && a.status === 'Declined');

const when = (a: ManagerAssist) => ({ date: a.rescheduledDate ?? a.proposedDate, time: a.rescheduledTime ?? a.proposedTime });
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nextWorkday = () => {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const ManagerAssistView: React.FC<ManagerAssistViewProps> = ({ assists, dealerships, users, currentUser, onOpenDealership, onUpdateAssist, onSignDealWithAssist, onTransferOwnership }) => {
  const isManager = ['manager', 'owner', 'executive'].includes(currentUser.role);
  const key = `assists_${currentUser.id}`;
  const mineOnly = (a: ManagerAssist) => (isManager ? currentUser.role !== 'manager' || a.assignedManagerId === currentUser.id : a.originRepId === currentUser.id);

  const [q, setQ] = useState('');
  const [scope, setScope] = useSticky(`${key}_scope`, currentUser.role === 'manager' ? 'mine' : 'all');
  const [status, setStatus] = useState<StatusFilter>(() => (isManager && assists.some(a => mineOnly(a) && a.status === 'Pending') ? 'pending' : 'open'));
  const [type, setType] = useState('all');
  const [rep, setRep] = useState('all');
  const [sort, setSort] = useSticky(`${key}_sort`, 'soonest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState(nextWorkday);
  const [reschedTime, setReschedTime] = useState('14:00');

  const visible = useMemo(() => assists.filter(a => (isManager ? scope === 'all' || mineOnly(a) : a.originRepId === currentUser.id)), [assists, scope, isManager, currentUser]);

  const list = useMemo(() => {
    const today = todayISO();
    const rows = visible.filter(
      a => inStatus(a, status) && (type === 'all' || a.assistType === type) && (rep === 'all' || a.originRepId === rep) && matches(q, a.dealershipName, a.originRepName, a.assignedManagerName, a.decisionMakerName)
    );
    const cmp: Record<string, (a: ManagerAssist, b: ManagerAssist) => number> = {
      soonest: (a, b) => {
        // upcoming first (soonest), then past ones (most recent)
        const A = when(a).date, B = when(b).date;
        const fa = A >= today, fb = B >= today;
        if (fa !== fb) return fa ? -1 : 1;
        return fa ? `${A}${when(a).time}`.localeCompare(`${B}${when(b).time}`) : B.localeCompare(A);
      },
      requested: (a, b) => b.requestDate.localeCompare(a.requestDate),
      name: (a, b) => a.dealershipName.localeCompare(b.dealershipName)
    };
    return [...rows].sort(cmp[sort]);
  }, [visible, status, type, rep, q, sort]);

  useEffect(() => {
    if (!list.some(a => a.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  }, [list, selectedId]);

  const selected = assists.find(a => a.id === selectedId) ?? null;
  const deal = selected ? dealerships.find(d => d.id === selected.dealershipId) : undefined;
  const count = (f: StatusFilter) => visible.filter(a => inStatus(a, f)).length;

  const update = (a: ManagerAssist, patch: Partial<ManagerAssist>) => onUpdateAssist({ ...a, ...patch });
  const reps = users.filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role) && visible.some(a => a.originRepId === u.id));

  return (
    <Page>
      <PageHeader
        icon={<Briefcase className="h-6 w-6" />}
        title={isManager ? 'Assist requests' : 'My assist requests'}
        subtitle={isManager ? 'Reps ask you to join a visit, call or signing. The rep keeps the deal and the credit.' : 'When you ask a manager to help, it shows here. You keep the deal and the credit.'}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={isManager ? 'Waiting for your reply' : 'Waiting for a reply'} value={count('pending')} tone={count('pending') ? 'amber' : 'neutral'} active={status === 'pending'} onClick={() => setStatus(status === 'pending' ? 'open' : 'pending')} />
        <Stat label="Booked" value={count('booked')} tone="blue" active={status === 'booked'} onClick={() => setStatus(status === 'booked' ? 'open' : 'booked')} />
        <Stat label="Done" value={count('done')} tone="green" active={status === 'done'} onClick={() => setStatus(status === 'done' ? 'open' : 'done')} />
        <Stat label="Declined" value={count('declined')} active={status === 'declined'} onClick={() => setStatus(status === 'declined' ? 'open' : 'declined')} />
      </div>

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search dealership, rep or contact' }}
        filters={[
          {
            id: 'status',
            allLabel: 'Any status',
            defaultValue: 'open',
            value: status,
            onChange: v => setStatus(v as StatusFilter),
            options: [
              { value: 'open', label: 'Open (waiting or booked)', count: count('open') },
              { value: 'pending', label: 'Waiting for reply', count: count('pending') },
              { value: 'booked', label: 'Booked', count: count('booked') },
              { value: 'done', label: 'Done', count: count('done') },
              { value: 'declined', label: 'Declined', count: count('declined') }
            ]
          },
          ...(currentUser.role === 'manager' ? [{ id: 'scope', allLabel: 'All managers', defaultValue: 'mine', value: scope, onChange: setScope, options: [{ value: 'mine', label: 'Asked of me' }] }] : []),
          ...(isManager ? [{ id: 'rep', allLabel: 'All reps', value: rep, onChange: setRep, options: reps.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, count: visible.filter(a => a.originRepId === u.id).length })) }] : []),
          { id: 'type', allLabel: 'Any kind of help', value: type, onChange: setType, options: (Object.keys(ASSIST_TYPE_LABEL) as AssistType[]).map(t => ({ value: t, label: ASSIST_TYPE_LABEL[t], count: visible.filter(a => a.assistType === t).length })) }
        ]}
        sort={{ value: sort, onChange: setSort, options: [{ value: 'soonest', label: 'Date (soonest first)' }, { value: 'requested', label: 'Asked (newest first)' }, { value: 'name', label: 'Dealership (A–Z)' }] }}
        count={plural(list.length, 'request')}
        onClear={() => {
          setQ('');
          setStatus('open');
          setType('all');
          setRep('all');
          setScope(currentUser.role === 'manager' ? 'mine' : 'all');
        }}
      />

      {list.length === 0 ? (
        <EmptyState title="Nothing here" hint={status === 'pending' ? 'No requests are waiting for a reply.' : 'Try another status or clear the filters.'} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-5">
            {list.map(a => {
              const w = when(a);
              const on = a.id === selectedId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  aria-pressed={on}
                  className={`w-full cursor-pointer rounded-2xl border bg-white p-4 text-left transition ${on ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold text-slate-900">{a.dealershipName}</span>
                    <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                  </div>
                  <div className="mt-1 text-[13px] text-slate-600">
                    {ASSIST_TYPE_LABEL[a.assistType]} · {isManager ? a.originRepName : a.assignedManagerName}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-[13px] text-slate-500">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatDayTime(w.date, w.time)}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && (
            <Panel className="space-y-5 p-5 lg:col-span-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Badge>
                    <span className="text-[13px] text-slate-500">Asked {formatRelative(selected.requestDate).toLowerCase()}</span>
                  </div>
                  <h2 className="mt-1 text-[22px] font-extrabold text-slate-900">{selected.dealershipName}</h2>
                  <p className="text-[14px] text-slate-600">
                    {ASSIST_TYPE_LABEL[selected.assistType]} · {selected.originRepName} asked {selected.assignedManagerName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {deal && (
                    <Btn size="sm" icon={<ExternalLink className="h-4 w-4" />} onClick={() => onOpenDealership(deal)}>
                      Open dealership
                    </Btn>
                  )}
                  {isManager && (
                    <Btn size="sm" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => setTransferOpen(true)}>
                      Move to another rep
                    </Btn>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fact label="When">
                  {formatDayTime(when(selected).date, when(selected).time)}
                  {selected.status === 'Reschedule Proposed' && <div className="text-[13px] font-normal text-violet-700">New time suggested (was {formatDayTime(selected.proposedDate, selected.proposedTime)})</div>}
                </Fact>
                <Fact label="Decision maker">
                  {selected.decisionMakerName}
                  <div className="text-[13px] font-normal text-slate-500">{selected.decisionMakerTitle}</div>
                </Fact>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                  <Sparkles className="h-4 w-4 text-blue-600" /> Brief
                </div>
                <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-[14px] leading-relaxed text-slate-700">{selected.aiBriefing}</p>
              </div>

              {selected.objections && (
                <div>
                  <div className="text-[14px] font-semibold text-slate-800">What they need to hear</div>
                  <p className="mt-0.5 text-[14px] text-slate-700">{selected.objections}</p>
                </div>
              )}
              {selected.productsOfInterest.length > 0 && (
                <div>
                  <div className="text-[14px] font-semibold text-slate-800">Products</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selected.productsOfInterest.map(p => (
                      <Badge key={p} tone="blue">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {(selected.managerNotes || selected.outcomeNotes) && (
                <div className="rounded-xl bg-slate-50 p-3 text-[14px] text-slate-700">{selected.outcomeNotes ?? selected.managerNotes}</div>
              )}

              {isManager && (selected.status === 'Pending' || selected.status === 'Accepted' || selected.status === 'Reschedule Proposed') && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  {selected.status === 'Pending' && (
                    <>
                      <Btn variant="primary" onClick={() => update(selected, { status: 'Accepted', managerNotes: `${currentUser.firstName} accepted. Added to both calendars.` })}>
                        Accept
                      </Btn>
                      <Btn onClick={() => setReschedOpen(o => !o)}>Suggest another time</Btn>
                      <Btn variant="danger" onClick={() => update(selected, { status: 'Declined', managerNotes: `${currentUser.firstName} declined: the rep can handle this one with the standard pack.` })}>
                        Decline
                      </Btn>
                    </>
                  )}
                  {selected.status !== 'Pending' && deal && (
                    <Btn
                      variant="success"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      onClick={() => {
                        update(selected, { status: 'Completed', completedAt: new Date().toISOString(), outcomeNotes: `Signed with ${currentUser.firstName} ${currentUser.lastName}'s help. ${selected.originRepName} keeps the client and the credit.` });
                        onSignDealWithAssist(deal, currentUser);
                      }}
                    >
                      Mark as signed
                    </Btn>
                  )}
                </div>
              )}
              {reschedOpen && selected.status === 'Pending' && (
                <div className="flex flex-wrap items-end gap-2 rounded-xl bg-violet-50 p-3">
                  <label className="text-[13px] font-semibold text-slate-700">
                    Day
                    <input type="date" value={reschedDate} onChange={e => setReschedDate(e.target.value)} className="mt-1 block min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-[14px]" />
                  </label>
                  <label className="text-[13px] font-semibold text-slate-700">
                    Time
                    <input type="time" value={reschedTime} onChange={e => setReschedTime(e.target.value)} className="mt-1 block min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-[14px]" />
                  </label>
                  <Btn
                    variant="primary"
                    onClick={() => {
                      update(selected, { status: 'Reschedule Proposed', rescheduledDate: reschedDate, rescheduledTime: reschedTime, managerNotes: `${currentUser.firstName} suggested ${formatDayTime(reschedDate, reschedTime)}.` });
                      setReschedOpen(false);
                    }}
                  >
                    Send
                  </Btn>
                </div>
              )}
            </Panel>
          )}
        </div>
      )}

      {transferOpen && selected && (
        <Dialog title="Move this dealership to another rep" onClose={() => setTransferOpen(false)}>
          <p className="text-[14px] text-slate-600">
            {selected.originRepName} stays the rep who found {selected.dealershipName}; that credit never moves. The reason is recorded.
          </p>
          <label className="block text-[14px] font-semibold text-slate-800">
            New rep
            <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-normal">
              <option value="">Choose a rep…</option>
              {users
                .filter(u => (u.role === 'veteran_rep' || u.role === 'new_rep') && u.id !== deal?.assignedRepId)
                .map(u => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.region})
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-[14px] font-semibold text-slate-800">
            Reason
            <textarea value={transferReason} onChange={e => setTransferReason(e.target.value)} placeholder="e.g. Territory change, or the rep is on leave" rows={3} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-[14px] font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setTransferOpen(false)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              disabled={!transferTo || !transferReason.trim()}
              onClick={() => {
                onTransferOwnership(selected.dealershipId, transferTo, transferReason.trim());
                setTransferOpen(false);
                setTransferReason('');
              }}
            >
              Move it
            </Btn>
          </div>
        </Dialog>
      )}
    </Page>
  );
};

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <div className="text-[13px] text-slate-500">{label}</div>
    <div className="text-[15px] font-semibold text-slate-900">{children}</div>
  </div>
);
