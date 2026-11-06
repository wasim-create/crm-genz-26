import React, { useState, useMemo } from 'react';
import {
  Car,
  Phone,
  Video,
  Mail,
  MessageSquare,
  ArrowLeft,
  Search,
  Check,
  Clock,
  Sparkles,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Flame,
  User as UserIcon,
  X
} from 'lucide-react';
import {
  ActivityType,
  WorkType,
  DistanceBand,
  PlanSlot
} from '../../types/myplan.types';
import { useMyPlan } from '../../context/MyPlanContext';
import {
  calculateDistanceMiles,
  getDistanceBand,
  getDistanceBandInfo,
  findBestSlots,
  isWithinLiveContactWindow,
  estimateDriveTimeMinutes,
  createEmailBatchSlots,
  createCallListSlots,
  findNearbyDealerships
} from '../../engine/schedulingEngine';

interface AddFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  dealerships: any[];
  contacts?: any[];
  currentUser: any;
  preselected?: {
    dealership?: any;
    activityType?: ActivityType;
  } | null;
  onTriggerTrip: (anchor: any, nearby: any[]) => void;
}

export const AddFlowModal: React.FC<AddFlowModalProps> = ({
  isOpen,
  onClose,
  dealerships = [],
  contacts = [],
  currentUser,
  preselected,
  onTriggerTrip
}) => {
  const {
    activeDate,
    daySettings,
    addSlot,
    addBatchSlots,
    activeDateSlots,
    biggerText
  } = useMyPlan();

  // Wizard state
  const [step, setStep] = useState<number>(1);
  const [activityType, setActivityType] = useState<ActivityType>(
    preselected?.activityType || 'in_person'
  );
  const [activeTab, setActiveTab] = useState<'prospects' | 'onboarding' | 'clients'>('prospects');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDealership, setSelectedDealership] = useState<any>(preselected?.dealership || null);
  const [batchSelectedIds, setBatchSelectedIds] = useState<string[]>([]);
  
  // Step 2 Contact & Purpose
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('First visit & lot walk');
  const [emailMessageDraft, setEmailMessageDraft] = useState<string>(
    'Hi, following up on our recent conversation regarding automotive lot inventory solutions.'
  );

  // Step 3 Slot Time
  const [selectedTime, setSelectedTime] = useState<string>('10:30');
  const [customTime, setCustomTime] = useState<string>('10:30');
  const [customMode, setCustomMode] = useState<boolean>(false);
  const [goldenWindowWarningIgnored, setGoldenWindowWarningIgnored] = useState<boolean>(false);

  // Step 4 Proximity suggestion follow up
  const [proximityFollowUp, setProximityFollowUp] = useState<any[] | null>(null);

  const isMultiSelect = activityType === 'email' || activityType === 'text';

  // Compute distances for current user
  const userHomeZip = currentUser?.homeZipCode || currentUser?.homeZip || '75001';

  const dealershipsWithDistance = useMemo(() => {
    return dealerships.map(d => {
      const miles = calculateDistanceMiles(
        userHomeZip,
        d.zipCode || d.zip || d.address || '75001'
      );
      const band = getDistanceBand(miles, daySettings);
      return {
        ...d,
        distanceMiles: miles,
        distanceBand: band
      };
    });
  }, [dealerships, userHomeZip, daySettings]);

  // Filter dealerships by tab and search
  const filteredDealerships = useMemo(() => {
    return dealershipsWithDistance.filter(d => {
      if (activeTab === 'prospects') {
        const isProspect = ['Pool', 'Bench', 'Pitching', 'Trial'].includes(d.stage);
        if (!isProspect) return false;
      } else if (activeTab === 'onboarding') {
        if (d.stage !== 'Onboarding') return false;
      } else if (activeTab === 'clients') {
        if (d.stage !== 'Client') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = d.dealershipName.toLowerCase().includes(q);
        const matchesCity = (d.city || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCity) return false;
      }

      return true;
    }).sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [dealershipsWithDistance, activeTab, searchQuery]);

  // Available contacts for selected dealership
  const availableContacts = useMemo(() => {
    if (!selectedDealership) return [];
    return contacts.filter(c => c.dealershipId === selectedDealership.id);
  }, [selectedDealership, contacts]);

  // Dynamic slot suggestions from deterministic engine
  const slotSuggestions = useMemo(() => {
    const driveEst = selectedDealership
      ? estimateDriveTimeMinutes(selectedDealership.distanceMiles)
      : 15;
    return findBestSlots(45, activeDateSlots, driveEst);
  }, [selectedDealership, activeDateSlots]);

  if (!isOpen) return null;

  // Handler for picking dealership
  const handleSelectDealership = (d: any) => {
    if (isMultiSelect) {
      setBatchSelectedIds(prev =>
        prev.includes(d.id) ? prev.filter(x => x !== d.id) : [...prev, d.id]
      );
      return;
    }

    setSelectedDealership(d);

    // If out of town and in-person, prompt Trip
    if (activityType === 'in_person' && d.distanceBand === 'out_of_town') {
      const nearby = findNearbyDealerships(d, dealershipsWithDistance, 15);
      onTriggerTrip(d, nearby);
      onClose();
      return;
    }

    // Set smart default purpose
    if (d.stage === 'Client') {
      setPurpose('Keyfetch top-up');
    } else if (d.stage === 'Onboarding') {
      setPurpose('Contract signing & onboarding');
    } else {
      setPurpose('First visit & lot walk');
    }

    // Auto-select contact if only 1
    const matchingContacts = contacts.filter(c => c.dealershipId === d.id);
    if (matchingContacts.length === 1) {
      setSelectedContactId(matchingContacts[0].id);
    }

    setStep(2);
  };

  const handleConfirmBatch = () => {
    const selected = dealershipsWithDistance.filter(d => batchSelectedIds.includes(d.id));
    if (selected.length === 0) return;

    if (activityType === 'email') {
      const slots = createEmailBatchSlots(
        selected.map(s => ({
          id: s.id,
          name: s.dealershipName,
          city: s.city,
          state: s.state,
          distanceMiles: s.distanceMiles,
          band: s.distanceBand
        })),
        currentUser.id,
        activeDate,
        emailMessageDraft,
        10,
        15
      );
      addBatchSlots(slots);
      onClose();
    } else {
      // Call list
      const slots = createCallListSlots(
        selected.map(s => ({
          id: s.id,
          name: s.dealershipName,
          city: s.city,
          state: s.state,
          distanceMiles: s.distanceMiles,
          band: s.distanceBand,
          workType: s.stage === 'Client' ? 'client' : 'prospect'
        })),
        currentUser.id,
        activeDate,
        10,
        30
      );
      addBatchSlots(slots);
      onClose();
    }
  };

  const handleFinalAddSingle = () => {
    if (!selectedDealership) return;

    const chosenTime = customMode ? customTime : selectedTime;
    const selectedContact = availableContacts.find(c => c.id === selectedContactId) || availableContacts[0];

    const newSlot: PlanSlot = {
      id: `slot_${Date.now()}`,
      userId: currentUser.id,
      date: activeDate,
      timeType: 'exact',
      startTime: chosenTime,
      durationMin: activityType === 'in_person' ? 45 : (activityType === 'phone' ? 15 : 30),
      travelBeforeMin: estimateDriveTimeMinutes(selectedDealership.distanceMiles),
      orderIndex: activeDateSlots.length,
      workType: selectedDealership.stage === 'Client' ? 'client' : (selectedDealership.stage === 'Onboarding' ? 'signup_onboarding' : 'prospect'),
      activityType,
      purpose,
      dealershipId: selectedDealership.id,
      dealershipName: selectedDealership.dealershipName,
      dealershipCity: selectedDealership.city,
      dealershipState: selectedDealership.state,
      contactId: selectedContact?.id,
      contactName: selectedContact ? `${selectedContact.firstName} ${selectedContact.lastName}` : (selectedDealership.primaryContactName || 'Decision Maker'),
      contactTitle: selectedContact?.jobTitle || 'General Manager',
      contactPhone: selectedContact?.phone || selectedDealership.phone,
      distanceBand: selectedDealership.distanceBand,
      distanceMiles: selectedDealership.distanceMiles,
      source: 'manual',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    addSlot(newSlot);

    // If in-person, check nearby proximity follow up
    if (activityType === 'in_person') {
      const nearby = findNearbyDealerships(selectedDealership, dealershipsWithDistance, 10);
      if (nearby.length > 0) {
        setProximityFollowUp(nearby.slice(0, 3));
        setStep(4);
        return;
      }
    }

    onClose();
  };

  const isCustomOutsideGoldenWindow = !isWithinLiveContactWindow(customTime);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-none sm:rounded-2xl w-full max-w-2xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header with Step indicator & summary */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {step > 1 && (
              <button
                onClick={() => setStep(prev => prev - 1)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className={`font-black text-white tracking-tight ${biggerText ? 'text-2xl' : 'text-xl'}`}>
                {step === 1 ? 'Add to My Plan' : step === 2 ? 'Purpose & Contact' : step === 3 ? 'When' : 'Nearby Opportunities'}
              </h2>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                {selectedDealership && (
                  <span className="text-amber-400 font-semibold truncate max-w-[200px]">
                    {selectedDealership.dealershipName}
                  </span>
                )}
                <span>•</span>
                <span>Step {step} of {step === 4 ? 4 : 3}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: What & Who */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
            {/* "What do you want to do?" */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                What do you want to do?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: 'in_person' as ActivityType, label: 'In-person visit', icon: Car },
                  { id: 'phone' as ActivityType, label: 'Phone call', icon: Phone },
                  { id: 'meet' as ActivityType, label: 'Google Meet', icon: Video },
                  { id: 'email' as ActivityType, label: 'Email', icon: Mail },
                  { id: 'text' as ActivityType, label: 'Text message', icon: MessageSquare }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = activityType === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivityType(item.id);
                        setBatchSelectedIds([]);
                      }}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center transition ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span className="text-xs font-semibold truncate w-full">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {isMultiSelect && (
                <div className="mt-2.5 px-3 py-2 rounded-lg bg-blue-950/40 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
                  <span>Multi-select active: Tick multiple dealerships to create separate individual {activityType} slots.</span>
                  <span className="font-bold text-white">{batchSelectedIds.length} selected</span>
                </div>
              )}
            </div>

            {/* "Who with?" Tabs & Filter */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Who with?
              </label>

              {/* Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-slate-800/80 rounded-xl border border-slate-700 text-xs">
                {[
                  { id: 'prospects', label: 'Prospects' },
                  { id: 'onboarding', label: 'Sign-up & Onboarding' },
                  { id: 'clients', label: 'Clients' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`flex-1 py-2 rounded-lg font-bold transition ${
                      activeTab === t.id
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search dealership name or city..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Dealership List */}
              <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                {filteredDealerships.slice(0, 15).map(d => {
                  const isChecked = batchSelectedIds.includes(d.id);
                  const bandInfo = getDistanceBandInfo(d.distanceBand, d.distanceMiles);

                  return (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDealership(d)}
                      className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        isChecked
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {isMultiSelect && (
                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              isChecked
                                ? 'bg-amber-500 border-amber-400 text-slate-950 font-bold'
                                : 'border-slate-600 bg-slate-900'
                            }`}
                          >
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">{d.dealershipName}</span>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${bandInfo.bg} ${bandInfo.color}`}>
                              {bandInfo.shortLabel}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {d.city}, {d.state} · Stage: {d.stage} · {d.usedCarsOnLot || 0} used lot
                          </div>
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Contact & Purpose */}
        {step === 2 && selectedDealership && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
            {/* Dealership Banner */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">{selectedDealership.dealershipName}</h3>
                <p className="text-xs text-slate-400">{selectedDealership.city}, {selectedDealership.state}</p>
              </div>
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                {selectedDealership.stage}
              </span>
            </div>

            {/* Contact Selection */}
            {availableContacts.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Contact Person
                </label>
                <div className="space-y-1.5">
                  {availableContacts.map(c => (
                    <div
                      key={c.id}
                      onClick={() => setSelectedContactId(c.id)}
                      className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        selectedContactId === c.id
                          ? 'bg-amber-500/15 border-amber-500 text-white'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-bold text-sm text-white">{c.firstName} {c.lastName}</div>
                          <div className="text-xs text-slate-400">{c.jobTitle} · {c.phone}</div>
                        </div>
                      </div>
                      {selectedContactId === c.id && <Check className="w-4 h-4 text-amber-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Purpose Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Visit Purpose
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'First visit & lot walk',
                  'Keyfetch top-up',
                  'Product demo & pitch',
                  'Contract signing',
                  'Manager Assist meeting',
                  'General check-in'
                ].map(p => (
                  <button
                    key={p}
                    onClick={() => setPurpose(p)}
                    className={`p-3 rounded-xl border text-left text-xs font-semibold transition ${
                      purpose === p
                        ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Message draft if email */}
            {activityType === 'email' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Email Message Draft
                </label>
                <textarea
                  rows={3}
                  value={emailMessageDraft}
                  onChange={e => setEmailMessageDraft(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3: When */}
        {step === 3 && selectedDealership && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Best Available Slots (Code Calculates)
              </label>
              <div className="space-y-2.5">
                {slotSuggestions.map(s => {
                  const isSelected = !customMode && selectedTime === s.time;
                  return (
                    <div
                      key={s.time}
                      onClick={() => {
                        setSelectedTime(s.time);
                        setCustomMode(false);
                      }}
                      className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                        isSelected
                          ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="text-base font-black text-white">{s.label}</div>
                        <div className="text-xs text-emerald-300/90">{s.reason}</div>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Time Selection */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Or Pick Custom Time</span>
                <button
                  onClick={() => setCustomMode(prev => !prev)}
                  className="text-xs font-semibold text-amber-400 hover:underline"
                >
                  {customMode ? 'Use Suggestions' : 'Custom Time'}
                </button>
              </div>

              {customMode && (
                <div className="space-y-3 pt-1">
                  <input
                    type="time"
                    value={customTime}
                    onChange={e => setCustomTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                  />

                  {/* Golden Window Warning */}
                  {isCustomOutsideGoldenWindow && !goldenWindowWarningIgnored && (
                    <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-xs text-amber-200 space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <span>Outside Live Contact Window</span>
                      </div>
                      <p className="text-amber-200/90 leading-relaxed">
                        Dealerships are usually busy in morning meetings before 10:00 AM. Best contact window is 10:00 AM – 4:00 PM.
                      </p>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            setCustomTime('10:15');
                            setGoldenWindowWarningIgnored(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                        >
                          Switch to 10:15 AM
                        </button>
                        <button
                          onClick={() => setGoldenWindowWarningIgnored(true)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 text-white font-medium text-xs border border-slate-600"
                        >
                          Keep {customTime} anyway
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 4: Proximity Suggestions Prompt */}
        {step === 4 && proximityFollowUp && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
            <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Added {selectedDealership?.dealershipName}! We found nearby dealerships within 10 miles:</span>
            </div>

            <div className="space-y-2">
              {proximityFollowUp.map(n => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-white text-sm">{n.dealershipName}</h4>
                    <p className="text-xs text-slate-400">{n.city} · {n.distanceMiles} miles from home</p>
                  </div>
                  <button
                    onClick={() => {
                      // Add this stop right after
                      handleSelectDealership(n);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                  >
                    Add to Today
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
            >
              Done (Finish Planning)
            </button>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>

          {step === 1 && isMultiSelect && (
            <button
              disabled={batchSelectedIds.length === 0}
              onClick={handleConfirmBatch}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs shadow-md transition"
            >
              Schedule {batchSelectedIds.length} {activityType}s
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition"
            >
              Continue to Time
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleFinalAddSingle}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition"
            >
              Save to My Plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
