import React from 'react';
import { MessageSquare, Send, Trash2, X, Clock, CheckCircle } from 'lucide-react';
import { useMyPlan } from '../context/MyPlanContext';

export const TextQueueDrawer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose
}) => {
  const { sendQueue, removeSendQueueItem, markSendQueueItemSent } = useMyPlan();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 h-full p-6 space-y-5 border-l border-slate-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">Text Queue</h2>
              <p className="text-xs text-slate-400">Pre-filled SMS dispatch list</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
          {sendQueue.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              No pending texts in queue. Batch text messages will queue here.
            </div>
          ) : (
            sendQueue.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{item.dealershipName}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.status === 'sent' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    {item.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 italic bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  "{item.body}"
                </p>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Send at: {item.sendAt.replace('T', ' ')}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => removeSendQueueItem(item.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <a
                      href={`sms:${item.recipient}?body=${encodeURIComponent(item.body)}`}
                      onClick={() => markSendQueueItemSent(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
