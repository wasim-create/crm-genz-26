import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Dealership, 
  User, 
  Activity, 
  ManagerAssist, 
  IntroductionIncentive, 
  Contact, 
  DealerGroup,
  ProductCatalogItem,
  GamificationProfile,
  WorkspaceItem,
  AuditLogRecord,
  PipelineStage,
  GameRule,
  ProductBonus,
  ManagerPriority,
  PointsLedgerEntry,
  AssistType,
  UpsellOpportunity
} from './types/crm';
import { LocalStorageAdapter } from './services/storageAdapter';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, ActiveView, pagesFor } from './components/layout/Sidebar';
import { MyPlanModule } from './features/myplan/MyPlanModule';
import { DealershipPlanPanel } from './features/myplan/DealershipPlanPanel';
import { resetMyPlan, setCrmBridge } from './features/myplan/data/store';
import type { WritebackResult } from './features/myplan/services/writeback';
import { ProspectForm, ProspectFormResult } from './components/forms/ProspectForm';
import { ContactForm } from './components/forms/ContactForm';
import { PipelineView } from './components/views/PipelineView';
import { ProspectPoolView } from './components/views/ProspectPoolView';
import { ClientPortfolioView } from './components/views/ClientPortfolioView';
import { ExecutiveDeskView } from './components/views/ExecutiveDeskView';
import { FinanceLedgerView } from './components/views/FinanceLedgerView';
import { ManagerAssistView } from './components/views/ManagerAssistView';
import { PerformanceGamificationView } from './components/views/PerformanceGamificationView';
import { GameRulesConsoleView } from './components/views/GameRulesConsoleView';
import { DealerGroupsView } from './components/views/DealerGroupsView';
import { SettingsAdminView } from './components/views/SettingsAdminView';
import { DealershipDetailModal } from './components/views/DealershipDetailModal';
import { WorkspaceSyncView } from './components/views/WorkspaceSyncView';
import { CommandPalette } from './components/command/CommandPalette';
import { ensureSeeded, useMyPlanState } from './features/myplan/data/store';
import { HOW_SHORT, TASK_BY_ID } from './features/myplan/engine/tasks';
import { todayISO } from './features/myplan/engine/time';
import { computeNextSteps, PlannedRef } from './utils/nextStepStatus';
import { initScreens, pushScreen, replaceScreen } from './utils/backStack';
import { stageTracking } from './utils/stageTracking';
import { repReport, RepReport } from './features/team/signals';
import { resetTeam, useTeamState } from './features/team/store';
import { TeamView } from './features/team/TeamView';
import { WorthALook } from './features/team/WorthALook';
import { CheckCircle2, X, Sparkles, Flame } from 'lucide-react';

const storage = new LocalStorageAdapter();

export default function App() {
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<DealerGroup[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [assists, setAssists] = useState<ManagerAssist[]>([]);
  const [incentives, setIncentives] = useState<IntroductionIncentive[]>([]);
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
  const [fiSystems, setFiSystems] = useState<string[]>([]);
  const [gamification, setGamification] = useState<Record<string, GamificationProfile>>({});
  const [workspaceItems, setWorkspaceItems] = useState<WorkspaceItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [gameRules, setGameRules] = useState<GameRule[]>([]);
  const [productBonuses, setProductBonuses] = useState<ProductBonus[]>([]);
  const [managerPriorities, setManagerPriorities] = useState<ManagerPriority[]>([]);
  const [pointsLedger, setPointsLedger] = useState<PointsLedgerEntry[]>([]);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ActiveView>('planner');
  // Screen changes go into the browser history, so the phone / browser Back button
  // returns to the previous screen (after closing anything open on top).
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollByView = useRef<Partial<Record<ActiveView, number>>>({});
  const viewRef = useRef<ActiveView>('planner');
  viewRef.current = currentView;
  const showView = (v: ActiveView) => {
    if (mainRef.current) scrollByView.current[viewRef.current] = mainRef.current.scrollTop;
    setCurrentView(v);
  };
  const goTo = (v: ActiveView) => {
    if (v === viewRef.current) return;
    showView(v);
    pushScreen(v);
  };
  useEffect(() => initScreens(viewRef.current, v => showView(v as ActiveView)), []);
  useEffect(() => {
    // Back to a list: put it where it was. A new screen starts at the top.
    const y = scrollByView.current[currentView] ?? 0;
    requestAnimationFrame(() => mainRef.current?.scrollTo({ top: y }));
  }, [currentView]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  // Modals state
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  // Shared "Add New Prospect / Client" and "Add Contact" forms (used everywhere)
  const [prospectForm, setProspectForm] = useState<{ mode: 'prospect' | 'client'; radar?: boolean } | null>(null);
  const [contactFormFor, setContactFormFor] = useState<Dealership | null>(null);
  const [planRequest, setPlanRequest] = useState<{ dealershipId: string; planLater?: boolean; nextStep?: boolean; logVisit?: boolean; nonce: number } | null>(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isWorkspaceSyncOpen, setIsWorkspaceSyncOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; points?: number } | null>(null);

  const showToast = (text: string, points?: number) => {
    setToastMessage({ text, points });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      const data = await storage.loadAll();
      setDealerships(data.dealerships);
      setUsers(data.users);
      setGroups(data.groups);
      setContacts(data.contacts);
      setActivities(data.activities);
      setAssists(data.assists);
      setIncentives(data.incentives);
      setCatalog(data.products);
      setFiSystems(data.fiSystems);
      setGamification(data.gamification);
      setWorkspaceItems(data.workspaceItems);
      setAuditLogs(data.auditLogs);
      setGameRules(data.gameRules);
      setProductBonuses(data.productBonuses);
      setManagerPriorities(data.managerPriorities);
      setPointsLedger(data.pointsLedger);
      // Seed My Plan straight away, so next-step status is right on every screen.
      ensureSeeded({ users: data.users, dealerships: data.dealerships, contacts: data.contacts, groups: data.groups, catalog: data.products, today: todayISO(), activities: data.activities, assists: data.assists, priorities: data.managerPriorities, workspace: data.workspaceItems });

      // Default to Carlos Martinez (New Rep, Texas) or Kelley
      const defaultUser = data.users.find((u: User) => u.id === 'u_carlos') || data.users[0];
      setCurrentUser(defaultUser);
    };

    loadData();
  }, []);

  // What happens next with each dealership (My Plan + assists + CRM history).
  const planState = useMyPlanState();
  const plannedRefs: PlannedRef[] = useMemo(
    () =>
      planState.slots
        .filter(s => (s.status === 'planned' || s.status === 'basket') && s.target.kind !== 'block')
        .map(s => ({
          targetId: s.target.id,
          rooftopIds: s.target.rooftopIds,
          date: s.date,
          time: s.timeMode === 'exact' ? s.fixedTime : undefined,
          status: s.status,
          label: `${HOW_SHORT[s.how]}${s.tasks[0] ? `: ${TASK_BY_ID[s.tasks[0].taskId]?.label ?? ''}` : ''}`
        })),
    [planState.slots]
  );
  const nextSteps = useMemo(() => computeNextSteps(dealerships, activities, plannedRefs, assists, todayISO()), [dealerships, activities, plannedRefs, assists]);
  // Who needs help: one report per rep (same rules for the manager's screen and the rep's own card).
  const teamState = useTeamState();
  const plannedContacts = useMemo(
    () => planState.slots.filter(s => s.status === 'planned' && s.date && s.target.kind === 'dealership').map(s => ({ userId: s.userId, date: s.date!, how: s.how })),
    [planState.slots]
  );
  const teamReports: RepReport[] = useMemo(() => {
    const today = todayISO();
    return users
      .filter(u => (u.role === 'new_rep' || u.role === 'veteran_rep') && u.active !== false)
      .map(rep => {
        const mgr = users.find(u => u.id === rep.managerId);
        return repReport({
          rep,
          managerName: mgr?.firstName,
          dealerships,
          activities,
          nextSteps,
          planned: plannedContacts,
          assists,
          streak: gamification[rep.id]?.streakDays,
          rules: teamState.rules,
          handled: teamState.handled[rep.id],
          today
        });
      });
  }, [users, dealerships, activities, nextSteps, plannedContacts, assists, gamification, teamState]);
  const myTeamReports = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'manager' || currentUser.role === 'team_lead') return teamReports.filter(r => r.rep.managerId === currentUser.id);
    if (currentUser.role === 'owner' || currentUser.role === 'executive') return teamReports;
    return [];
  }, [teamReports, currentUser]);

  const planNextStep = (d: Dealership) => {
    // Opens on top of the current screen (and the record, if open).
    setPlanRequest({ dealershipId: d.id, nextStep: true, nonce: Date.now() });
  };

  // Saving from the shared prospect form: the dealership, any new / updated
  // dealer group, and placeholder rooftops for a new group.
  const saveProspectResult = (r: ProspectFormResult, who: User) => {
    const added = [r.dealership, ...r.placeholders];
    setDealerships(prev => [...added, ...prev]);
    added.forEach(d => storage.saveDealership(d));
    const g = r.newGroup ?? r.updatedGroup;
    if (g) {
      setGroups(prev => (prev.some(x => x.id === g.id) ? prev.map(x => (x.id === g.id ? g : x)) : [g, ...prev]));
      storage.saveGroup(g);
    }
    const ref = r.dealership.referral;
    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: who.id,
      userName: `${who.firstName} ${who.lastName}`,
      dealershipId: r.dealership.id,
      dealershipName: r.dealership.dealershipName,
      action: r.dealership.stage === 'Client' ? 'Client added directly' : 'Prospect added',
      details: [
        `Source: ${r.dealership.source}`,
        ref?.internalName ? `Internal referral: ${ref.internalName}` : '',
        ref?.externalName ? `External referral: ${ref.externalName}${ref.externalCompany ? ` (${ref.externalCompany})` : ''}${ref.relationship ? ` · ${ref.relationship}` : ''}` : '',
        r.newGroup ? `New dealer group: ${r.newGroup.name} (${r.placeholders.length} placeholder rooftop${r.placeholders.length === 1 ? '' : 's'})` : ''
      ]
        .filter(Boolean)
        .join(' · ')
    };
    setAuditLogs(prev => [audit, ...prev]);
    storage.saveAuditLog(audit);
  };

  const saveContact = (c: Contact) => {
    setContacts(prev => (prev.some(x => x.id === c.id) ? prev.map(x => (x.id === c.id ? c : x)) : [c, ...prev]));
    storage.saveContact(c);
  };

  // My Plan → CRM write-back ("records fill themselves"). Uses functional
  // updates so several write-backs in a row never overwrite each other.
  useEffect(() => {
    const applyWriteback = (r: WritebackResult) => {
      if (r.dealershipUpdates.length) {
        const byId = new Map(r.dealershipUpdates.map(d => [d.id, d]));
        setDealerships(prev => prev.map(d => byId.get(d.id) ?? d));
        setSelectedDealership(sel => (sel ? byId.get(sel.id) ?? sel : sel));
        r.dealershipUpdates.forEach(d => storage.saveDealership(d));
      }
      if (r.activities.length) {
        setActivities(prev => [...r.activities, ...prev]);
        r.activities.forEach(a => storage.saveActivity(a));
      }
      if (r.newContacts.length) {
        setContacts(prev => [...r.newContacts, ...prev]);
        r.newContacts.forEach(c => storage.saveContact(c));
      }
      if (r.audit.length) {
        setAuditLogs(prev => [...r.audit, ...prev]);
        r.audit.forEach(a => storage.saveAuditLog(a));
      }
      if (r.points.length) {
        setPointsLedger(prev => [...r.points, ...prev]);
        r.points.forEach(p => storage.addPointsLedgerEntry(p));
        setGamification(prev => {
          const next = { ...prev };
          r.points.forEach(p => {
            const prof = next[p.userId];
            if (prof) next[p.userId] = { ...prof, points: prof.points + p.pointsAwarded, pointsToday: prof.pointsToday + p.pointsAwarded };
          });
          return next;
        });
      }
    };
    setCrmBridge({ applyWriteback });
    return () => setCrmBridge(null);
  }, []);

  // Section 4: Data-layer privacy re-filtering when persona changes
  const handleSelectUser = async (u: User) => {
    setCurrentUser(u);
    const fresh = await storage.loadAll(u);
    setIncentives(fresh.incentives);

    // Contextual view routing
    const home: ActiveView | null =
      u.role === 'finance' ? 'finance' : u.role === 'manager' ? 'team' : u.role === 'executive' || u.role === 'owner' ? 'executive_desk' : u.role === 'admin' ? 'settings' : null;
    // Keep the screen if the new persona can open it; otherwise go to their usual first screen.
    const target = home ?? (pagesFor(u.role).some(pg => pg.id === viewRef.current) ? null : pagesFor(u.role)[0]?.id ?? null);
    if (target) {
      showView(target);
      replaceScreen(target);
    }

    showToast(`Now viewing as ${u.firstName} ${u.lastName}`);
  };

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-ink text-onaccent font-mono text-sm">
        Loading ApexDrive CRM...
      </div>
    );
  }

  // Live points awarding engine (Section 5)
  const awardPoints = (actionType: string, dealershipId?: string, dealershipName?: string, detail?: string) => {
    const rule = gameRules.find(r => r.actionType === actionType);
    let pts = rule ? rule.basePoints : 20;

    // Check if active product bonus applies
    const activeBonus = productBonuses.find(b => b.isActive && b.actionTypes.includes(actionType as any));
    if (activeBonus) {
      if (activeBonus.multiplier) pts *= activeBonus.multiplier;
      else pts += activeBonus.bonusPoints;
    }

    const newEntry: PointsLedgerEntry = {
      id: `ple_${Date.now()}`,
      userId: currentUser.id,
      dealershipId,
      dealershipName,
      actionType,
      description: detail || rule?.label || actionType,
      pointsAwarded: pts,
      ruleVersion: 'v2.0',
      timestamp: new Date().toISOString()
    };

    const newLedger = [newEntry, ...pointsLedger];
    setPointsLedger(newLedger);
    storage.addPointsLedgerEntry(newEntry);

    // Update profile
    const existingProf = gamification[currentUser.id];
    if (existingProf) {
      const updatedProf: GamificationProfile = {
        ...existingProf,
        points: existingProf.points + pts,
        pointsToday: existingProf.pointsToday + pts
      };
      setGamification({ ...gamification, [currentUser.id]: updatedProf });
    }

    showToast(`+${pts} pts • ${detail || rule?.label || 'Action completed'}`, pts);
  };

  // Dealership updates
  const handleUpdateDealership = (updated: Dealership) => {
    const newDeals = dealerships.map(d => d.id === updated.id ? updated : d);
    setDealerships(newDeals);
    storage.saveDealership(updated);
    if (selectedDealership?.id === updated.id) {
      setSelectedDealership(updated);
    }
  };


  const handleClaimDealership = (deal: Dealership, reason?: string) => {
    const updated: Dealership = {
      ...deal,
      stage: 'Claimed',
      source: 'Pool',
      assignedRepId: currentUser.id,
      originRepId: currentUser.id,
      claimedAt: new Date().toISOString(),
      lastTouchpointDate: new Date().toISOString()
    };
    handleUpdateDealership(updated);
    awardPoints('claim_prospect', deal.id, deal.dealershipName, `Claimed ${deal.dealershipName}`);

    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      action: 'Prospect Claimed',
      details: reason ? `Claimed to bench with reason: ${reason}` : 'Claimed to bench from territory pool'
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
  };

  const handleMoveStage = (deal: Dealership, newStage: PipelineStage, note?: string, patch: Partial<Dealership> = {}) => {
    const updated: Dealership = {
      ...deal,
      ...(newStage !== deal.stage ? stageTracking(deal, newStage, new Date().toISOString().slice(0, 10)) : {}),
      ...patch,
      stage: newStage,
      lastTouchpointDate: new Date().toISOString()
    };
    handleUpdateDealership(updated);

    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      action: `Stage Changed to ${newStage}`,
      details: `Moved from ${deal.stage} to ${newStage}${note ? `. ${note}` : ''}`
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
    showToast(`${deal.dealershipName} moved to ${newStage}`);
  };

  // My team: a manager offers to join a rep's visit (booked straight away as an assist).
  const handleOfferVisit = (rep: User, deal: Dealership, date: string, time: string, note: string) => {
    if (!currentUser) return;
    const dm = contacts.find(c => c.dealershipId === deal.id && c.isDecisionMaker);
    const assist: ManagerAssist = {
      id: `ast_${Date.now()}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      originRepId: rep.id,
      originRepName: `${rep.firstName} ${rep.lastName}`,
      assignedManagerId: currentUser.id,
      assignedManagerName: `${currentUser.firstName} ${currentUser.lastName}`,
      assistType: 'in_person_visit',
      proposedDate: date,
      proposedTime: time,
      requestDate: new Date().toISOString(),
      decisionMakerName: dm ? `${dm.firstName} ${dm.lastName}` : 'Decision maker not on file',
      decisionMakerTitle: dm?.jobTitle ?? '—',
      objections: deal.relationshipTemperature?.hesitationPhrases?.join('; ') || 'None recorded yet.',
      productsOfInterest: (deal.productInterests || []).map(p => p.productName),
      aiBriefing: `Offered by ${currentUser.firstName} from My team.`,
      managerNotes: note,
      status: 'Accepted'
    };
    setAssists(list => [assist, ...list]);
    storage.saveAssist(assist);
    const updated = { ...deal, hasActiveAssist: true, activeAssistId: assist.id };
    setDealerships(list => list.map(d => (d.id === deal.id ? updated : d)));
    storage.saveDealership(updated);
  };

  // My team: a short message that sits at the top of the rep's My Plan until they tick it off.
  const handleNudge = (rep: User, message: string, reason: string, dealershipId?: string) => {
    if (!currentUser) return;
    const deal = dealerships.find(d => d.id === dealershipId);
    const nudge: ManagerPriority = {
      id: `nudge_${Date.now()}`,
      managerId: currentUser.id,
      managerName: `${currentUser.firstName} ${currentUser.lastName}`,
      targetType: 'rep',
      targetId: rep.id,
      title: message,
      reason,
      priorityLevel: 'High',
      dueDate: todayISO(),
      linkedDealershipId: deal?.id,
      linkedDealershipName: deal?.dealershipName,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    setManagerPriorities(list => [nudge, ...list]);
    storage.savePriority(nudge);
  };

  // Section 3: Manager Assist Flow (Rep keeps ownership!)
  const handleRequestAssist = (
    deal: Dealership,
    managerId: string,
    assistType: AssistType,
    proposedDate: string,
    proposedTime: string,
    brief: string
  ) => {
    const manager = users.find(u => u.id === managerId) || users.find(u => u.role === 'manager') || users[0];

    const newAssist: ManagerAssist = {
      id: `ast_${Date.now()}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      originRepId: deal.originRepId || currentUser.id,
      originRepName: (() => { const o = users.find(u => u.id === (deal.originRepId || currentUser.id)); return o ? `${o.firstName} ${o.lastName}` : `${currentUser.firstName} ${currentUser.lastName}`; })(),
      assignedManagerId: manager.id,
      assignedManagerName: `${manager.firstName} ${manager.lastName}`,
      assistType,
      proposedDate,
      proposedTime,
      requestDate: new Date().toISOString(),
      decisionMakerName: (() => { const dm = contacts.find(c => c.dealershipId === deal.id && c.isDecisionMaker); return dm ? `${dm.firstName} ${dm.lastName}` : 'Decision maker not on file'; })(),
      decisionMakerTitle: contacts.find(c => c.dealershipId === deal.id && c.isDecisionMaker)?.jobTitle ?? '—',
      objections: deal.relationshipTemperature?.hesitationPhrases?.join('; ') || 'None recorded yet.',
      productsOfInterest: (deal.productInterests || []).map(p => p.productName),
      aiBriefing: brief,
      status: 'Pending'
    };

    setAssists([newAssist, ...assists]);
    storage.saveAssist(newAssist);

    // Deal remains in current stage with assist flag (NOT moving to a fake stage!)
    const updatedDeal: Dealership = {
      ...deal,
      hasActiveAssist: true,
      activeAssistId: newAssist.id
    };
    handleUpdateDealership(updatedDeal);

    awardPoints('request_assist', deal.id, deal.dealershipName, `Requested assist for ${deal.dealershipName}`);

    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      action: 'Manager Assist Requested',
      details: `Requested assist from ${manager.firstName} ${manager.lastName} for ${assistType}.`
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
  };

  const handleSignDealWithAssist = (deal: Dealership, managerUser: User) => {
    const updated: Dealership = {
      ...deal,
      stage: 'Signed',
      hasActiveAssist: false,
      signedBy: `${currentUser.firstName} ${currentUser.lastName}`,
      closedWithAssistFrom: `${managerUser.firstName} ${managerUser.lastName}`,
      lastTouchpointDate: new Date().toISOString()
    };
    handleUpdateDealership(updated);

    awardPoints('deal_won', deal.id, deal.dealershipName, `Deal won with manager assist!`);

    // Create Introduction Incentive for Donna Clark (Section 4)
    const newIncentive: IntroductionIncentive = {
      id: `inc_${Date.now()}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      originRepId: deal.originRepId || currentUser.id,
      originRepName: (() => { const o = users.find(u => u.id === (deal.originRepId || currentUser.id)); return o ? `${o.firstName} ${o.lastName}` : `${currentUser.firstName} ${currentUser.lastName}`; })(),
      closedByUserId: currentUser.id,
      closedByUserName: `${currentUser.firstName} ${currentUser.lastName}`,
      signedByUserId: currentUser.id,
      signedByUserName: `${currentUser.firstName} ${currentUser.lastName}`,
      assistInvolved: true,
      assistManagerId: managerUser.id,
      assistManagerName: `${managerUser.firstName} ${managerUser.lastName}`,
      triggerEvent: 'Agreement signed',
      state: 'Eligible',
      amount: 350.0,
      calculatedRule: 'Introduction with manager assist',
      trail: [
        ...activities
          .filter(a => a.dealershipId === deal.id && a.status === 'completed' && (a.tags?.some(t => ['claim', 'lot', 'assist_req', 'assist_meet'].includes(t)) || a.activityType === 'Google Meet'))
          .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
          .map(a => ({
            step: a.tags?.includes('claim') ? 'Claimed' : a.tags?.includes('lot') ? 'Scouting visit' : a.tags?.includes('assist_req') ? 'Manager Assist requested' : a.tags?.includes('assist_meet') ? 'Manager Assist completed' : 'Product demo',
            date: (a.completedAt ?? '').slice(0, 10),
            actor: a.userName,
            details: a.notes.length > 140 ? `${a.notes.slice(0, 137)}…` : a.notes,
            isGoodWindow: a.isGoodWindow
          })),
        { step: 'Agreement signed', date: new Date().toISOString().split('T')[0], actor: `${currentUser.firstName} & ${managerUser.firstName}`, details: 'Signed and kept in the origin rep’s portfolio' }
      ]
    };
    setIncentives([newIncentive, ...incentives]);
    storage.saveIncentive(newIncentive);

    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: managerUser.id,
      userName: `${managerUser.firstName} ${managerUser.lastName}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      action: 'Deal Won & Contract Signed',
      details: `Co-closed with origin rep ${currentUser.firstName} ${currentUser.lastName}. Origin attribution locked.`
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
    showToast(`Deal Won! ${deal.dealershipName} signed with assist from ${managerUser.firstName}!`);
  };

  const handleTransferOwnership = (dealershipId: string, toRepId: string, reason: string) => {
    storage.transferOwnership(dealershipId, toRepId, currentUser.id, `${currentUser.firstName} ${currentUser.lastName}`, reason);
    const toRep = users.find(u => u.id === toRepId);
    showToast(`Deal ownership transferred to ${toRep?.firstName || toRepId}.`);
  };

  // Section 2: Keyfetch Top-up (Quantity only, NO pricing)
  const handleLogKeyfetchTopup = (dealershipId: string, quantity: number, notes?: string) => {
    const deal = dealerships.find(d => d.id === dealershipId);
    if (!deal) return;

    const newTopup = {
      id: `top_${Date.now()}`,
      dealershipId,
      productId: 'prod_3',
      date: new Date().toISOString().split('T')[0],
      quantity,
      handledByUserId: currentUser.id,
      handledByName: `${currentUser.firstName} ${currentUser.lastName}`,
      notes
    };

    const updatedDeal: Dealership = {
      ...deal,
      topups: [newTopup, ...(deal.topups || [])],
      lastTouchpointDate: new Date().toISOString(),
      clientHealthScore: 98
    };
    handleUpdateDealership(updatedDeal);
    awardPoints('keyfetch_topup', deal.id, deal.dealershipName, `Topped up ${quantity} Keyfetch units`);

    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      dealershipId: deal.id,
      dealershipName: deal.dealershipName,
      action: 'Keyfetch Top-Up Logged',
      details: `Delivered ${quantity} units. Notes: ${notes || 'Regular replenishment'}`
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
  };

  // Section 2: Upsells
  const handleCreateUpsell = (dealershipId: string, productId: string, nextStep: string) => {
    const deal = dealerships.find(d => d.id === dealershipId);
    if (!deal) return;
    const prod = catalog.find(p => p.id === productId);

    const newUpsell: UpsellOpportunity = {
      id: `ups_${Date.now()}`,
      dealershipId,
      productId,
      productName: prod?.name || 'Catalog Product',
      stage: 'Pitched',
      ownerId: currentUser.id,
      ownerName: `${currentUser.firstName} ${currentUser.lastName}`,
      nextStep,
      createdAt: new Date().toISOString()
    };

    const updatedDeal: Dealership = {
      ...deal,
      upsells: [newUpsell, ...(deal.upsells || [])]
    };
    handleUpdateDealership(updatedDeal);
    showToast(`Pitched ${newUpsell.productName} to ${deal.dealershipName}!`);
  };

  const handleResetDemoData = async () => {
    if (confirm('Reset all CRM data back to the clean Improvement Pass v2 seed state?')) {
      await storage.resetToSeed();
      resetMyPlan();
      resetTeam();
      const fresh = await storage.loadAll(currentUser);
      setContacts(fresh.contacts);
      setDealerships(fresh.dealerships);
      setActivities(fresh.activities);
      setAssists(fresh.assists);
      setIncentives(fresh.incentives);
      setAuditLogs(fresh.auditLogs);
      setGameRules(fresh.gameRules);
      setProductBonuses(fresh.productBonuses);
      setManagerPriorities(fresh.managerPriorities);
      setPointsLedger(fresh.pointsLedger);
      showToast('Demo data reset to fresh v2 state.');
    }
  };

  const hotDealCount = dealerships.filter(d => d.heatLevel === 'Hot' && d.stage !== 'Client').length;
  const pendingAssistCount = assists.filter(a => a.status === 'Pending').length;
  const pendingFinanceCount = incentives.filter(i => i.state === 'Pending verification' || i.state === 'Verified').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-800">
      {/* Toast Notification Container with Live Points Burst */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-100 bg-ink text-onaccent px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 border border-ink-2">
          {toastMessage.points ? (
            <span className="w-6 h-6 rounded-lg bg-amber-500 text-darkink font-mono font-black text-xs flex items-center justify-center shrink-0">
              +{toastMessage.points}
            </span>
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-onaccent">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navbar with Persistent Game Strip */}
      <Navbar
        currentUser={currentUser}
        allUsers={users.filter(u => u.active !== false)}
        onSelectUser={handleSelectUser}
        onOpenCommand={() => setIsCommandOpen(true)}
        onOpenMobileWorkDay={() => goTo('planner')}
        onOpenWorkspaceSync={() => setIsWorkspaceSyncOpen(true)}
        syncState={{ isSyncing, lastSyncTime: 'Today, 11:30 AM' }}
        gamificationProfile={gamification[currentUser.id]}
        onOpenGamification={() => goTo('gamification')}
      />

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Role-based Sidebar with v2 Labels */}
        <Sidebar
          currentView={currentView}
          onNavigate={(v) => goTo(v)}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          hotDealCount={hotDealCount}
          pendingAssistCount={pendingAssistCount}
          pendingFinanceCount={pendingFinanceCount}
          teamHelpCount={myTeamReports.filter(r => r.status === 'help').length}
        />

        {/* Viewport Content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          {currentView === 'team' && (
            <TeamView
              reports={myTeamReports}
              currentUser={currentUser}
              users={users}
              dealerships={dealerships}
              activities={activities}
              planned={plannedContacts}
              onOpenDealership={d => setSelectedDealership(d)}
              onOpenAssists={() => goTo('assists')}
              onOfferVisit={handleOfferVisit}
              onNudge={handleNudge}
            />
          )}

          {currentView === 'planner' && (currentUser.role === 'new_rep' || currentUser.role === 'veteran_rep') && (() => {
            const mine = teamReports.find(r => r.rep.id === currentUser.id);
            const nudges = managerPriorities.filter(p => p.id.startsWith('nudge_') && p.targetType === 'rep' && p.targetId === currentUser.id && p.status === 'pending');
            return mine ? (
              <WorthALook
                report={mine}
                nudges={nudges}
                dealerships={dealerships}
                onOpenDealership={d => setSelectedDealership(d)}
                onPlanNext={planNextStep}
                onAckNudge={p => {
                  const done = { ...p, status: 'completed' as const, completedAt: new Date().toISOString() };
                  setManagerPriorities(list => list.map(x => (x.id === p.id ? done : x)));
                  storage.savePriority(done);
                }}
              />
            ) : null;
          })()}

          {/* Always mounted: on other screens it only shows its forms, on top of that screen. */}
          {(
            <MyPlanModule
              pageVisible={currentView === 'planner'}
              onOpenPlan={() => {
                setSelectedDealership(null);
                goTo('planner');
              }}
              currentUser={currentUser}
              users={users}
              dealerships={dealerships}
              contacts={contacts}
              groups={groups}
              catalog={catalog}
              gameRules={gameRules}
              productBonuses={productBonuses}
              priorities={managerPriorities}
              activities={activities}
              assists={assists}
              workspaceItems={workspaceItems}
              request={planRequest}
              onRequestHandled={() => setPlanRequest(null)}
              onAddContact={saveContact}
              onSaveProspect={(r) => {
                saveProspectResult(r, currentUser);
                showToast(`Added ${r.dealership.dealershipName}`);
              }}
              onClaimDealership={(d) => handleClaimDealership(d, 'Planned from My Plan')}
              onOpenDealership={(d) => setSelectedDealership(d)}
            />
          )}

          {currentView === 'pipeline' && (
            <PipelineView
              dealerships={dealerships}
              currentUser={currentUser}
              allUsers={users}
              nextSteps={nextSteps}
              onPlanNextStep={planNextStep}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onMoveStage={handleMoveStage}
              onInitiateAssist={(d) => setSelectedDealership(d)}
            />
          )}

          {currentView === 'bench' && (
            <ProspectPoolView
              dealerships={dealerships}
              currentUser={currentUser}
              onClaimDealership={handleClaimDealership}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onAddNewProspect={(opts) => setProspectForm({ mode: 'prospect', radar: opts?.radar })}
              isPoolOnly={false}
              nextSteps={nextSteps}
              onPlanNextStep={planNextStep}
            />
          )}

          {currentView === 'pool' && (
            <ProspectPoolView
              dealerships={dealerships}
              currentUser={currentUser}
              onClaimDealership={handleClaimDealership}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onAddNewProspect={(opts) => setProspectForm({ mode: 'prospect', radar: opts?.radar })}
              isPoolOnly={true}
            />
          )}

          {currentView === 'clients' && (
            <ClientPortfolioView
              dealerships={dealerships}
              catalog={catalog}
              currentUser={currentUser}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onLogKeyfetchTopup={handleLogKeyfetchTopup}
              onUpdateUpsell={(did, up) => {}}
              onCreateUpsell={handleCreateUpsell}
              onAddClient={() => setProspectForm({ mode: 'client' })}
              allUsers={users}
            />
          )}

          {currentView === 'executive_desk' && (
            <ExecutiveDeskView
              dealerships={dealerships}
              activities={activities}
              assists={assists}
              incentives={incentives}
              users={users}
              onOpenDealership={(d) => setSelectedDealership(d)}
              nextSteps={nextSteps}
            />
          )}

          {currentView === 'finance' && (
            <FinanceLedgerView
              incentives={incentives}
              dealerships={dealerships}
              users={users}
              currentUser={currentUser}
              onUpdateIncentive={(upd) => {
                const list = incentives.map(i => i.id === upd.id ? upd : i);
                setIncentives(list);
                storage.saveIncentive(upd);
                showToast(`Introduction for ${upd.dealershipName} updated to ${upd.state}`);
              }}
              onOpenDealership={(d) => setSelectedDealership(d)}
            />
          )}

          {currentView === 'assists' && (
            <ManagerAssistView
              assists={assists}
              dealerships={dealerships}
              users={users}
              currentUser={currentUser}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onUpdateAssist={(upd) => {
                const list = assists.map(a => a.id === upd.id ? upd : a);
                setAssists(list);
                storage.saveAssist(upd);
                showToast(`Assist request for ${upd.dealershipName} updated to ${upd.status}`);
              }}
              onSignDealWithAssist={handleSignDealWithAssist}
              onTransferOwnership={handleTransferOwnership}
            />
          )}

          {currentView === 'gamification' && (
            <PerformanceGamificationView
              currentUser={currentUser}
              allUsers={users}
              gamification={gamification}
              pointsLedger={pointsLedger}
            />
          )}

          {currentView === 'game_rules' && (
            <GameRulesConsoleView
              gameRules={gameRules}
              productBonuses={productBonuses}
              catalog={catalog}
              currentUser={currentUser}
              users={users}
              gamification={gamification}
              pointsLedger={pointsLedger}
              onUpdateRule={(r) => {
                const list = gameRules.map(x => x.id === r.id ? r : x);
                setGameRules(list);
                storage.saveGameRule(r);
                showToast(`Updated rule: ${r.label}`);
              }}
              onAddProductBonus={(b) => {
                setProductBonuses([b, ...productBonuses]);
                storage.saveProductBonus(b);
                showToast(`Created bonus for ${b.productName}!`);
              }}
              onToggleBonus={(bid) => {
                const list = productBonuses.map(b => b.id === bid ? { ...b, isActive: !b.isActive } : b);
                setProductBonuses(list);
                const b = list.find(x => x.id === bid);
                if (b) storage.saveProductBonus(b);
              }}
            />
          )}

          {currentView === 'groups' && (
            <DealerGroupsView
              groups={groups}
              dealerships={dealerships}
              users={users}
              currentUser={currentUser}
              onOpenDealership={(d) => setSelectedDealership(d)}
            />
          )}

          {currentView === 'settings' && (
            <SettingsAdminView
              currentUser={currentUser}
              allUsers={users}
              catalog={catalog}
              fiSystems={fiSystems}
              storageMode={storage.getMode()}
              onResetDemoData={handleResetDemoData}
              onUpdateCatalog={(cat) => {
                setCatalog(cat);
                cat.forEach(p => storage.saveProduct(p));
                showToast('Catalog updated.');
              }}
              onUpdateFISystems={setFiSystems}
              onNavigateToGameRules={() => goTo('game_rules')}
              onUpdateUsers={(list, message) => {
                setUsers(list);
                storage.saveUsers(list);
                showToast(message);
              }}
              knownLocations={dealerships}
            />
          )}
        </main>
      </div>

      {/* 360-Degree Dealership Profile Modal */}
      {selectedDealership && (
        <DealershipDetailModal
          dealership={selectedDealership}
          allDealerships={dealerships}
          contacts={contacts}
          activities={activities}
          auditLogs={auditLogs}
          catalog={catalog}
          currentUser={currentUser}
          allUsers={users}
          onClose={() => setSelectedDealership(null)}
          onUpdateDealership={handleUpdateDealership}
          onLogVisit={currentUser.role === 'finance' || currentUser.role === 'admin' ? undefined : (d) => {
            setPlanRequest({ dealershipId: d.id, logVisit: true, nonce: Date.now() });
          }}
          onRequestAssist={handleRequestAssist}
          onAddContact={(c) => {
            const list = [c, ...contacts];
            setContacts(list);
            storage.saveContact(c);
            showToast(`Added contact ${c.firstName} ${c.lastName}`);
          }}
          onLogKeyfetchTopup={handleLogKeyfetchTopup}
          onAddToPlan={(d) => {
            setPlanRequest({ dealershipId: d.id, nonce: Date.now() });
          }}
          onPlanLater={(d) => {
            setPlanRequest({ dealershipId: d.id, planLater: true, nonce: Date.now() });
          }}
          planPanel={<DealershipPlanPanel dealership={selectedDealership} user={currentUser} />}
          onRequestAddContact={(d) => setContactFormFor(d)}
          nextStep={nextSteps.get(selectedDealership.id)}
          onPlanNextStep={planNextStep}
          onMoveStage={currentUser.role === 'finance' ? undefined : handleMoveStage}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        dealerships={dealerships}
        onSelectDealership={(d) => setSelectedDealership(d)}
        contacts={contacts}
        pages={pagesFor(currentUser.role)}
        onNavigate={id => goTo(id as ActiveView)}
      />

      {/* Google Workspace Sync Modal */}
      {isWorkspaceSyncOpen && (
        <WorkspaceSyncView
          items={workspaceItems}
          allUsers={users}
          dealerships={dealerships}
          currentUser={currentUser}
          onClose={() => setIsWorkspaceSyncOpen(false)}
          onSyncNow={() => {
            setIsSyncing(true);
            setTimeout(() => {
              setIsSyncing(false);
              showToast('Google Workspace synced: 5 messages & 2 calendar events linked.');
            }, 1000);
          }}
          isSyncing={isSyncing}
        />
      )}
      {prospectForm && (
        <ProspectForm
          mode={prospectForm.mode}
          startWithRadar={prospectForm.radar}
          currentUser={currentUser}
          users={users}
          dealerships={dealerships}
          groups={groups}
          catalog={catalog}
          onCancel={() => setProspectForm(null)}
          onOpenExisting={(d) => {
            setProspectForm(null);
            setSelectedDealership(d);
          }}
          onSave={(r) => {
            saveProspectResult(r, currentUser);
            setProspectForm(null);
            setSelectedDealership(r.dealership);
            showToast(
              `${r.dealership.stage === 'Client' ? 'Client' : 'Prospect'} added: ${r.dealership.dealershipName}${r.placeholders.length ? ` + ${r.placeholders.length} placeholder rooftop${r.placeholders.length === 1 ? '' : 's'}` : ''}. Add the first contact from the Contacts tab.`
            );
          }}
        />
      )}

      {contactFormFor && (
        <ContactForm
          dealershipId={contactFormFor.id}
          dealershipName={contactFormFor.dealershipName}
          existingContacts={contacts}
          currentUser={currentUser}
          onCancel={() => setContactFormFor(null)}
          onSave={(c) => {
            saveContact(c);
            setContactFormFor(null);
            showToast(`Contact added: ${c.firstName} ${c.lastName}`);
          }}
        />
      )}
    </div>
  );
}
