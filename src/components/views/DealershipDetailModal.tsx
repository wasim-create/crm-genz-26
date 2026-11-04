import React, { useState } from 'react';
import { 
  Dealership, 
  Contact, 
  Activity, 
  User, 
  AuditLogRecord,
  ProductCatalogItem,
  DealershipProductInterest,
  AssistType
} from '../../types/crm';
import { 
  formatUSDate, 
  formatUSPhone, 
  formatTime12h,
  isGoodVisitWindow 
} from '../../utils/territory';
import { AIService, PreVisitBrief } from '../../services/aiService';
import {
  Building2,
  MapPin,
  Phone,
  Car,
  Clock,
  Flame,
  Briefcase,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  Mic,
  CalendarPlus,
  Send,
  Layers,
  FileText,
  BadgeAlert,
  TrendingUp,
  Check,
  Plus,
  Package
} from 'lucide-react';

interface DealershipDetailModalProps {
  dealership: Dealership;
  allDealerships: Dealership[];
  contacts: Contact[];
  activities: Activity[];
  auditLogs: AuditLogRecord[];
  catalog: ProductCatalogItem[];
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onUpdateDealership: (updated: Dealership) => void;
  onAddActivity: (act: Activity) => void;
  onRequestAssist: (dealership: Dealership, managerId: string, assistType: AssistType, proposedDate: string, proposedTime: string, brief: string) => void;
  onAddContact: (contact: Contact) => void;
  onLogKeyfetchTopup: (dealershipId: string, quantity: number, notes?: string) => void;
}

export const DealershipDetailModal: React.FC<DealershipDetailModalProps> = ({
  dealership,
  allDealerships,
  contacts,
  activities,
  auditLogs,
  catalog,
  currentUser,
  allUsers,
  onClose,
  onUpdateDealership,
  onAddActivity,
  onRequestAssist,
  onAddContact,
  onLogKeyfetchTopup
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'visit_log' | 'products' | 'assist' | 'contacts' | 'audit'>('overview');

  // AI Pre-visit brief state
  const [preVisitBrief, setPreVisitBrief] = useState<PreVisitBrief | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState<boolean>(false);

  // Visit log form
  const [logPurpose, setLogPurpose] = useState('In-Person Discovery');
  const [logContactId, setLogContactId] = useState(contacts?.[0]?.id || '');
  const [logNotes, setLogNotes] = useState('');
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  // Assist request form state
  const repManager = (allUsers || []).find(u => u.id === currentUser?.managerId) || (allUsers || []).find(u => u.role === 'manager');
  const [assistManagerId, setAssistManagerId] = useState<string>(repManager?.id || '');
  const [assistType, setAssistType] = useState<AssistType>('terms_approval');
  const [assistDate, setAssistDate] = useState('2026-11-04');
  const [assistTime, setAssistTime] = useState('11:00');
  const [assistBrief, setAssistBrief] = useState<string>(() => 
    dealership ? AIService.generateManagerAssistBrief(dealership, currentUser?.firstName || 'Rep') : ''
  );

  // Keyfetch topup form state
  const [topupQty, setTopupQty] = useState(300);
  const [topupNotes, setTopupNotes] = useState('Quarterly replenishment order');

  const dealContacts = (contacts || []).filter(c => c.dealershipId === dealership?.id);
  const dealActivities = (activities || []).filter(a => a.dealershipId === dealership?.id);
  const isClient = dealership?.stage === 'Client' || dealership?.stage === 'Onboarding';
  const hasKeyfetch = (dealership?.signedProducts || []).includes('prod_3');

  const handleGenerateBrief = async () => {
    if (!dealership) return;
    setIsLoadingBrief(true);
    const brief = await AIService.generatePreVisitBrief(
      dealership,
      dealActivities,
      currentUser?.firstName || 'Rep'
    );
    setPreVisitBrief(brief);
    setIsLoadingBrief(false);
  };

  const handleSimulateVoiceInput = () => {
    setIsVoiceRecording(true);
    setTimeout(() => {
      setLogNotes('Met GSM on lot. Counted 85 used cars. Walked through key tracking workflow. Very impressed by claims turnaround SLA.');
      setIsVoiceRecording(false);
    }, 800);
  };

  const handleSubmitVisitLog = () => {
    if (!logNotes.trim()) return;

    const newActivity: Activity = {
      id: `act_${Date.now()}`,
      dealershipId: dealership.id,
      dealershipName: dealership.dealershipName,
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      contactId: logContactId || undefined,
      activityType: 'In-Person Visit',
      communicationType: 'In-Person',
      status: 'completed',
      completedAt: new Date().toISOString(),
      plannedDate: new Date().toISOString().split('T')[0],
      isGoodWindow: true,
      notes: logNotes,
      productsDiscussed: ['Vehicle Service Contract (Extended Warranty)', 'Keyfetch'],
      interestLevel: 'High',
      pointsEarned: 40
    };

    onAddActivity(newActivity);
    setLogNotes('');
    setActiveTab('overview');
  };

  const handleToggleProductInterest = (productId: string, level: 'Low' | 'Medium' | 'High') => {
    const existing = dealership.productInterests || [];
    const idx = existing.findIndex(p => p.productId === productId);
    let updated: DealershipProductInterest[];

    if (idx >= 0) {
      updated = existing.filter(p => p.productId !== productId);
    } else {
      const prod = catalog.find(p => p.id === productId);
      updated = [
        ...existing,
        {
          productId,
          productName: prod?.name || 'Product',
          interestLevel: level,
          recordedDate: new Date().toISOString(),
          recordedByUserId: currentUser.id,
          recordedByUserName: currentUser.firstName
        }
      ];
    }

    onUpdateDealership({
      ...dealership,
      productInterests: updated
    });
  };

  const handleSubmitAssistRequest = () => {
    onRequestAssist(
      dealership,
      assistManagerId,
      assistType,
      assistDate,
      assistTime,
      assistBrief
    );
    setActiveTab('overview');
  };

  const handleExecuteTopup = () => {
    onLogKeyfetchTopup(dealership.id, topupQty, topupNotes);
    setTopupQty(250);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-xs">
        {/* Header Banner */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[10px] text-slate-400 font-bold uppercase">{dealership.id}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isClient ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {dealership.stage}
              </span>
              {dealership.hasActiveAssist && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 animate-pulse">
                  Active Manager Assist
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">{dealership.dealershipName}</h2>
            <p className="text-xs text-slate-500">
              {dealership.city}, {dealership.state} {dealership.zipCode} • {dealership.usedCarsOnLot} used cars • F&I: {dealership.fiSystem}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isClient && (
              <button
                type="button"
                onClick={() => setActiveTab('assist')}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Request Assist</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 gap-4 text-xs font-bold shrink-0 bg-white">
          {[
            { id: 'overview', label: 'Overview & Temp' },
            { id: 'visit_log', label: 'Log Visit (+40 pts)' },
            { id: 'products', label: isClient ? 'Servicing & Top-Ups' : 'Scouting Checklist' },
            { id: 'assist', label: 'Manager Assist' },
            { id: 'contacts', label: `Contacts (${dealContacts.length})` },
            { id: 'audit', label: 'Trail & Transfers' }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 border-b-2 transition-colors cursor-pointer capitalize ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: OVERVIEW & RELATIONSHIP TEMPERATURE */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Relationship Temperature Card (Section 7) */}
              {dealership.relationshipTemperature && (
                <div className="bg-linear-to-r from-indigo-50/80 via-white to-purple-50/80 p-4 rounded-2xl border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900 text-xs">Relationship Temperature & Ghosting Radar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-500">
                        Ghosting Risk: <strong className={dealership.relationshipTemperature.ghostingRisk === 'high' ? 'text-rose-600' : 'text-emerald-600'}>{dealership.relationshipTemperature.ghostingRisk}</strong>
                      </span>
                      <span className="text-xl font-black font-mono text-indigo-600">
                        {dealership.relationshipTemperature.score}°
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase">Detected Intent Signals:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(dealership.relationshipTemperature?.intentPhrases || []).map((phrase, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                            "{phrase}"
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-2.5 bg-white/80 rounded-xl border border-slate-200/60">
                      <span className="font-bold text-slate-700 block text-[10px] uppercase">Hesitation / Friction Flags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(dealership.relationshipTemperature?.hesitationPhrases || []).length > 0 ? (
                          (dealership.relationshipTemperature?.hesitationPhrases || []).map((phrase, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium">
                              "{phrase}"
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No significant objections detected.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Pre-Visit Briefing */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>AI Pre-Visit Brief</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateBrief}
                    disabled={isLoadingBrief}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingBrief ? 'Generating...' : preVisitBrief ? 'Regenerate Brief' : 'Generate Brief'}
                  </button>
                </div>

                {preVisitBrief && (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <p className="font-medium text-slate-800">{preVisitBrief.summary}</p>
                    <div>
                      <strong className="text-slate-900 block mb-0.5">Key Talking Points:</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                        {(preVisitBrief.talkingPoints || []).map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: VISIT LOG */}
          {activeTab === 'visit_log' && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>Log Field Visit Notes</span>
                </h4>
                <button
                  type="button"
                  onClick={handleSimulateVoiceInput}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg font-bold text-xs cursor-pointer"
                >
                  <Mic className={`w-3.5 h-3.5 ${isVoiceRecording ? 'animate-pulse text-rose-600' : ''}`} />
                  <span>{isVoiceRecording ? 'Transcribing Audio...' : 'Voice Dictate'}</span>
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lot Notes & Customer Feedback:</label>
                <textarea
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Record decision maker feedback, objections, vehicles counted on lot..."
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white h-24"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitVisitLog}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Save Visit Log</span>
                <span className="bg-blue-500 font-mono text-[10px] px-1.5 py-0.5 rounded">+40 pts</span>
              </button>
            </div>
          )}

          {/* TAB 3: PRODUCTS & SCOUTING (Section 2) */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              {!isClient ? (
                /* Scouting 2-column checklist */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Scouting Product Interest Matrix</h4>
                      <p className="text-[11px] text-slate-500">
                        Check products of interest during discovery. Automatically pre-fills deal sign-up.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {catalog.filter(p => p.isActive).map(prod => {
                      const isInterested = dealership.productInterests?.some(p => p.productId === prod.id);

                      return (
                        <div
                          key={prod.id}
                          onClick={() => handleToggleProductInterest(prod.id, 'High')}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isInterested 
                              ? 'border-blue-500 bg-blue-50/50 shadow-2xs' 
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs">{prod.name}</span>
                              {prod.isNewLaunch && (
                                <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded">
                                  NEW
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block">{prod.category}</span>
                          </div>

                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                            isInterested ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {isInterested && <Check className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Client Servicing: Keyfetch Top-ups & Upsells */
                <div className="space-y-6">
                  {/* Keyfetch Top-ups (ONLY if has Keyfetch!) */}
                  {hasKeyfetch && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-blue-600" />
                          <span>Keyfetch Smart Fob Lot Top-Ups (Quantity Only)</span>
                        </h4>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={topupQty}
                          onChange={(e) => setTopupQty(parseInt(e.target.value, 10) || 0)}
                          className="w-32 p-2 border border-slate-300 rounded-xl bg-white font-mono font-bold"
                          placeholder="Units"
                        />
                        <button
                          type="button"
                          onClick={handleExecuteTopup}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer"
                        >
                          Log Top-Up (+30 pts)
                        </button>
                      </div>

                      <div className="space-y-1.5 pt-2">
                        {dealership.topups?.map(tp => (
                          <div key={tp.id} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                            <span className="font-mono font-bold text-blue-700">{tp.quantity} units</span>
                            <span className="text-slate-500">{tp.date} • Handled by {tp.handledByName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MANAGER ASSIST REQUEST (Section 3) */}
          {activeTab === 'assist' && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-purple-600" />
                  <span>Request Manager Assist for {dealership.dealershipName}</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  You keep full deal ownership through closure. Manager co-attends to accelerate contract signing.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Assisting Manager:</label>
                  <select
                    value={assistManagerId}
                    onChange={(e) => setAssistManagerId(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    {allUsers.filter(u => u.role === 'manager' || u.role === 'owner').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role === 'manager' ? 'Territory Manager' : 'Owner'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assist Session Type:</label>
                  <select
                    value={assistType}
                    onChange={(e) => setAssistType(e.target.value as AssistType)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="terms_approval">Terms Approval Review</option>
                    <option value="in_person_visit">Join In-Person Dealership Visit</option>
                    <option value="google_meet">Join Google Meet Video Session</option>
                    <option value="join_call">Join Phone Conference</option>
                    <option value="strategy_session">Pre-Closing Strategy Session</option>
                    <option value="contract_signing_support">Contract Signing Support</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proposed Date:</label>
                  <input
                    type="date"
                    value={assistDate}
                    onChange={(e) => setAssistDate(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Proposed Time (10a-4p):</label>
                  <input
                    type="time"
                    value={assistTime}
                    onChange={(e) => setAssistTime(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Executive Briefing (No Pricing / Financials):</label>
                <textarea
                  value={assistBrief}
                  onChange={(e) => setAssistBrief(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl bg-white h-24 font-mono text-[11px]"
                />
              </div>

              <button
                type="button"
                onClick={handleSubmitAssistRequest}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Send Assist Request to Manager</span>
                <span className="bg-purple-500 font-mono text-[10px] px-1.5 py-0.5 rounded">+25 pts</span>
              </button>
            </div>
          )}

          {/* TAB 5: CONTACTS */}
          {activeTab === 'contacts' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900">Key Stakeholders & Decision Makers</h4>
              {dealContacts.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{c.firstName} {c.lastName}</span>
                    <span className="text-slate-500 block text-[11px]">{c.jobTitle} • {formatUSPhone(c.phone)}</span>
                  </div>
                  {c.isDecisionMaker && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      Decision Maker
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-slate-900">Dealership Audit Log & Ownership Trail</h4>
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block">Origin Rep: {dealership.originRepId || 'Assigned'}</span>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    Attribution is permanently locked. All introduction and closing rewards flow to origin rep.
                  </p>
                </div>

                {dealership.ownershipTransfers?.map(tx => (
                  <div key={tx.id} className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                    <span className="font-bold text-purple-900 block">Ownership Reassigned</span>
                    <p className="text-[11px] text-purple-800 mt-0.5">
                      Transferred by manager {tx.transferredByManagerName}. Reason: "{tx.reason}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
