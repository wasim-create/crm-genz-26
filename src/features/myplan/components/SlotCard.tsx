import React, { useState } from 'react';
import {
  Car,
  Phone,
  Video,
  Mail,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  GripVertical,
  CheckCircle2,
  Clock,
  MoreVertical,
  Calendar,
  Lock,
  PlusCircle,
  XCircle,
  Trash2
} from 'lucide-react';
import { PlanSlot } from '../types/myplan.types';
import { useMyPlan } from '../context/MyPlanContext';
import { getDistanceBandInfo } from '../engine/schedulingEngine';

interface SlotCardProps {
  slot: PlanSlot;
  isFirst: boolean;
  isLast: boolean;
  onOpenOutcome: (slot: PlanSlot) => void;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  slot,
  isFirst,
  isLast,
  onOpenOutcome
}) => {
  const { moveSlotArrow, extendSlotTime, moveSlotToDay, deleteSlot, biggerText } = useMyPlan();
  const [showMenu, setShowMenu] = useState(false);

  // Left edge border color by workType:
  // Prospect -> emerald
  // Signup / Onboarding -> amber
  // Client -> blue
  const borderLeftColor =
    slot.workType === 'prospect'
      ? 'border-l-emerald-500'
      : slot.workType === 'signup_onboarding'
      ? 'border-l-amber-500'
      : 'border-l-blue-500';

  const workTypeBadge =
    slot.workType === 'prospect'
      ? { text: 'New Prospect', color: 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40' }
      : slot.workType === 'signup_onboarding'
      ? { text: 'Onboarding', color: 'text-amber-300 bg-amber-950/60 border-amber-500/40' }
      : { text: 'Client Care', color: 'text-blue-300 bg-blue-950/60 border-blue-500/40' };

  // Activity Icon & Label
  const getActivityMeta = (type: string) => {
    switch (type) {
      case 'in_person':
        return { icon: Car, label: 'In-person visit', color: 'text-emerald-400' };
      case 'phone':
        return { icon: Phone, label: 'Phone call', color: 'text-blue-400' };
      case 'meet':
        return { icon: Video, label: 'Google Meet', color: 'text-purple-400' };
      case 'email':
        return { icon: Mail, label: 'Email', color: 'text-amber-400' };
      case 'text':
        return { icon: MessageSquare, label: 'Text message', color: 'text-rose-400' };
      default:
        return { icon: Car, label: 'Activity', color: 'text-slate-400' };
    }
  };

  const meta = getActivityMeta(slot.activityType);
  const Icon = meta.icon;
  const bandInfo = getDistanceBandInfo(slot.distanceBand, slot.distanceMiles);

  // Format 12h time
  const [h, m] = (slot.startTime || '10:00').split(':').map(Number);
  const ampm = (h || 0) >= 12 ? 'PM' : 'AM';
  const displayH = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12;
  const timeFormatted = `${displayH}:${String(m || 0).padStart(2, '0')} ${ampm}`;

  const isDone = slot.status === 'done';

  return (
    <div
      className={`relative bg-slate-900 border border-slate-800 rounded-2xl shadow-md border-l-4 ${borderLeftColor} p-4 transition hover:border-slate-700 ${
        isDone ? 'opacity-70 bg-slate-950/50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Main Content Info */}
        <div className="flex-1 min-w-0 space-y-1.5 cursor-pointer" onClick={() => onOpenOutcome(slot)}>
          {/* Top badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Time (Large) */}
            <span className={`font-black text-white tracking-tight ${biggerText ? 'text-xl' : 'text-lg'}`}>
              {timeFormatted}
            </span>

            {/* Work Type Badge */}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${workTypeBadge.color}`}>
              {workTypeBadge.text}
            </span>

            {/* Distance Band Badge */}
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${bandInfo.bg} ${bandInfo.color}`}>
              {bandInfo.shortLabel}
            </span>

            {/* Locked badge if locked */}
            {slot.locked && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/50 text-indigo-300 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}

            {/* Points */}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 ml-auto">
              +{slot.pointsAwarded || (slot.activityType === 'in_person' ? 25 : 15)} pts
            </span>
          </div>

          {/* Dealership Name (Large) */}
          <div className="flex items-center gap-2">
            <h3 className={`font-bold text-white tracking-tight truncate ${biggerText ? 'text-xl' : 'text-base'}`}>
              {slot.dealershipName}
            </h3>
            {isDone && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          </div>

          {/* Activity word + Purpose */}
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span className="flex items-center gap-1 font-semibold text-slate-200">
              <Icon className={`w-4 h-4 ${meta.color}`} />
              {meta.label}
            </span>
            <span>•</span>
            <span className="text-slate-400 truncate">{slot.purpose}</span>
          </div>

          {/* Contact and City */}
          <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
            <span>{slot.dealershipCity}, {slot.dealershipState}</span>
            {slot.contactName && (
              <>
                <span>•</span>
                <span className="text-slate-300 font-medium">
                  {slot.contactName} {slot.contactTitle ? `(${slot.contactTitle})` : ''}
                </span>
              </>
            )}
            <span>•</span>
            <span>{slot.durationMin} min duration</span>
          </div>

          {/* Outcome snippet if completed */}
          {slot.outcome && (
            <div className="mt-2 p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Outcome: <strong>{slot.outcome}</strong> {slot.topupQty ? `(${slot.topupQty} tags)` : ''}</span>
            </div>
          )}
        </div>

        {/* Right side controls: ▲ and ▼ arrow buttons + Drag Handle */}
        <div className="flex flex-col items-center space-y-1 shrink-0 pt-0.5">
          {/* Move Up Button */}
          <button
            disabled={isFirst}
            onClick={() => moveSlotArrow(slot.id, 'up')}
            aria-label="Move stop up"
            title="Move stop up"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition border border-slate-700"
          >
            <ChevronUp className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Move Down Button */}
          <button
            disabled={isLast}
            onClick={() => moveSlotArrow(slot.id, 'down')}
            aria-label="Move stop down"
            title="Move stop down"
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center transition border border-slate-700"
          >
            <ChevronDown className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Quick Context Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(prev => !prev)}
              aria-label="Stop options"
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-9 z-20 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 text-xs text-slate-200">
                <button
                  onClick={() => {
                    extendSlotTime(slot.id, 15);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                  +15 min (Need more time)
                </button>
                <button
                  onClick={() => {
                    extendSlotTime(slot.id, 30);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-blue-400" />
                  +30 min (Need more time)
                </button>
                <button
                  onClick={() => {
                    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                    moveSlotToDay(slot.id, tomorrow);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-700 flex items-center gap-2"
                >
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  Move to tomorrow
                </button>
                <button
                  onClick={() => {
                    deleteSlot(slot.id);
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-950 text-rose-300 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Remove from plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
