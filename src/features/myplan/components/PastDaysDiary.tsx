import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, FileText, Sparkles, Plus } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';

export const PastDaysDiary: React.FC = () => {
  const { slots, updateSlot } = useMyPlan();
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedSlotForNote, setSelectedSlotForNote] = useState<string | null>(null);
  const [lateNote, setLateNote] = useState('');

  // Past slots (prior to today or marked done)
  const pastSlots = slots
    .filter(s => s.date < todayStr || s.status === 'done')
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleAddLateNote = (slotId: string) => {
    if (!lateNote.trim()) return;
    const existing = pastSlots.find(s => s.id === slotId)?.notes || '';
    updateSlot(slotId, {
      notes: existing ? `${existing} · [Late Note: ${lateNote}]` : lateNote
    });
    setLateNote('');
    setSelectedSlotForNote(null);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-5 pb-24">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          Past Days Diary
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Historical record of planned stops, completed outcomes, and earned gamification points.
        </p>
      </div>

      <div className="space-y-3">
        {pastSlots.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-slate-900/50 rounded-2xl border border-slate-800">
            No completed history recorded yet. Complete activities on your timeline to see them here.
          </div>
        ) : (
          pastSlots.map(s => (
            <div
              key={s.id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-400">{s.date} · {s.startTime}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Done
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-base">{s.dealershipName}</h3>
                  <p className="text-xs text-slate-400">{s.dealershipCity} · {s.purpose}</p>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/30">
                  +{s.pointsAwarded || 25} pts
                </span>
              </div>

              {s.outcome && (
                <div className="text-xs text-emerald-300 bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/30">
                  <strong>Outcome:</strong> {s.outcome} {s.topupQty ? `(${s.topupQty} Keyfetch tags restocked)` : ''}
                </div>
              )}

              {s.notes && (
                <div className="text-xs text-slate-300 italic bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
                  "{s.notes}"
                </div>
              )}

              {selectedSlotForNote === s.id ? (
                <div className="space-y-2 pt-2">
                  <textarea
                    rows={2}
                    value={lateNote}
                    onChange={e => setLateNote(e.target.value)}
                    placeholder="Add an additional note to this past activity..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedSlotForNote(null)}
                      className="px-3 py-1 rounded-lg text-xs text-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddLateNote(s.id)}
                      className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => setSelectedSlotForNote(s.id)}
                    className="text-[11px] font-semibold text-slate-400 hover:text-amber-400 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add late note
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
