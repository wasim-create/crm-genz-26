import React, { useState } from 'react';
import { WorkspaceItem, Dealership, User } from '../../types/crm';
import { formatDay } from '../../utils/format';
import {
  RefreshCw,
  Mail,
  Calendar,
  Video,
  MessageSquare,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Link,
  PlusCircle,
  EyeOff
} from 'lucide-react';

interface WorkspaceSyncViewProps {
  items: WorkspaceItem[];
  allUsers?: User[];
  dealerships: Dealership[];
  currentUser: User;
  onClose: () => void;
  onSyncNow: () => void;
  isSyncing: boolean;
}

export const WorkspaceSyncView: React.FC<WorkspaceSyncViewProps> = ({
  items: allItems,
  allUsers = [],
  dealerships,
  currentUser,
  onClose,
  onSyncNow,
  isSyncing
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'unmatched' | 'settings'>('feed');

  // Reps see their own Google items; managers also see their team's; owners, executives, finance and admin see everything.
  const team = new Set([currentUser.id, ...allUsers.filter(u => u.managerId === currentUser.id).map(u => u.id)]);
  const seesAll = ['owner', 'executive', 'finance', 'admin'].includes(currentUser.role);
  const items = seesAll ? allItems : allItems.filter(i => team.has(i.userId));
  const matchedItems = items.filter(i => i.isMatched);
  const unmatchedItems = items.filter(i => !i.isMatched);

  const getServiceIcon = (service: WorkspaceItem['service']) => {
    switch (service) {
      case 'Gmail': return <Mail className="w-4 h-4 text-red-500" />;
      case 'Calendar': return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'Meet': return <Video className="w-4 h-4 text-emerald-500" />;
      case 'Chat': return <MessageSquare className="w-4 h-4 text-green-600" />;
      case 'Drive': return <FileText className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-scrim/60 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-ink text-onaccent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-onaccent font-bold">
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Google sync</h3>
              <p className="text-xs text-onink-muted">
                Emails, meetings and calendar events matched to your dealerships
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSyncNow}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-onaccent text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing…' : 'Sync now'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-ink-2 text-onink-muted hover:text-onaccent flex items-center justify-center font-bold"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'feed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Matched ({matchedItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unmatched')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'unmatched' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Needs matching ({unmatchedItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-3 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {/* ACTIVITY STREAM */}
          {activeTab === 'feed' && (
            <div className="space-y-3">
              {matchedItems.map(item => (
                <div key={item.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getServiceIcon(item.service)}
                      <span className="font-bold text-slate-900">{item.service}</span>
                      <span className="text-slate-400">•</span>
                      <span className="font-bold text-blue-700">{item.dealershipName}</span>
                    </div>
                    <span className="text-[13px] text-slate-400">{formatDay(item.date)}</span>
                  </div>

                  <h5 className="font-bold text-slate-800 text-xs">{item.subjectOrTitle}</h5>
                  <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200/60">
                    {item.summary}
                  </p>

                  {item.actionItems && item.actionItems.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl space-y-1">
                      <div className="font-bold text-amber-900 text-[13px] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" /> Action points found:
                      </div>
                      {item.actionItems.map((act, i) => (
                        <div key={i} className="text-[13px] text-amber-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>{act}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.deepLink && (
                    <div className="flex justify-end pt-1">
                      <a
                        href={item.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-bold text-blue-600 hover:underline"
                      >
                        Open in Google {item.service} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* UNMATCHED REVIEW QUEUE */}
          {activeTab === 'unmatched' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Incoming communications that could not be automatically matched by contact email or domain.
              </p>
              {unmatchedItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  No unmatched items. All Google Workspace items reconciled!
                </div>
              ) : (
                unmatchedItems.map(u => (
                  <div key={u.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{u.subjectOrTitle}</span>
                      <span className="text-slate-400 text-[13px]">{formatDay(u.date)}</span>
                    </div>
                    <p className="text-slate-600">{u.summary}</p>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                      <button type="button" className="px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold">
                        Ignore
                      </button>
                      <button type="button" className="px-3 py-1 bg-brand text-onaccent rounded-lg font-bold">
                        Link to Dealership
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CONNECTOR SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                {[
                  { name: 'Gmail Connector', desc: 'Sync emails matched by contact email or dealership web domain', status: 'Active' },
                  { name: 'Google Calendar Connector', desc: 'Sync upcoming meetings and visits, flag bad-time bookings', status: 'Active' },
                  { name: 'Google Meet Connector', desc: 'Import call logs and Gemini "Take notes for me" summaries', status: 'Active' },
                  { name: 'Google Chat Connector', desc: 'Internal discussion threads that mention prospect accounts', status: 'Active' },
                  { name: 'Google Drive / Docs Connector', desc: 'Signed contracts, proposals, and price sheets', status: 'Active' }
                ].map((s, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-slate-900">{s.name}</h5>
                      <p className="text-slate-500 text-[13px]">{s.desc}</p>
                    </div>
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-slate-700 leading-relaxed text-[13px]">
                <strong>Privacy & Domain Security:</strong> OAuth 2.0 uses minimal read-only scopes. Only items matching verified customer domains are indexed into the CRM database.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
