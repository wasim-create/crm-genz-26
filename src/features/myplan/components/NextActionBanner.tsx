import React, { useState } from 'react';
import {
  Car,
  Phone,
  Video,
  Mail,
  MessageSquare,
  Navigation,
  CheckCircle2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { PlanSlot } from '../types/myplan.types';

interface NextActionBannerProps {
  slot: PlanSlot;
  onOpenOutcome: (slot: PlanSlot) => void;
}

export const NextActionBanner: React.FC<NextActionBannerProps> = ({
  slot,
  onOpenOutcome
}) => {
  const [driveState, setDriveState] = useState<'idle' | 'driving' | 'arrived'>('idle');

  const renderActionButton = () => {
    switch (slot.activityType) {
      case 'in_person':
        if (driveState === 'idle') {
          return (
            <button
              onClick={() => {
                setDriveState('driving');
                window.open(`https://maps.google.com/?q=${encodeURIComponent(`${slot.dealershipName} ${slot.dealershipCity} ${slot.dealershipState}`)}`, '_blank');
              }}
              className="w-full h-13 py-3 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98]"
            >
              <Navigation className="w-5 h-5 fill-slate-950" />
              <span>Start driving (Open Maps)</span>
            </button>
          );
        } else if (driveState === 'driving') {
          return (
            <button
              onClick={() => setDriveState('arrived')}
              className="w-full h-13 py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
            >
              <Car className="w-5 h-5" />
              <span>I've arrived at lot</span>
            </button>
          );
        } else {
          return (
            <button
              onClick={() => onOpenOutcome(slot)}
              className="w-full h-13 py-3 px-5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition active:scale-[0.98]"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>Done – How did it go?</span>
            </button>
          );
        }

      case 'phone':
        return (
          <div className="flex gap-2">
            <a
              href={`tel:${slot.contactPhone || '5550100'}`}
              className="flex-1 h-13 py-3 px-5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition active:scale-[0.98]"
            >
              <Phone className="w-5 h-5" />
              <span>Call {slot.contactName || 'Dealership'} ({slot.contactPhone || '555-0100'})</span>
            </a>
            <button
              onClick={() => onOpenOutcome(slot)}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition"
            >
              Log
            </button>
          </div>
        );

      case 'meet':
        return (
          <div className="flex gap-2">
            <a
              href="https://meet.google.com"
              target="_blank"
              rel="noreferrer"
              className="flex-1 h-13 py-3 px-5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 transition active:scale-[0.98]"
            >
              <Video className="w-5 h-5" />
              <span>Join Google Meet</span>
            </a>
            <button
              onClick={() => onOpenOutcome(slot)}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition"
            >
              Log
            </button>
          </div>
        );

      case 'email':
        return (
          <button
            onClick={() => onOpenOutcome(slot)}
            className="w-full h-13 py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
          >
            <Mail className="w-5 h-5" />
            <span>Review & Send Email</span>
          </button>
        );

      case 'text':
        return (
          <a
            href={`sms:${slot.contactPhone || '5550100'}?body=${encodeURIComponent(slot.message || 'Hi, checking in regarding your dealership inventory!')}`}
            onClick={() => onOpenOutcome(slot)}
            className="w-full h-13 py-3 px-5 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition active:scale-[0.98]"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Send Text Message</span>
          </a>
        );
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-amber-500/60 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-3 py-1 rounded-bl-xl tracking-wider">
        Up Next
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
            {slot.startTime} · NEXT ACTION
          </span>
          <h2 className="text-xl font-black text-white tracking-tight mt-0.5">
            {slot.dealershipName}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            {slot.purpose} · {slot.contactName ? `${slot.contactName} (${slot.contactTitle || 'Decision Maker'})` : slot.dealershipCity}
          </p>
        </div>

        {/* Big Action Button */}
        <div className="pt-1">{renderActionButton()}</div>
      </div>
    </div>
  );
};
