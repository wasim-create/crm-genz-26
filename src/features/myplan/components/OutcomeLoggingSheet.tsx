import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Flame,
  MessageCircle,
  Clock,
  ThumbsDown,
  Sparkles,
  Key,
  TrendingUp,
  AlertCircle,
  Mic,
  Calendar,
  Save
} from 'lucide-react';
import { PlanSlot } from '../types/myplan.types';
import { useMyPlan } from '../context/MyPlanContext';

interface OutcomeLoggingSheetProps {
  slot: PlanSlot;
  onClose: () => void;
  onPlanNextStep: (dealership: any) => void;
}

export const OutcomeLoggingSheet: React.FC<OutcomeLoggingSheetProps> = ({
  slot,
  onClose,
  onPlanNextStep
}) => {
  const { logSlotOutcome, biggerText } = useMyPlan();
  const [selectedOutcome, setSelectedOutcome] = useState<string>(slot.outcome || '');
  const [notes, setNotes] = useState<string>(slot.notes || '');
  const [topupQty, setTopupQty] = useState<number>(slot.topupQty || 250);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);

  const isClient = slot.workType === 'client';
  const isKeyfetch = slot.purpose.toLowerCase().includes('keyfetch') || isClient;

  // Outcome buttons
  const prospectOutcomes = [
    { label: 'Hot / Contract Signing', icon: Flame, color: 'hover:bg-rose-950/70 border-rose-500/50 text-rose-300' },
    { label: 'Interested', icon: MessageCircle, color: 'hover:bg-emerald-950/70 border-emerald-500/50 text-emerald-300' },
    { label: 'Needs Follow-Up', icon: Clock, color: 'hover:bg-amber-950/70 border-amber-500/50 text-amber-300' },
    { label: 'Not Now', icon: ThumbsDown, color: 'hover:bg-slate-800 border-slate-700 text-slate-400' }
  ];

  const clientOutcomes = [
    { label: 'All Good', icon: CheckCircle2, color: 'hover:bg-emerald-950/70 border-emerald-500/50 text-emerald-300' },
    { label: 'Top-up Done', icon: Key, color: 'hover:bg-blue-950/70 border-blue-500/50 text-blue-300' },
    { label: 'Upsell Interest', icon: TrendingUp, color: 'hover:bg-purple-950/70 border-purple-500/50 text-purple-300' },
    { label: 'Issue to Fix', icon: AlertCircle, color: 'hover:bg-amber-950/70 border-amber-500/50 text-amber-300' }
  ];

  const outcomes = isClient ? clientOutcomes : prospectOutcomes;

  const handleSave = () => {
    if (!selectedOutcome) return;
    const pts = isKeyfetch && topupQty > 0 ? 35 : (selectedOutcome === 'Interested' || selectedOutcome === 'All Good' ? 25 : 15);
    logSlotOutcome(slot.id, selectedOutcome, notes, isKeyfetch ? topupQty : undefined);
    setPointsEarned(pts);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className={`font-black text-white tracking-tight ${biggerText ? 'text-2xl' : 'text-xl'}`}>
              How did it go?
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {slot.dealershipName} · {slot.activityType.replace('_', ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Celebration Toast upon logging */}
        {pointsEarned !== null && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-900 to-teal-900 border border-emerald-500/60 text-white text-center animate-bounce">
            <Sparkles className="w-6 h-6 mx-auto mb-1 text-emerald-300" />
            <div className="text-base font-black">+{pointsEarned} Points Logged!</div>
            <div className="text-xs text-emerald-200">Activity logged and tracked on your record.</div>
          </div>
        )}

        {/* Big Outcome Selection Buttons */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Select Visit Outcome
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {outcomes.map(item => {
              const Icon = item.icon;
              const isSelected = selectedOutcome === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => setSelectedOutcome(item.label)}
                  className={`p-3.5 rounded-xl border text-left flex items-center space-x-2.5 transition ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md'
                      : `bg-slate-800/60 border-slate-700/60 text-slate-300 ${item.color}`
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-amber-400' : ''}`} />
                  <span className="text-xs font-semibold leading-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Keyfetch Top-up Quantity Box (Strictly quantity, zero dollar values) */}
        {isKeyfetch && (
          <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-blue-400" />
                Keyfetch Tag Replenishment
              </span>
              <span className="text-[11px] font-bold text-blue-300">Quantity Only</span>
            </div>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="0"
                step="50"
                value={topupQty}
                onChange={e => setTopupQty(parseInt(e.target.value, 10) || 0)}
                className="w-32 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold text-sm focus:outline-none focus:border-blue-500"
              />
              <span className="text-xs text-slate-400">physical tags restocked at dealership</span>
            </div>
          </div>
        )}

        {/* Quick Voice / Text Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Notes & Key Takeaways
            </label>
            <button
              onClick={() => {
                setIsVoiceRecording(prev => !prev);
                if (!isVoiceRecording) {
                  setNotes(prev => (prev ? prev + ' ' : '') + 'Discussed inventory backlog; requested follow up on Thursday.');
                }
              }}
              className={`text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1 transition ${
                isVoiceRecording
                  ? 'bg-rose-950 border-rose-500 text-rose-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isVoiceRecording ? 'Listening...' : 'Voice Note'}</span>
            </button>
          </div>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Type key discussion points, requested proposals, or next steps..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            disabled={!selectedOutcome}
            onClick={handleSave}
            className="flex-1 py-3.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Outcome</span>
          </button>

          <button
            onClick={() => {
              handleSave();
              onPlanNextStep({
                id: slot.dealershipId,
                dealershipName: slot.dealershipName,
                city: slot.dealershipCity,
                state: slot.dealershipState,
                stage: slot.workType === 'prospect' ? 'Follow-up' : 'Client'
              });
            }}
            className="py-3.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Plan Next Step</span>
          </button>
        </div>
      </div>
    </div>
  );
};
