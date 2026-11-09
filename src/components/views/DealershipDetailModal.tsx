// The dealership record: everything about one dealership in one place.
// Header = who they are, where they're at and what's next, with the main
// actions. Tabs: Overview · Activity · Contacts · Products · History.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Car,
  CheckCircle2,
  Flame,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Minus,
  X
} from 'lucide-react';
import { AssistType, Activity, AuditLogRecord, Contact, Dealership, DealershipProductInterest, PipelineStage, ProductCatalogItem, User } from '../../types/crm';
import { calculateDistanceMiles, formatUSPhone } from '../../utils/territory';
import { AIService, PreVisitBrief } from '../../services/aiService';
import { NextStepState } from '../../utils/nextStepStatus';
import { AccountStatusBanner, ActivityTimeline, AuditList, LotHistory, OnboardingChecklist } from './DealershipHistory';
import { Badge, Btn, Dialog, Panel, SectionTitle } from '../ui/kit';
import { NextStepPill } from '../ui/NextStepPill';
import { STAGE_META, stageLabel, stageTone } from '../../utils/stages';
import { formatDay, formatRelative, formatShortDay } from '../../utils/format';
import { ASSIST_TYPE_LABEL } from './ManagerAssistView';

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
  onAddActivity?: (act: Activity) => void;
  /** Opens the same "How did it go?" form as My Plan. */
  onLogVisit?: (dealership: Dealership) => void;
  onRequestAssist: (dealership: Dealership, managerId: string, assistType: AssistType, proposedDate: string, proposedTime: string, brief: string) => void;
  onAddContact: (contact: Contact) => void;
  onLogKeyfetchTopup: (dealershipId: string, quantity: number, notes?: string) => void;
  onAddToPlan?: (dealership: Dealership) => void;
  onPlanLater?: (dealership: Dealership) => void;
  /** My Plan panel: what's planned and the open action points for this dealership. */
  planPanel?: React.ReactNode;
  /** Opens the shared Add Contact form for this dealership. */
  onRequestAddContact?: (dealership: Dealership) => void;
  /** What happens next, and a way to plan it. */
  nextStep?: NextStepState;
  onPlanNextStep?: (dealership: Dealership) => void;
  /** Change the pipeline stage (with any reason fields). */
  onMoveStage?: (dealership: Dealership, stage: PipelineStage, note?: string, patch?: Partial<Dealership>) => void;
}

type Tab = 'overview' | 'activity' | 'contacts' | 'products' | 'history';

const MOVABLE: PipelineStage[] = ['Claimed', 'Visit Planned', 'Visited', 'Follow-up', 'In Progress', 'HOT', 'Negotiation', 'Contract', 'Won', 'Signed', 'Onboarding', 'Client', 'Not Now', 'Lost', 'Disqualified'];
const KEYFETCH = 'prod_3';
const LEVELS: DealershipProductInterest['interestLevel'][] = ['Low', 'Medium', 'High'];

const nextWorkday = () => {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const DealershipDetailModal: React.FC<DealershipDetailModalProps> = props => {
  const { dealership: d, contacts, activities, auditLogs, catalog, currentUser, allUsers, onClose, onUpdateDealership, onLogVisit, onAddToPlan, onPlanLater, planPanel, onRequestAddContact, nextStep, onPlanNextStep, onMoveStage } = props;
  const [tab, setTab] = useState<Tab>('overview');
  const [brief, setBrief] = useState<PreVisitBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(false);
  const [dialog, setDialog] = useState<null | 'assist' | 'stage' | 'edit' | 'topup'>(null);
  const [more, setMore] = useState(false);
  const extra = more ? '' : 'max-sm:hidden';

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !dialog && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  const people = useMemo(() => contacts.filter(c => c.dealershipId === d.id).sort((a, b) => Number(b.isDecisionMaker) - Number(a.isDecisionMaker)), [contacts, d.id]);
  const acts = useMemo(() => activities.filter(a => a.dealershipId === d.id), [activities, d.id]);
  const logs = auditLogs.filter(l => l.dealershipId === d.id);
  const isClient = d.stage === 'Client' || d.stage === 'Onboarding';
  const userName = (id?: string | null) => {
    const u = allUsers.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '—';
  };
  const miles = currentUser.homeCoords ? calculateDistanceMiles(currentUser.homeCoords.lat, currentUser.homeCoords.lng, d.coordinates.lat, d.coordinates.lng) : undefined;
  const hot = d.heatLevel === 'Hot' || d.stage === 'HOT';
  const canAskAssist = !isClient && !['Lost', 'Disqualified', 'Pool'].includes(d.stage);

  const generateBrief = async () => {
    setLoadingBrief(true);
    setBrief(await AIService.generatePreVisitBrief(d, acts, currentUser.firstName || 'Rep'));
    setLoadingBrief(false);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'activity', label: `Activity (${acts.length})` },
    { id: 'contacts', label: `Contacts (${people.length})` },
    { id: 'products', label: isClient ? 'Products & top-ups' : 'Products' },
    { id: 'history', label: 'History' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/60 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={d.dealershipName} onClick={onClose}>
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[92vh] sm:rounded-3xl" onClick={e => e.stopPropagation()}>
        {/* ---------------- Header ---------------- */}
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 pb-0 pt-5 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={stageTone(d.stage)}>{stageLabel(d.stage)}</Badge>
                {hot && d.stage !== 'HOT' && (
                  <Badge tone="red">
                    <Flame className="h-3 w-3" /> Hot
                  </Badge>
                )}
                {d.hasActiveAssist && (
                  <Badge tone="violet">
                    <Briefcase className="h-3 w-3" /> Manager assist
                  </Badge>
                )}
                {d.groupName && <Badge tone="violet">{d.groupName}</Badge>}
                {isClient && (d.clientHealthScore ?? 100) < 70 && <Badge tone="red">At risk · health {d.clientHealthScore}</Badge>}
              </div>
              <h2 className="mt-1.5 text-[24px] font-extrabold leading-tight text-slate-900">{d.dealershipName}</h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {d.city}, {d.state}
                  {miles !== undefined ? ` · ${Math.round(miles)} mi from you` : ''}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Car className="h-4 w-4 text-slate-400" />
                  {d.usedCarsOnLot} used cars
                </span>
                <span>Rep: {userName(d.assignedRepId)}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 cursor-pointer rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-6 w-6" />
            </button>
          </div>

          {nextStep && nextStep.kind !== 'not_applicable' && (
            <div className="mt-3 max-w-xl">
              <NextStepPill state={nextStep} onPlan={onPlanNextStep ? () => onPlanNextStep(d) : undefined} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {onLogVisit && (
              <Btn variant="primary" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => onLogVisit(d)}>
                Log a visit
              </Btn>
            )}
            {onAddToPlan && (
              <Btn
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  onAddToPlan(d);
                  onClose();
                }}
              >
                Add to my plan
              </Btn>
            )}
            {onPlanLater && (
              <Btn
                variant="ghost"
                className={extra}
                onClick={() => {
                  onPlanLater(d);
                  onClose();
                }}
              >
                Plan later
              </Btn>
            )}
            {canAskAssist && (
              <Btn variant="ghost" className={extra} icon={<Briefcase className="h-4 w-4" />} onClick={() => setDialog('assist')}>
                Ask for assist
              </Btn>
            )}
            {onMoveStage && (
              <Btn variant="ghost" className={extra} onClick={() => setDialog('stage')}>
                Change stage
              </Btn>
            )}
            {!more && (
              <Btn variant="ghost" className="sm:hidden" onClick={() => setMore(true)}>
                More…
              </Btn>
            )}
          </div>

          <nav className="-mb-px mt-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Sections">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`cursor-pointer whitespace-nowrap border-b-2 px-3 py-2.5 text-[14px] font-semibold transition ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        {/* ---------------- Body ---------------- */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <AccountStatusBanner dealership={d} users={allUsers} />
                {planPanel}

                <Panel className="space-y-3 p-4">
                  <SectionTitle
                    right={
                      <Btn size="sm" variant="ghost" icon={<Sparkles className="h-4 w-4 text-blue-600" />} onClick={generateBrief} disabled={loadingBrief}>
                        {loadingBrief ? 'Writing…' : brief ? 'Refresh' : 'Write a brief'}
                      </Btn>
                    }
                  >
                    Before you go
                  </SectionTitle>
                  {brief ? (
                    <div className="space-y-2 text-[14px] text-slate-700">
                      <p>{brief.summary}</p>
                      <ul className="list-disc space-y-0.5 pl-5">
                        {(brief.talkingPoints ?? []).map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-[14px] text-slate-500">A short summary of the history, the people and what to talk about.</p>
                  )}
                </Panel>

                <Panel className="space-y-3 p-4">
                  <SectionTitle
                    right={
                      acts.length > 3 && (
                        <Btn size="sm" variant="ghost" onClick={() => setTab('activity')}>
                          See all {acts.length}
                        </Btn>
                      )
                    }
                  >
                    Recent activity
                  </SectionTitle>
                  <RecentActivity acts={acts} />
                </Panel>
              </div>

              <div className="space-y-5">
                <Panel className="p-4">
                  <SectionTitle
                    right={
                      <Btn size="sm" variant="ghost" icon={<Pencil className="h-4 w-4" />} onClick={() => setDialog('edit')}>
                        Edit
                      </Btn>
                    }
                  >
                    Details
                  </SectionTitle>
                  <dl className="mt-2 space-y-2 text-[14px]">
                    <Fact label="Last contact">{d.lastTouchpointDate ? formatRelative(d.lastTouchpointDate) : 'Never'}</Fact>
                    <Fact label="Rep">{userName(d.assignedRepId)}</Fact>
                    {d.originRepId && d.originRepId !== d.assignedRepId && <Fact label="Found by">{userName(d.originRepId)}</Fact>}
                    <Fact label="Used cars">
                      {d.usedCarsOnLot}
                      {d.monthlyUsedSales ? ` · sells ~${d.monthlyUsedSales}/mo` : ''}
                    </Fact>
                    <Fact label="F&I system">{d.fiSystem || '—'}</Fact>
                    <Fact label="Brands">{d.franchiseBrands?.length ? d.franchiseBrands.join(', ') : d.franchiseType}</Fact>
                    <Fact label="Source">{d.source}</Fact>
                    {d.claimedAt && <Fact label="Claimed">{formatShortDay(d.claimedAt)}</Fact>}
                    {isClient && d.clientHealthScore !== undefined && (
                      <Fact label="Health">
                        <span className={d.clientHealthScore < 70 ? 'font-semibold text-rose-700' : ''}>{d.clientHealthScore} / 100</span>
                      </Fact>
                    )}
                  </dl>
                  <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[14px]">
                    {d.phone && (
                      <a href={`tel:${d.phone}`} className="flex items-center gap-2 text-blue-700 hover:underline">
                        <Phone className="h-4 w-4" /> {formatUSPhone(d.phone)}
                      </a>
                    )}
                    {d.website && (
                      <a href={d.website.startsWith('http') ? d.website : `https://${d.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-700 hover:underline">
                        <Globe className="h-4 w-4" /> {d.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    <a href={`https://maps.google.com/?q=${encodeURIComponent(`${d.address}, ${d.city}, ${d.state} ${d.zipCode}`)}`} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-blue-700 hover:underline">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {d.address}, {d.city}, {d.state} {d.zipCode}
                    </a>
                  </div>
                </Panel>

                <Panel className="p-4">
                  <SectionTitle
                    right={
                      <Btn size="sm" variant="ghost" onClick={() => setTab('contacts')}>
                        All
                      </Btn>
                    }
                  >
                    People
                  </SectionTitle>
                  {people.length === 0 ? (
                    <p className="mt-2 text-[14px] text-slate-500">No contacts yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {people.slice(0, 3).map(c => (
                        <ContactLine key={c.id} c={c} />
                      ))}
                    </ul>
                  )}
                  {people.length > 0 && !people.some(c => c.isDecisionMaker) && <p className="mt-2 text-[13px] font-semibold text-amber-700">No decision maker on file yet.</p>}
                </Panel>

                {d.relationshipTemperature && <Temperature t={d.relationshipTemperature} />}
              </div>
            </div>
          )}

          {tab === 'activity' && <ActivityTab dealership={d} acts={acts} />}

          {tab === 'contacts' && (
            <div className="space-y-3">
              <SectionTitle
                right={
                  onRequestAddContact && (
                    <Btn variant="primary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onRequestAddContact(d)}>
                      Add contact
                    </Btn>
                  )
                }
              >
                People at {d.dealershipName}
              </SectionTitle>
              {people.length > 0 && !people.some(c => c.isDecisionMaker) && <p className="text-[14px] font-semibold text-amber-700">No decision maker on file yet.</p>}
              {people.length === 0 ? (
                <Panel className="p-6 text-center text-[14px] text-slate-500">No contacts yet.</Panel>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {people.map(c => (
                    <Panel key={c.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[16px] font-bold text-slate-900">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-[14px] text-slate-600">{c.customTitle || c.jobTitle}</div>
                        </div>
                        {c.isDecisionMaker && (
                          <Badge tone="blue">
                            <Star className="h-3 w-3" /> Decision maker
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-50">
                            <Phone className="h-4 w-4" /> {formatUSPhone(c.phone)}
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-semibold text-slate-800 hover:bg-slate-50">
                            <Mail className="h-4 w-4" /> Email
                          </a>
                        )}
                      </div>
                      {c.notes && <p className="text-[14px] text-slate-600">{c.notes}</p>}
                      <p className="text-[13px] text-slate-500">
                        {(() => {
                          const last = acts.filter(a => a.contactId === c.id && a.completedAt).sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
                          return last ? `Last spoke ${formatRelative(last.completedAt).toLowerCase()} (${last.activityType.toLowerCase()})` : 'Not spoken to yet';
                        })()}
                      </p>
                    </Panel>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-5">
              <OnboardingChecklist dealership={d} users={allUsers} />
              {isClient ? <ClientProducts d={d} catalog={catalog} onTopup={() => setDialog('topup')} /> : <InterestList d={d} catalog={catalog} currentUser={currentUser} onUpdate={onUpdateDealership} />}
              <LotHistory dealership={d} users={allUsers} />
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-4">
              <Panel className="space-y-1 p-4 text-[14px]">
                <div className="font-semibold text-slate-900">Found by {d.originRepId ? userName(d.originRepId) : 'nobody yet (unclaimed)'}</div>
                <p className="text-slate-600">The rep who found a dealership keeps the introduction credit, even if it moves to someone else.</p>
              </Panel>
              {d.ownershipTransfers?.map(tx => (
                <Panel key={tx.id} className="p-4 text-[14px]">
                  <div className="font-semibold text-slate-900">
                    Moved from {userName(tx.fromRepId)} to {userName(tx.toRepId)}
                  </div>
                  <p className="text-slate-600">
                    {formatDay(tx.timestamp)} by {tx.transferredByManagerName}. Reason: {tx.reason}
                  </p>
                </Panel>
              ))}
              <SectionTitle>Changes to this record</SectionTitle>
              <AuditList logs={logs} timeZone={d.timeZone} />
            </div>
          )}
        </div>
      </div>

      {dialog === 'assist' && <AssistDialog {...props} onDone={() => setDialog(null)} />}
      {dialog === 'stage' && onMoveStage && <StageDialog d={d} onMove={onMoveStage} onDone={() => setDialog(null)} />}
      {dialog === 'edit' && <EditDialog d={d} currentUser={currentUser} onSave={onUpdateDealership} onDone={() => setDialog(null)} />}
      {dialog === 'topup' && <TopupDialog d={d} onSave={(q, n) => props.onLogKeyfetchTopup(d.id, q, n)} onDone={() => setDialog(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------- pieces

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="text-right font-medium text-slate-900">{children}</dd>
  </div>
);

const ContactLine: React.FC<{ c: Contact }> = ({ c }) => (
  <li className="flex items-center justify-between gap-2">
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[14px] font-semibold text-slate-900">
        {c.firstName} {c.lastName}
        {c.isDecisionMaker && <Star className="h-3.5 w-3.5 fill-current text-blue-600" aria-label="Decision maker" />}
      </div>
      <div className="truncate text-[13px] text-slate-500">{c.customTitle || c.jobTitle}</div>
    </div>
    {c.phone && (
      <a href={`tel:${c.phone}`} aria-label={`Call ${c.firstName}`} className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50">
        <Phone className="h-4 w-4" />
      </a>
    )}
  </li>
);

const RecentActivity: React.FC<{ acts: Activity[] }> = ({ acts }) => {
  const list = [...acts].sort((a, b) => (b.completedAt ?? b.plannedDate ?? '').localeCompare(a.completedAt ?? a.plannedDate ?? '')).slice(0, 3);
  if (!list.length) return <p className="text-[14px] text-slate-500">Nothing logged yet.</p>;
  return (
    <ul className="divide-y divide-slate-100">
      {list.map(a => (
        <li key={a.id} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-slate-500">
            <span>
              <span className="font-semibold text-slate-800">{a.activityType}</span>
              {a.contactName ? ` with ${a.contactName}` : ''} · {a.userName}
            </span>
            <span>{formatRelative(a.completedAt ?? a.plannedDate)}</span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[14px] text-slate-700">{a.notes.replace(/\n+/g, ' · ')}</p>
        </li>
      ))}
    </ul>
  );
};

const Temperature: React.FC<{ t: Dealership['relationshipTemperature'] }> = ({ t }) => {
  const Trend = t.trend === 'rising' ? TrendingUp : t.trend === 'cooling' ? TrendingDown : Minus;
  return (
    <Panel className="space-y-3 p-4">
      <SectionTitle>How warm they are</SectionTitle>
      <div className="flex items-center gap-3">
        <span className="text-[30px] font-extrabold text-slate-900">{t.score}°</span>
        <span className="text-[14px] text-slate-600">
          <Trend className="mr-1 inline h-4 w-4" />
          {t.trend}
          {t.ghostingRisk !== 'low' && <span className="ml-2 font-semibold text-rose-700">· {t.ghostingRisk} risk of going quiet</span>}
        </span>
      </div>
      {t.intentPhrases.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold text-emerald-800">Good signs</div>
          <ul className="mt-0.5 space-y-0.5 text-[14px] text-slate-700">
            {t.intentPhrases.map((p, i) => (
              <li key={i}>“{p}”</li>
            ))}
          </ul>
        </div>
      )}
      {t.hesitationPhrases.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold text-amber-800">Concerns</div>
          <ul className="mt-0.5 space-y-0.5 text-[14px] text-slate-700">
            {t.hesitationPhrases.map((p, i) => (
              <li key={i}>“{p}”</li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
};

const ACT_FILTERS: { id: string; label: string; types: Activity['activityType'][] }[] = [
  { id: 'all', label: 'All', types: [] },
  { id: 'visit', label: 'Visits', types: ['In-Person Visit'] },
  { id: 'call', label: 'Calls & Meets', types: ['Phone Call', 'Google Meet'] },
  { id: 'msg', label: 'Emails & texts', types: ['Email', 'Text Message', 'Chat'] },
  { id: 'note', label: 'Notes & top-ups', types: ['System Note', 'Keyfetch Top-up'] }
];

const ActivityTab: React.FC<{ dealership: Dealership; acts: Activity[] }> = ({ dealership, acts }) => {
  const [f, setF] = useState('all');
  const types = ACT_FILTERS.find(x => x.id === f)!.types;
  const shown = types.length ? acts.filter(a => types.includes(a.activityType)) : acts;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ACT_FILTERS.map(x => {
          const n = x.types.length ? acts.filter(a => x.types.includes(a.activityType)).length : acts.length;
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={f === x.id}
              onClick={() => setF(x.id)}
              className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold ${f === x.id ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
            >
              {x.label}
              <span className={`rounded-full px-1.5 text-[12px] ${f === x.id ? 'bg-white/25' : 'bg-slate-100'}`}>{n}</span>
            </button>
          );
        })}
      </div>
      <ActivityTimeline key={f} dealership={dealership} activities={shown} />
    </div>
  );
};

const InterestList: React.FC<{ d: Dealership; catalog: ProductCatalogItem[]; currentUser: User; onUpdate: (d: Dealership) => void }> = ({ d, catalog, currentUser, onUpdate }) => {
  const set = (productId: string, level: DealershipProductInterest['interestLevel'] | null) => {
    const rest = (d.productInterests ?? []).filter(p => p.productId !== productId);
    const prod = catalog.find(p => p.id === productId);
    onUpdate({
      ...d,
      productInterests: level
        ? [...rest, { productId, productName: prod?.name ?? 'Product', interestLevel: level, recordedDate: new Date().toISOString(), recordedByUserId: currentUser.id, recordedByUserName: currentUser.firstName }]
        : rest
    });
  };
  return (
    <Panel className="space-y-3 p-4">
      <div>
        <SectionTitle>How interested are they?</SectionTitle>
        <p className="text-[14px] text-slate-500">This fills in the sign-up when they agree. Visits logged in My Plan update it too.</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {catalog
          .filter(p => p.isActive)
          .map(p => {
            const cur = d.productInterests?.find(x => x.productId === p.id)?.interestLevel;
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <span className="text-[15px] font-semibold text-slate-900">{p.name}</span>
                  {p.isNewLaunch && (
                    <Badge tone="red" className="ml-2">
                      New
                    </Badge>
                  )}
                  {p.category && <div className="text-[13px] text-slate-500">{p.category}</div>}
                </div>
                <div role="radiogroup" aria-label={`${p.name} interest`} className="inline-flex rounded-xl bg-slate-100 p-1">
                  {[null, ...LEVELS].map(l => (
                    <button
                      key={l ?? 'none'}
                      type="button"
                      role="radio"
                      aria-checked={(cur ?? null) === l}
                      onClick={() => set(p.id, l)}
                      className={`min-h-[30px] cursor-pointer rounded-lg px-2.5 text-[13px] font-semibold ${(cur ?? null) === l ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
                    >
                      {l ?? 'None'}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
      </ul>
    </Panel>
  );
};

const ClientProducts: React.FC<{ d: Dealership; catalog: ProductCatalogItem[]; onTopup: () => void }> = ({ d, catalog, onTopup }) => {
  const name = (id: string) => catalog.find(p => p.id === id)?.name ?? id;
  const topups = [...(d.topups ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const notYet = catalog.filter(p => p.isActive && !(d.signedProducts ?? []).includes(p.id));
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Panel className="space-y-3 p-4">
        <SectionTitle>Signed products</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {(d.signedProducts ?? []).map(p => (
            <Badge key={p} tone="green">
              {name(p)}
            </Badge>
          ))}
        </div>
        {(d.upsells ?? []).length > 0 && (
          <>
            <div className="pt-2 text-[14px] font-semibold text-slate-800">Being pitched</div>
            <ul className="space-y-1.5">
              {d.upsells.map(u => (
                <li key={u.id} className="text-[14px] text-slate-700">
                  <span className="font-semibold">{u.productName}</span> · {u.stage.toLowerCase()} — {u.nextStep}
                </li>
              ))}
            </ul>
          </>
        )}
        {notYet.length > 0 && <p className="pt-1 text-[13px] text-slate-500">Not yet: {notYet.map(p => p.name).join(', ')}</p>}
      </Panel>
      {(d.signedProducts ?? []).includes(KEYFETCH) && (
        <Panel className="space-y-3 p-4">
          <SectionTitle
            right={
              <Btn size="sm" variant="primary" onClick={onTopup}>
                Log top-up
              </Btn>
            }
          >
            Keyfetch top-ups
          </SectionTitle>
          {topups.length === 0 ? (
            <p className="text-[14px] text-slate-500">No top-ups yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-[14px]">
              {topups.map(t => (
                <li key={t.id} className="flex justify-between py-2">
                  <span className="font-semibold text-slate-900">{t.quantity} units</span>
                  <span className="text-slate-600">
                    {formatDay(t.date)} · {t.handledByName}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- dialogs

const field = 'mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-normal';
const labelCls = 'block text-[14px] font-semibold text-slate-800';

const AssistDialog: React.FC<DealershipDetailModalProps & { onDone: () => void }> = ({ dealership, currentUser, allUsers, onRequestAssist, onDone }) => {
  const mgr = allUsers.find(u => u.id === currentUser.managerId) ?? allUsers.find(u => u.role === 'manager');
  const [managerId, setManagerId] = useState(mgr?.id ?? '');
  const [type, setType] = useState<AssistType>('in_person_visit');
  const [date, setDate] = useState(nextWorkday);
  const [time, setTime] = useState('11:00');
  const [brief, setBrief] = useState(() => AIService.generateManagerAssistBrief(dealership, currentUser.firstName || 'Rep'));
  const [h] = time.split(':').map(Number);
  const outside = (type === 'in_person_visit' || type === 'join_call' || type === 'google_meet') && (h < 10 || h >= 16);
  return (
    <Dialog title={`Ask a manager to help with ${dealership.dealershipName}`} onClose={onDone} wide>
      <p className="text-[14px] text-slate-600">You keep the deal and the credit. The manager gets the brief below and joins you.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Who
          <select value={managerId} onChange={e => setManagerId(e.target.value)} className={field}>
            {allUsers
              .filter(u => u.role === 'manager' || u.role === 'owner')
              .map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName}
                  {u.role === 'owner' ? ' (owner)' : ''}
                </option>
              ))}
          </select>
        </label>
        <label className={labelCls}>
          What help
          <select value={type} onChange={e => setType(e.target.value as AssistType)} className={field}>
            {(Object.keys(ASSIST_TYPE_LABEL) as AssistType[]).map(t => (
              <option key={t} value={t}>
                {ASSIST_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Day
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          Time
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className={field} />
        </label>
      </div>
      {outside && <p className="text-[13px] text-amber-800">Visits and calls work best between 10 AM and 4 PM.</p>}
      <label className={labelCls}>
        Brief for the manager (no prices)
        <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={5} className={`${field} py-2`} />
      </label>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          disabled={!managerId}
          onClick={() => {
            onRequestAssist(dealership, managerId, type, date, time, brief);
            onDone();
          }}
        >
          Send request
        </Btn>
      </div>
    </Dialog>
  );
};

const StageDialog: React.FC<{ d: Dealership; onMove: NonNullable<DealershipDetailModalProps['onMoveStage']>; onDone: () => void }> = ({ d, onMove, onDone }) => {
  const [stage, setStage] = useState<PipelineStage>(d.stage);
  const [reason, setReason] = useState('');
  const [nurture, setNurture] = useState(() => {
    const x = new Date();
    x.setMonth(x.getMonth() + 3);
    return x.toISOString().slice(0, 10);
  });
  const needsReason = stage === 'Lost' || stage === 'Disqualified';
  const ok = stage !== d.stage && (!needsReason || reason.trim()) && (stage !== 'Not Now' || nurture);
  return (
    <Dialog title="Change stage" onClose={onDone}>
      <p className="text-[14px] text-slate-600">
        Now: <strong>{stageLabel(d.stage)}</strong>. Logging a visit usually moves the stage for you; use this when it didn’t.
      </p>
      <label className={labelCls}>
        Move to
        <select value={stage} onChange={e => setStage(e.target.value as PipelineStage)} className={field}>
          {MOVABLE.map(s => (
            <option key={s} value={s}>
              {STAGE_META[s].label}
            </option>
          ))}
        </select>
      </label>
      {stage === 'Not Now' && (
        <label className={labelCls}>
          Follow up on
          <input type="date" value={nurture} onChange={e => setNurture(e.target.value)} className={field} />
        </label>
      )}
      <label className={labelCls}>
        {needsReason ? 'Why? (required)' : 'Note (optional)'}
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={stage === 'Lost' ? 'e.g. Went with another provider' : ''} className={field} />
      </label>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          disabled={!ok}
          onClick={() => {
            const patch: Partial<Dealership> = stage === 'Lost' ? { lostReason: reason.trim() } : stage === 'Disqualified' ? { disqualifiedReason: reason.trim() } : stage === 'Not Now' ? { nurtureFollowUpDate: nurture } : {};
            onMove(d, stage, reason.trim() || undefined, patch);
            onDone();
          }}
        >
          Move to {STAGE_META[stage].label}
        </Btn>
      </div>
    </Dialog>
  );
};

const EditDialog: React.FC<{ d: Dealership; currentUser: User; onSave: (d: Dealership) => void; onDone: () => void }> = ({ d, currentUser, onSave, onDone }) => {
  const [f, setF] = useState({
    phone: d.phone ?? '',
    website: d.website ?? '',
    address: d.address,
    city: d.city,
    state: d.state,
    zipCode: d.zipCode,
    usedCarsOnLot: d.usedCarsOnLot,
    monthlyUsedSales: d.monthlyUsedSales ?? 0,
    fiSystem: d.fiSystem
  });
  const up = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: typeof x[k] === 'number' ? Number(e.target.value) || 0 : e.target.value }));
  return (
    <Dialog title={`Edit ${d.dealershipName}`} onClose={onDone} wide>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelCls}>
          Phone
          <input value={f.phone} onChange={up('phone')} className={field} />
        </label>
        <label className={labelCls}>
          Website
          <input value={f.website} onChange={up('website')} className={field} />
        </label>
        <label className={`${labelCls} sm:col-span-2`}>
          Street address
          <input value={f.address} onChange={up('address')} className={field} />
        </label>
        <label className={labelCls}>
          City
          <input value={f.city} onChange={up('city')} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            State
            <input value={f.state} maxLength={2} onChange={up('state')} className={field} />
          </label>
          <label className={labelCls}>
            ZIP
            <input value={f.zipCode} onChange={up('zipCode')} className={field} />
          </label>
        </div>
        <label className={labelCls}>
          Used cars on the lot
          <input type="number" min={0} value={f.usedCarsOnLot} onChange={up('usedCarsOnLot')} className={field} />
        </label>
        <label className={labelCls}>
          Used sales a month
          <input type="number" min={0} value={f.monthlyUsedSales} onChange={up('monthlyUsedSales')} className={field} />
        </label>
        <label className={labelCls}>
          F&I system
          <input value={f.fiSystem} onChange={up('fiSystem')} className={field} />
        </label>
      </div>
      {f.usedCarsOnLot !== d.usedCarsOnLot && <p className="text-[13px] text-slate-600">The new lot count is added to the lot history with today’s date.</p>}
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          onClick={() => {
            const today = new Date().toISOString().slice(0, 10);
            const lotChanged = f.usedCarsOnLot !== d.usedCarsOnLot || f.monthlyUsedSales !== (d.monthlyUsedSales ?? 0);
            onSave({
              ...d,
              ...f,
              monthlyUsedSales: f.monthlyUsedSales || undefined,
              inventoryHistory: lotChanged ? [...(d.inventoryHistory ?? []), { date: today, count: f.usedCarsOnLot, monthlySales: f.monthlyUsedSales || undefined, recordedBy: currentUser.id } as Dealership['inventoryHistory'][number]] : d.inventoryHistory,
              updatedAt: new Date().toISOString()
            });
            onDone();
          }}
        >
          Save
        </Btn>
      </div>
    </Dialog>
  );
};

const TopupDialog: React.FC<{ d: Dealership; onSave: (qty: number, note?: string) => void; onDone: () => void }> = ({ d, onSave, onDone }) => {
  const last = [...(d.topups ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [qty, setQty] = useState(last?.quantity ?? 250);
  const [note, setNote] = useState('');
  return (
    <Dialog title={`Log a Keyfetch top-up — ${d.dealershipName}`} onClose={onDone}>
      <div className={labelCls}>
        How many units?
        <div className="mt-2 flex flex-wrap gap-2">
          {[100, 150, 200, 250, 300].map(q => (
            <button key={q} type="button" onClick={() => setQty(q)} className={`min-h-[40px] cursor-pointer rounded-xl border-2 px-3 text-[14px] font-semibold ${qty === q ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
              {q}
            </button>
          ))}
          <input type="number" min={1} aria-label="Other quantity" value={qty} onChange={e => setQty(parseInt(e.target.value, 10) || 0)} className="min-h-[40px] w-24 rounded-xl border border-slate-300 px-3 text-[14px]" />
        </div>
      </div>
      <label className={labelCls}>
        Note (optional)
        <input value={note} onChange={e => setNote(e.target.value)} className={field} />
      </label>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onDone}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          disabled={qty <= 0}
          onClick={() => {
            onSave(qty, note || undefined);
            onDone();
          }}
        >
          Save top-up
        </Btn>
      </div>
    </Dialog>
  );
};
