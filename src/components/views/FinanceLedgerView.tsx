import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileCheck2, History } from 'lucide-react';
import { Dealership, IncentiveState, IntroductionIncentive, User } from '../../types/crm';
import { Badge, Btn, Dialog, EmptyState, Page, PageHeader, Panel, Stat, Toolbar, Tone, useSticky } from '../ui/kit';
import { formatDay, formatMoney, formatShortDay, matches, plural } from '../../utils/format';

interface FinanceLedgerViewProps {
  incentives: IntroductionIncentive[];
  dealerships: Dealership[];
  users: User[];
  currentUser: User;
  onUpdateIncentive: (updated: IntroductionIncentive) => void;
  onOpenDealership: (dealership: Dealership) => void;
}

const STATE: Record<IncentiveState, { label: string; tone: Tone }> = {
  Eligible: { label: 'To verify', tone: 'amber' },
  'Pending verification': { label: 'To verify', tone: 'amber' },
  Verified: { label: 'To approve', tone: 'violet' },
  Approved: { label: 'To pay', tone: 'blue' },
  Paid: { label: 'Paid', tone: 'green' },
  Rejected: { label: 'Rejected', tone: 'neutral' },
  Disputed: { label: 'Disputed', tone: 'red' }
};

type Stage = 'verify' | 'approve' | 'pay' | 'paid' | 'closed';
const STAGE_OF: Record<IncentiveState, Stage> = {
  Eligible: 'verify',
  'Pending verification': 'verify',
  Verified: 'approve',
  Approved: 'pay',
  Paid: 'paid',
  Rejected: 'closed',
  Disputed: 'closed'
};

const signedOn = (i: IntroductionIncentive) => i.trail[i.trail.length - 1]?.date ?? i.approvedAt ?? '';
const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const FinanceLedgerView: React.FC<FinanceLedgerViewProps> = ({ incentives, dealerships, users, currentUser, onUpdateIncentive, onOpenDealership }) => {
  const isFinance = currentUser.role === 'finance';
  const canSeeAll = ['finance', 'manager', 'executive', 'owner'].includes(currentUser.role);
  const canSee = (i: IntroductionIncentive) => canSeeAll || i.originRepId === currentUser.id;
  const key = `finance_${currentUser.id}`;

  const [q, setQ] = useState('');
  const [stage, setStage] = useState<string>(isFinance ? 'open' : 'all');
  const [rep, setRep] = useState('all');
  const [month, setMonth] = useState('all');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useSticky(`${key}_sort`, 'newest');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [approving, setApproving] = useState<IntroductionIncentive | null>(null);
  const [amount, setAmount] = useState(300);
  const [comments, setComments] = useState('');

  const inStage = (i: IntroductionIncentive, s: string) => s === 'all' || (s === 'open' ? ['verify', 'approve', 'pay'].includes(STAGE_OF[i.state]) : STAGE_OF[i.state] === s);
  const TESTS: Record<string, (i: IntroductionIncentive) => boolean> = {
    conflicts: i => (i.conflicts?.length ?? 0) > 0,
    assisted: i => i.assistInvolved,
    solo: i => !i.assistInvolved
  };

  const list = useMemo(() => {
    const rows = incentives.filter(
      i =>
        inStage(i, stage) &&
        (rep === 'all' || i.originRepId === rep) &&
        (month === 'all' || monthKey(signedOn(i)) === month) &&
        matches(q, i.dealershipName, i.originRepName, i.closedByUserName, i.paymentReference) &&
        Object.entries(chips).every(([id, on]) => !on || TESTS[id](i))
    );
    const cmp: Record<string, (a: IntroductionIncentive, b: IntroductionIncentive) => number> = {
      newest: (a, b) => signedOn(b).localeCompare(signedOn(a)),
      oldest: (a, b) => signedOn(a).localeCompare(signedOn(b)),
      amount: (a, b) => (canSee(b) ? b.amount ?? 0 : 0) - (canSee(a) ? a.amount ?? 0 : 0),
      name: (a, b) => a.dealershipName.localeCompare(b.dealershipName)
    };
    return [...rows].sort(cmp[sort]);
  }, [incentives, stage, rep, month, q, chips, sort]);

  useEffect(() => {
    if (!list.some(i => i.id === selectedId)) setSelectedId(list[0]?.id ?? null);
  }, [list, selectedId]);
  const selected = incentives.find(i => i.id === selectedId) ?? null;

  const n = (s: string) => incentives.filter(i => inStage(i, s)).length;
  const sum = (rows: IntroductionIncentive[]) => rows.reduce((t, i) => t + (canSee(i) ? i.amount ?? 0 : 0), 0);
  const thisMonth = monthKey(new Date().toISOString());
  const paidThisMonth = incentives.filter(i => i.state === 'Paid' && monthKey(i.paidAt ?? signedOn(i)) === thisMonth);
  const months = [...new Set(incentives.map(i => monthKey(signedOn(i))).filter(Boolean))].sort().reverse();
  const reps = users.filter(u => incentives.some(i => i.originRepId === u.id));
  const toggle = (id: string) => setChips(c => ({ ...c, [id]: !c[id] }));
  const pick = (s: string) => setStage(stage === s ? (isFinance ? 'open' : 'all') : s);

  const set = (i: IntroductionIncentive, patch: Partial<IntroductionIncentive>) => onUpdateIncentive({ ...i, reviewedBy: `${currentUser.firstName} ${currentUser.lastName}`, ...patch });

  const exportCsv = () => {
    const head = ['Dealership', 'Rep who introduced', 'Closed by', 'Manager assist', 'Status', 'Signed', 'Amount', 'Payment reference'];
    const rows = list.map(i => [`"${i.dealershipName}"`, `"${i.originRepName}"`, `"${i.closedByUserName}"`, i.assistInvolved ? 'Yes' : 'No', STATE[i.state].label, signedOn(i), canSee(i) && i.amount ? i.amount : '', i.paymentReference ?? '']);
    const csv = 'data:text/csv;charset=utf-8,' + [head.join(','), ...rows.map(r => r.join(','))].join('\n');
    const a = document.createElement('a');
    a.href = encodeURI(csv);
    a.download = `introduction-incentives-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Page>
      <PageHeader
        icon={<FileCheck2 className="h-6 w-6" />}
        title="Introduction incentives"
        subtitle="Paid to the rep who introduced the dealership, whether they closed it alone or with a manager. Amounts are only shown to that rep, managers and finance."
        actions={
          <Btn icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            {canSeeAll ? 'Export' : 'Export my statement'}
          </Btn>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="To verify" value={n('verify')} tone={n('verify') ? 'amber' : 'neutral'} active={stage === 'verify'} onClick={() => pick('verify')} />
        <Stat label="To approve" value={n('approve')} hint={canSeeAll ? formatMoney(sum(incentives.filter(i => inStage(i, 'approve')))) : undefined} tone="violet" active={stage === 'approve'} onClick={() => pick('approve')} />
        <Stat label="To pay" value={n('pay')} hint={canSeeAll ? formatMoney(sum(incentives.filter(i => inStage(i, 'pay')))) : undefined} tone="blue" active={stage === 'pay'} onClick={() => pick('pay')} />
        <Stat label="Paid this month" value={paidThisMonth.length} hint={canSeeAll ? formatMoney(sum(paidThisMonth)) : undefined} tone="green" active={stage === 'paid'} onClick={() => pick('paid')} />
      </div>

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search dealership, rep or payment ref' }}
        filters={[
          {
            id: 'stage',
            allLabel: 'Any status',
            defaultValue: isFinance ? 'open' : 'all',
            value: stage,
            onChange: setStage,
            options: [
              { value: 'open', label: 'Still to do', count: n('open') },
              { value: 'verify', label: 'To verify', count: n('verify') },
              { value: 'approve', label: 'To approve', count: n('approve') },
              { value: 'pay', label: 'To pay', count: n('pay') },
              { value: 'paid', label: 'Paid', count: n('paid') },
              { value: 'closed', label: 'Rejected or disputed', count: n('closed') }
            ]
          },
          { id: 'rep', allLabel: 'All reps', value: rep, onChange: setRep, options: reps.map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`, count: incentives.filter(i => i.originRepId === u.id).length })) },
          { id: 'month', allLabel: 'Any month', value: month, onChange: setMonth, options: months.map(m => ({ value: m, label: `Signed ${monthLabel(m)}`, count: incentives.filter(i => monthKey(signedOn(i)) === m).length })) }
        ]}
        chips={[
          { id: 'conflicts', label: 'Has a conflict', count: incentives.filter(TESTS.conflicts).length, active: !!chips.conflicts, onClick: () => toggle('conflicts'), tone: 'attention' },
          { id: 'assisted', label: 'Manager assisted', count: incentives.filter(TESTS.assisted).length, active: !!chips.assisted, onClick: () => toggle('assisted') },
          { id: 'solo', label: 'Rep alone', count: incentives.filter(TESTS.solo).length, active: !!chips.solo, onClick: () => toggle('solo') }
        ]}
        sort={{ value: sort, onChange: setSort, options: [{ value: 'newest', label: 'Signed (newest first)' }, { value: 'oldest', label: 'Signed (oldest first)' }, { value: 'amount', label: 'Amount (highest first)' }, { value: 'name', label: 'Dealership (A–Z)' }] }}
        count={`${plural(list.length, 'incentive')}${canSeeAll && list.length ? ` · ${formatMoney(sum(list))}` : ''}`}
        onClear={() => {
          setQ('');
          setStage(isFinance ? 'open' : 'all');
          setRep('all');
          setMonth('all');
          setChips({});
        }}
      />

      {list.length === 0 ? (
        <EmptyState title="Nothing here" hint={stage === 'open' ? 'Everything has been verified, approved and paid.' : 'Try another status or clear the filters.'} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-5">
            {list.map(i => {
              const on = i.id === selectedId;
              return (
                <button
                  key={i.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelectedId(i.id)}
                  className={`w-full cursor-pointer rounded-2xl border bg-white p-4 text-left transition ${on ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold text-slate-900">{i.dealershipName}</span>
                    <span className="text-[15px] font-bold text-slate-900">{canSee(i) && i.amount !== undefined ? formatMoney(i.amount) : <span className="text-[13px] font-normal text-slate-400">Hidden</span>}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-600">
                    <span>
                      {i.originRepName} · {i.assistInvolved ? 'with assist' : 'alone'} · signed {formatShortDay(signedOn(i))}
                    </span>
                    <span className="flex gap-1">
                      {(i.conflicts?.length ?? 0) > 0 && (
                        <Badge tone="red">
                          <AlertTriangle className="h-3 w-3" /> Conflict
                        </Badge>
                      )}
                      <Badge tone={STATE[i.state].tone}>{STATE[i.state].label}</Badge>
                    </span>
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
                    <Badge tone={STATE[selected.state].tone}>{STATE[selected.state].label}</Badge>
                    <span className="text-[13px] text-slate-500">For: {selected.triggerEvent.toLowerCase()}</span>
                  </div>
                  <h2 className="mt-1 text-[22px] font-extrabold text-slate-900">{selected.dealershipName}</h2>
                  <p className="text-[14px] text-slate-600">
                    Introduced by {selected.originRepName} · closed by {selected.closedByUserName}
                    {selected.assistManagerName ? ` with ${selected.assistManagerName}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[13px] text-slate-500">Amount</div>
                  <div className="text-[26px] font-extrabold text-slate-900">{canSee(selected) ? (selected.amount !== undefined ? formatMoney(selected.amount) : 'Not set') : 'Hidden'}</div>
                </div>
              </div>

              {(selected.conflicts?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[14px] text-rose-900">
                  <div className="font-semibold">Sort these out before paying</div>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5">
                    {selected.conflicts!.map((c, k) => (
                      <li key={k}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-800">
                  <History className="h-4 w-4 text-blue-600" /> How it happened
                </div>
                <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
                  {selected.trail.map((s, k) => (
                    <li key={k} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[14px] font-semibold text-slate-900">{s.step}</span>
                        <span className="text-[13px] text-slate-500">{formatDay(s.date)}</span>
                      </div>
                      <p className="mt-0.5 text-[14px] text-slate-700">{s.details}</p>
                      <p className="text-[13px] text-slate-500">{s.actor}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {(selected.financeComments || selected.paymentReference) && (
                <div className="rounded-xl bg-slate-50 p-3 text-[14px] text-slate-700">
                  {selected.financeComments}
                  {selected.paymentReference && <div className="mt-1 text-[13px] text-slate-500">Payment reference {selected.paymentReference}{selected.paidAt ? ` · paid ${formatDay(selected.paidAt)}` : ''}</div>}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {isFinance && STAGE_OF[selected.state] === 'verify' && (
                  <Btn variant="primary" onClick={() => set(selected, { state: 'Verified', verifiedAt: new Date().toISOString() })}>
                    Verify
                  </Btn>
                )}
                {isFinance && STAGE_OF[selected.state] === 'approve' && (
                  <Btn
                    variant="primary"
                    onClick={() => {
                      setApproving(selected);
                      setAmount(selected.amount ?? 300);
                      setComments(selected.financeComments ?? '');
                    }}
                  >
                    Approve amount
                  </Btn>
                )}
                {isFinance && STAGE_OF[selected.state] === 'pay' && (
                  <Btn variant="success" disabled={(selected.conflicts?.length ?? 0) > 0} onClick={() => set(selected, { state: 'Paid', paidAt: new Date().toISOString(), paymentReference: `ACH-${Math.floor(100000 + Math.random() * 900000)}` })}>
                    Mark as paid
                  </Btn>
                )}
                {(() => {
                  const d = dealerships.find(x => x.id === selected.dealershipId);
                  return d ? (
                    <Btn icon={<ExternalLink className="h-4 w-4" />} onClick={() => onOpenDealership(d)}>
                      Open dealership
                    </Btn>
                  ) : null;
                })()}
              </div>
            </Panel>
          )}
        </div>
      )}

      {approving && (
        <Dialog title={`Approve — ${approving.dealershipName}`} onClose={() => setApproving(null)}>
          <label className="block text-[14px] font-semibold text-slate-800">
            Amount ($)
            <input type="number" min={0} value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)} className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-[14px]" />
          </label>
          {approving.amount !== undefined && amount !== approving.amount && <p className="text-[13px] text-amber-800">Changing it from {formatMoney(approving.amount)} is recorded with your name.</p>}
          <label className="block text-[14px] font-semibold text-slate-800">
            Note (optional)
            <textarea value={comments} onChange={e => setComments(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-[14px] font-normal" />
          </label>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => setApproving(null)}>
              Cancel
            </Btn>
            <Btn
              variant="primary"
              onClick={() => {
                set(approving, {
                  state: 'Approved',
                  amount,
                  approvedAt: new Date().toISOString(),
                  financeComments: comments || undefined,
                  amountAuditTrail: [...(approving.amountAuditTrail ?? []), { changedBy: `${currentUser.firstName} ${currentUser.lastName}`, changedAt: new Date().toISOString(), oldAmount: approving.amount ?? 0, newAmount: amount }]
                });
                setApproving(null);
              }}
            >
              Approve
            </Btn>
          </div>
        </Dialog>
      )}
    </Page>
  );
};
