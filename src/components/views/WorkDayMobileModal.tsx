import React, { useState } from 'react';
import { Dealership, User, GamificationProfile } from '../../types/crm';
import { formatUSPhone, isGoodVisitWindow } from '../../utils/territory';
import {
  Smartphone,
  Navigation,
  MapPin,
  Clock,
  Mic,
  CheckCircle2,
  ChevronRight,
  Flame,
  Car,
  Sparkles,
  Zap,
  Check,
  X
} from 'lucide-react';

interface WorkDayMobileModalProps {
  stops: Dealership[];
  currentUser: User;
  gamificationProfile?: GamificationProfile;
  onClose: () => void;
  onLogCompletedStop: (dealership: Dealership, notes: string, isHot: boolean) => void;
}

export const WorkDayMobileModal: React.FC<WorkDayMobileModalProps> = ({
  stops,
  currentUser,
  gamificationProfile,
  onClose,
  onLogCompletedStop
}) => {
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [logNotes, setLogNotes] = useState('');
  const [isHot, setIsHot] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const currentDealership = stops[currentStopIndex];

  if (!currentDealership) {
    return (
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 text-center max-w-sm w-full space-y-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          <h3 className="font-bold text-lg text-slate-900">All Scheduled Stops Completed!</h3>
          <p className="text-xs text-slate-500">
            Great field execution today! All planned visits logged and synchronized.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    `${currentDealership.address}, ${currentDealership.city}, ${currentDealership.state} ${currentDealership.zipCode}`
  )}`;

  const handleSimulateVoice = () => {
    setIsDictating(true);
    setTimeout(() => {
      setLogNotes('Met GSM on lot. Demonstrated laser-etched Keyfetch fobs and reviewed warranty claims SLA. Very enthusiastic to sign contract.');
      setIsHot(true);
      setIsDictating(false);
    }, 800);
  };

  const handleFinishStop = () => {
    onLogCompletedStop(
      currentDealership,
      logNotes || 'Completed in-person walk-around and discussion.',
      isHot
    );
    setLogNotes('');
    setIsCheckedIn(false);
    setIsHot(false);
    if (currentStopIndex + 1 < stops.length) {
      setCurrentStopIndex(currentStopIndex + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex flex-col justify-between p-3 md:p-6 overflow-y-auto">
      <div className="max-w-md w-full mx-auto space-y-4 my-auto">
        {/* Top Mobile Game Strip (Section 8) */}
        {gamificationProfile && (
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="font-mono text-amber-400">LVL {gamificationProfile.level}</span>
              <span>{gamificationProfile.levelTitle}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-indigo-400">
                {gamificationProfile.pointsToday}/{gamificationProfile.dailyTarget} pts
              </span>
              <span className="flex items-center gap-0.5 text-orange-400 font-bold font-mono">
                <Flame className="w-3.5 h-3.5 fill-current" /> {gamificationProfile.streakDays}d
              </span>
            </div>
          </div>
        )}

        {/* Current Stop Card */}
        <div className="bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
              Stop {currentStopIndex + 1} of {stops.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              Exit
            </button>
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900 leading-tight">
              {currentDealership.dealershipName}
            </h2>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDealership.address}, {currentDealership.city}</span>
            </p>
            <div className="text-xs text-slate-600 mt-2 flex items-center gap-3">
              <span>{currentDealership.usedCarsOnLot} used cars</span>
              <span>•</span>
              <span>F&I: {currentDealership.fiSystem}</span>
            </div>
          </div>

          {/* GPS Navigation & Check-in Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <a
              href={navUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs"
            >
              <Navigation className="w-4 h-4" />
              <span>GPS Maps</span>
            </a>

            <button
              type="button"
              onClick={() => setIsCheckedIn(true)}
              className={`py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                isCheckedIn 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isCheckedIn ? 'Checked In' : 'Check In (+10)'}</span>
            </button>
          </div>

          {/* Quick Log Area */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-800">Visit Notes & Feedback</span>
              <button
                type="button"
                onClick={handleSimulateVoice}
                className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded flex items-center gap-1"
              >
                <Mic className="w-3 h-3" />
                <span>{isDictating ? 'Recording...' : 'Dictate'}</span>
              </button>
            </div>

            <textarea
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Record feedback, objections, cars on lot..."
              className="w-full p-3 border border-slate-300 rounded-xl text-xs h-20"
            />

            <button
              type="button"
              onClick={handleFinishStop}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Complete & Move to Next</span>
              <span className="bg-blue-500 font-mono text-[10px] px-1.5 py-0.5 rounded">+40 pts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
