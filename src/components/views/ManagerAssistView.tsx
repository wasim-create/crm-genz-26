import React, { useState } from 'react';
import { ManagerAssist, Dealership, User } from '../../types/crm';
import { formatUSDate } from '../../utils/territory';
import {
  Briefcase,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  UserCheck,
  Building,
  Phone,
  ArrowRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  FileSignature,
  ArrowRightLeft,
  XCircle
} from 'lucide-react';

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

export const ManagerAssistView: React.FC<ManagerAssistViewProps> = ({
  assists,
  dealerships,
  users,
  currentUser,
  onOpenDealership,
  onUpdateAssist,
  onSignDealWithAssist,
  onTransferOwnership
}) => {
  const [selectedAssist, setSelectedAssist] = useState<ManagerAssist | null>(assists[0] || null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToRepId, setTransferToRepId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('14:00');
  const [rescheduleDate, setRescheduleDate] = useState('2026-11-04');
  const [showRescheduleInput, setShowRescheduleInput] = useState(false);

  const isManager = ['manager', 'owner', 'executive'].includes(currentUser.role);

  // Filter assists
  const displayAssists = isManager
    ? assists
    : assists.filter(a => a.originRepId === currentUser.id);

  const pendingAssists = displayAssists.filter(a => a.status === 'Pending');
  const activeAssists = displayAssists.filter(a => a.status === 'Accepted' || a.status === 'Reschedule Proposed');
  const completedAssists = displayAssists.filter(a => a.status === 'Completed');

  const handleAcceptAssist = (a: ManagerAssist) => {
    const updated: ManagerAssist = {
      ...a,
      status: 'Accepted',
      managerNotes: 'Manager accepted assist request. Added to joint schedule inside Golden Window.'
    };
    onUpdateAssist(updated);
    if (selectedAssist?.id === a.id) setSelectedAssist(updated);
  };

  const handleProposeReschedule = (a: ManagerAssist) => {
    const updated: ManagerAssist = {
      ...a,
      status: 'Reschedule Proposed',
      rescheduledDate: rescheduleDate,
      rescheduledTime: rescheduleTime,
      managerNotes: `Manager proposed new time: ${rescheduleDate} at ${rescheduleTime}`
    };
    onUpdateAssist(updated);
    setShowRescheduleInput(false);
    if (selectedAssist?.id === a.id) setSelectedAssist(updated);
  };

  const handleDeclineAssist = (a: ManagerAssist) => {
    const updated: ManagerAssist = {
      ...a,
      status: 'Declined',
      managerNotes: 'Manager declined assist: Rep recommended to handle directly with standard product collateral.'
    };
    onUpdateAssist(updated);
    if (selectedAssist?.id === a.id) setSelectedAssist(updated);
  };

  const handleJointClosingWon = (a: ManagerAssist) => {
    const deal = dealerships.find(d => d.id === a.dealershipId);
    if (!deal) return;

    const updated: ManagerAssist = {
      ...a,
      status: 'Completed',
      completedAt: new Date().toISOString(),
      outcomeNotes: `Deal successfully closed with joint assist from ${currentUser.firstName} ${currentUser.lastName}. Client placed in origin rep's book.`
    };
    onUpdateAssist(updated);
    if (selectedAssist?.id === a.id) setSelectedAssist(updated);

    onSignDealWithAssist(deal, currentUser);
  };

  const handleExecuteTransfer = () => {
    if (!selectedAssist || !transferToRepId || !transferReason.trim()) return;
    onTransferOwnership(selectedAssist.dealershipId, transferToRepId, transferReason);
    setShowTransferModal(false);
    setTransferReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-600" />
            <span>{isManager ? 'Manager Assist Requests & Joint Closings' : 'My Assist Requests'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Reps keep full deal ownership through closure. Managers join high-urgency calls and visits to provide executive support.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="bg-amber-50 text-amber-800 font-bold px-3 py-1.5 rounded-xl border border-amber-200">
            {pendingAssists.length} Pending Review
          </span>
          <span className="bg-indigo-50 text-indigo-800 font-bold px-3 py-1.5 rounded-xl border border-indigo-200">
            {activeAssists.length} Active / Scheduled
          </span>
          <span className="bg-emerald-50 text-emerald-800 font-bold px-3 py-1.5 rounded-xl border border-emerald-200">
            {completedAssists.length} Closed with Assist
          </span>
        </div>
      </div>

      {/* Main 2-Column Assist Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Assist Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
              Assist Requests Stream
            </h3>

            {displayAssists.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No assist requests found.
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {displayAssists.map(a => {
                  const isSelected = selectedAssist?.id === a.id;
                  const deal = dealerships.find(d => d.id === a.dealershipId);

                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAssist(a)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-purple-600 bg-purple-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-sm text-slate-900">{a.dealershipName}</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Rep: <strong className="text-slate-700">{a.originRepName}</strong> → Manager: {a.assignedManagerName}
                          </div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          a.status === 'Accepted' ? 'bg-indigo-100 text-indigo-800' :
                          a.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                          a.status === 'Declined' ? 'bg-rose-100 text-rose-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {a.status}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {a.proposedDate} at {a.proposedTime}
                        </span>
                        <span className="capitalize font-medium text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px]">
                          {a.assistType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detail, Brief & Action Execution (7 cols) */}
        <div className="lg:col-span-7">
          {selectedAssist ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
              {/* Header Info */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Assist Mode: {selectedAssist.assistType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-400">ID: {selectedAssist.id}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    {selectedAssist.dealershipName}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Origin Rep: <strong>{selectedAssist.originRepName}</strong> (Retains Ownership & Commission Attribution)
                  </p>
                </div>

                {isManager && (
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 font-bold transition-colors cursor-pointer"
                    title="Transfer deal ownership with mandatory audited reason"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Ownership</span>
                  </button>
                )}
              </div>

              {/* AI Briefing Box (Strictly Non-Monetary) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <span>AI Pre-Assist Executive Briefing</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-mono">
                  {selectedAssist.aiBriefing}
                </p>
              </div>

              {/* Proposed Meeting Parameters */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-medium block text-[10px]">Decision Maker</span>
                  <span className="font-bold text-slate-900">{selectedAssist.decisionMakerName}</span>
                  <span className="text-slate-500 block text-[11px]">{selectedAssist.decisionMakerTitle}</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 font-medium block text-[10px]">Proposed Session Window</span>
                  <span className="font-bold text-slate-900">{selectedAssist.proposedDate} at {selectedAssist.proposedTime}</span>
                  <span className="text-emerald-700 block text-[11px] font-semibold">Inside 10 AM-4 PM Golden Window</span>
                </div>
              </div>

              {/* Objections & Products of Interest */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="font-bold text-slate-800">Primary Customer Objections / Needs:</span>
                  <p className="text-slate-600 mt-0.5">{selectedAssist.objections || 'Wants reassurance regarding warranty claims turnaround speed.'}</p>
                </div>

                <div>
                  <span className="font-bold text-slate-800">Products Under Evaluation:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {selectedAssist.productsOfInterest.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Manager Actions / Joint Closing */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                {selectedAssist.status === 'Pending' && isManager ? (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleAcceptAssist(selectedAssist)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Accept & Sync Calendar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRescheduleInput(!showRescheduleInput)}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Propose Alternate Time
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeclineAssist(selectedAssist)}
                      className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                ) : selectedAssist.status === 'Accepted' ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleJointClosingWon(selectedAssist)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Execute Contract & Win Deal (Rep Kept Protected)</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Status: {selectedAssist.status}</span>
                  </div>
                )}
              </div>

              {/* Reschedule Picker Modal Drawer */}
              {showRescheduleInput && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 text-xs">
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleProposeReschedule(selectedAssist)}
                    className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg cursor-pointer"
                  >
                    Send Proposal
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="h-64 bg-white rounded-2xl border border-slate-200 flex items-center justify-center text-xs text-slate-400">
              Select an assist request from the queue to view details.
            </div>
          )}
        </div>
      </div>

      {/* Ownership Transfer Modal (Section 3: Manager action with required audited reason) */}
      {showTransferModal && selectedAssist && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
              <span>Transfer Deal Ownership</span>
            </div>

            <p className="text-xs text-slate-500">
              Reassign active ownership for <strong>{selectedAssist.dealershipName}</strong>. 
              Origin attribution will forever remain locked to <strong>{selectedAssist.originRepName}</strong>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Reassign To Rep:</label>
                <select
                  value={transferToRepId}
                  onChange={(e) => setTransferToRepId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="">Select Target Sales Rep...</option>
                  {users.filter(u => u.role === 'veteran_rep' || u.role === 'new_rep').map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mandatory Transfer Reason (Audited):</label>
                <textarea
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Territory boundary realignment or rep medical leave..."
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white h-20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferToRepId || !transferReason.trim()}
                onClick={handleExecuteTransfer}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                Confirm Transfer & Notify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
