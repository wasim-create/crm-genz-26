import React, { useState } from 'react';
import { IntroductionIncentive, User, Dealership } from '../../types/crm';
import { formatIncentiveUSD, formatUSDate } from '../../utils/territory';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Filter,
  Search,
  Receipt,
  ShieldCheck,
  Building,
  UserCheck,
  AlertCircle,
  Eye,
  EyeOff,
  History,
  DollarSign
} from 'lucide-react';

interface FinanceLedgerViewProps {
  incentives: IntroductionIncentive[];
  dealerships: Dealership[];
  users: User[];
  currentUser: User;
  onUpdateIncentive: (updated: IntroductionIncentive) => void;
  onOpenDealership: (dealership: Dealership) => void;
}

export const FinanceLedgerView: React.FC<FinanceLedgerViewProps> = ({
  incentives,
  dealerships,
  users,
  currentUser,
  onUpdateIncentive,
  onOpenDealership
}) => {
  const [filterState, setFilterState] = useState<string>('all');
  const [selectedIncentive, setSelectedIncentive] = useState<IntroductionIncentive | null>(incentives[0] || null);
  const [approveModalItem, setApproveModalItem] = useState<IntroductionIncentive | null>(null);
  const [editAmount, setEditAmount] = useState<number>(300);
  const [financeComments, setFinanceComments] = useState('');
  const [payReference, setPayReference] = useState('ACH-');

  // Role permissions: Donna Clark (finance), owners, and managers see all amounts.
  const canSeeAllAmounts = ['finance', 'manager', 'executive', 'owner'].includes(currentUser.role);

  // Filter based on role: Reps see all introductions for transparency, but non-owned amounts are masked.
  const filtered = incentives.filter(i => {
    if (filterState === 'all') return true;
    return i.state === filterState;
  });

  const handleOpenApproveModal = (inc: IntroductionIncentive) => {
    setApproveModalItem(inc);
    setEditAmount(inc.amount || 300);
    setFinanceComments(inc.financeComments || 'Introduction verified. Approved for bi-weekly release.');
    setPayReference(`ACH-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  const handleExecuteApproval = () => {
    if (!approveModalItem) return;

    const oldAmount = approveModalItem.amount || 0;
    const updated: IntroductionIncentive = {
      ...approveModalItem,
      amount: editAmount,
      state: 'Approved',
      approvedAt: new Date().toISOString(),
      financeComments,
      reviewedBy: 'Donna Clark',
      amountAuditTrail: [
        ...(approveModalItem.amountAuditTrail || []),
        {
          changedBy: `${currentUser.firstName} ${currentUser.lastName}`,
          changedAt: new Date().toISOString(),
          oldAmount,
          newAmount: editAmount
        }
      ]
    };

    onUpdateIncentive(updated);
    if (selectedIncentive?.id === approveModalItem.id) setSelectedIncentive(updated);
    setApproveModalItem(null);
  };

  const handleExecutePayment = (inc: IntroductionIncentive) => {
    const updated: IntroductionIncentive = {
      ...inc,
      state: 'Paid',
      paidAt: new Date().toISOString(),
      paymentReference: `ACH-${Math.floor(100000 + Math.random() * 900000)}`,
      reviewedBy: 'Donna Clark'
    };
    onUpdateIncentive(updated);
    if (selectedIncentive?.id === inc.id) setSelectedIncentive(updated);
  };

  const handleExecuteVerify = (inc: IntroductionIncentive) => {
    const updated: IntroductionIncentive = {
      ...inc,
      state: 'Verified',
      verifiedAt: new Date().toISOString(),
      reviewedBy: 'Donna Clark'
    };
    onUpdateIncentive(updated);
    if (selectedIncentive?.id === inc.id) setSelectedIncentive(updated);
  };

  const handleExportCSV = () => {
    const headers = ['Incentive ID', 'Dealership', 'Origin Rep', 'Closed By', 'Assist Involved', 'Status', 'Incentive Amount'];
    const rows = filtered.map(i => {
      const showAmount = canSeeAllAmounts || i.originRepId === currentUser.id;
      return [
        i.id,
        `"${i.dealershipName}"`,
        `"${i.originRepName}"`,
        `"${i.closedByUserName}"`,
        i.assistInvolved ? 'Yes' : 'No (Solo)',
        i.state,
        showAmount && i.amount ? `$${i.amount}` : 'MASKED'
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Introduction_Incentives_${currentUser.role}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-600" />
            <span>Introduction Incentives & Trail Queue</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-backed introduction timeline. Awarded whether closed solo or assisted. Incentive amounts strictly role-protected.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{canSeeAllAmounts ? 'Export Full Ledger' : 'Export My Statement'}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold w-fit">
        {(['all', 'Pending verification', 'Verified', 'Approved', 'Paid'] as const).map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterState(st)}
            className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
              filterState === st ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st === 'all' ? 'All Introductions' : st}
          </button>
        ))}
      </div>

      {/* Main 2-Column Ledger & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Queue List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
              Queue Records ({filtered.length})
            </h3>

            {filtered.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No introductions matching filter.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(inc => {
                  const isSelected = selectedIncentive?.id === inc.id;
                  const showAmount = canSeeAllAmounts || inc.originRepId === currentUser.id;

                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncentive(inc)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm text-slate-900">{inc.dealershipName}</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Origin Rep: <strong>{inc.originRepName}</strong>
                            {inc.assistInvolved ? ' (Assisted)' : ' (Solo Deal)'}
                          </div>
                        </div>

                        {/* Amount Display (Strict Role Visibility) */}
                        <div className="text-right">
                          {showAmount && inc.amount !== undefined ? (
                            <span className="font-mono font-black text-sm text-emerald-700 block">
                              {formatIncentiveUSD(inc.amount)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic block bg-slate-100 px-1.5 py-0.5 rounded">
                              Protected
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                            inc.state === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                            inc.state === 'Approved' ? 'bg-blue-100 text-blue-800' :
                            inc.state === 'Verified' ? 'bg-purple-100 text-purple-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {inc.state}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Visual Trail & Action Panel (7 cols) */}
        <div className="lg:col-span-7">
          {selectedIncentive ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Trigger: {selectedIncentive.triggerEvent}
                    </span>
                    <span className="text-xs text-slate-400">{selectedIncentive.id}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {selectedIncentive.dealershipName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Attributed Rep: <strong>{selectedIncentive.originRepName}</strong> • Closed by: {selectedIncentive.closedByUserName}
                  </p>
                </div>

                {/* Amount Box */}
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Incentive Bounty</span>
                  {canSeeAllAmounts || selectedIncentive.originRepId === currentUser.id ? (
                    <span className="text-2xl font-black font-mono text-emerald-600">
                      {selectedIncentive.amount ? formatIncentiveUSD(selectedIncentive.amount) : 'Pending Calc'}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono italic bg-slate-100 px-2 py-1 rounded">
                      Role Protected
                    </span>
                  )}
                </div>
              </div>

              {/* VISUAL INTRODUCTION TRAIL (Section 4) */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Introduction Timeline & Verification Trail</span>
                </div>

                {selectedIncentive.conflicts && selectedIncentive.conflicts.length > 0 && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] text-rose-900">
                    <span className="mb-1 block font-bold">Conflicts to resolve before paying</span>
                    <ul className="list-disc space-y-0.5 pl-4">
                      {selectedIncentive.conflicts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="relative pl-6 border-l-2 border-slate-200 space-y-4">
                  {selectedIncentive.trail.map((step, idx) => (
                    <div key={idx} className="relative text-xs">
                      <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-blue-600 border-2 border-white" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{step.step}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{step.date}</span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-0.5">{step.details}</p>
                      <span className="text-[10px] text-slate-400 italic">Actor: {step.actor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Donna Clark Controller Actions */}
              {currentUser.role === 'finance' && (
                <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {selectedIncentive.state === 'Pending verification' && (
                      <button
                        type="button"
                        onClick={() => handleExecuteVerify(selectedIncentive)}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Verify Discovery & Meeting
                      </button>
                    )}

                    {(selectedIncentive.state === 'Verified' || selectedIncentive.state === 'Eligible') && (
                      <button
                        type="button"
                        onClick={() => handleOpenApproveModal(selectedIncentive)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Approve Incentive Amount
                      </button>
                    )}

                    {selectedIncentive.state === 'Approved' && (
                      <button
                        type="button"
                        onClick={() => handleExecutePayment(selectedIncentive)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Mark as Paid (Disbursed Outside)
                      </button>
                    )}
                  </div>

                  {selectedIncentive.paymentReference && (
                    <span className="font-mono text-xs text-slate-500">
                      Ref: <strong>{selectedIncentive.paymentReference}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400">
              Select an introduction to view the complete verification trail.
            </div>
          )}
        </div>
      </div>

      {/* Finance Amount Approval Modal */}
      {approveModalItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="font-bold text-sm text-slate-900">
              Approve Introduction Incentive for {approveModalItem.dealershipName}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Incentive Amount ($):</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Finance Audit Notes:</label>
                <textarea
                  value={financeComments}
                  onChange={(e) => setFinanceComments(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setApproveModalItem(null)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteApproval}
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 cursor-pointer"
              >
                Approve & Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
