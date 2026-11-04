import React, { useState, useEffect } from 'react';
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
import { Sidebar, ActiveView } from './components/layout/Sidebar';
import { PlannerView } from './components/views/PlannerView';
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
import { WorkDayMobileModal } from './components/views/WorkDayMobileModal';
import { WorkspaceSyncView } from './components/views/WorkspaceSyncView';
import { CommandPalette } from './components/command/CommandPalette';
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals state
  const [selectedDealership, setSelectedDealership] = useState<Dealership | null>(null);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isMobileWorkDayOpen, setIsMobileWorkDayOpen] = useState(false);
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

      // Default to Kelley Koliopulos (Northeast Rep)
      const defaultUser = data.users.find((u: User) => u.id === 'u_kelley') || data.users[0];
      setCurrentUser(defaultUser);
    };

    loadData();
  }, []);

  // Section 4: Data-layer privacy re-filtering when persona changes
  const handleSelectUser = async (u: User) => {
    setCurrentUser(u);
    const fresh = await storage.loadAll(u);
    setIncentives(fresh.incentives);

    // Contextual view routing
    if (u.role === 'finance') setCurrentView('finance');
    else if (u.role === 'manager') setCurrentView('assists');
    else if (u.role === 'executive' || u.role === 'owner') setCurrentView('executive_desk');
    
    showToast(`Switched persona to ${u.firstName} ${u.lastName} (${u.role})`);
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
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white font-mono text-sm">
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

  const handleAddActivity = (act: Activity) => {
    const newActs = [act, ...activities];
    setActivities(newActs);
    storage.saveActivity(act);

    // Live points award (Section 5)
    awardPoints('visit_good_window', act.dealershipId, act.dealershipName, `Field visit at ${act.dealershipName}`);

    // Audit log
    const audit: AuditLogRecord = {
      id: `aud_${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: `${currentUser.firstName} ${currentUser.lastName}`,
      dealershipId: act.dealershipId,
      dealershipName: act.dealershipName,
      action: `${act.activityType} Logged`,
      details: act.notes
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
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

  const handleMoveStage = (deal: Dealership, newStage: PipelineStage) => {
    const updated: Dealership = {
      ...deal,
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
      details: `Moved from ${deal.stage} to ${newStage}`
    };
    setAuditLogs([audit, ...auditLogs]);
    storage.saveAuditLog(audit);
    showToast(`${deal.dealershipName} moved to ${newStage}`);
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
      originRepName: `${currentUser.firstName} ${currentUser.lastName}`,
      assignedManagerId: manager.id,
      assignedManagerName: `${manager.firstName} ${manager.lastName}`,
      assistType,
      proposedDate,
      proposedTime,
      requestDate: new Date().toISOString(),
      decisionMakerName: 'General Manager',
      decisionMakerTitle: 'GM / Partner',
      objections: 'Terms confirmation and claims turnaround SLA.',
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
      originRepName: `${currentUser.firstName} ${currentUser.lastName}`,
      closedByUserId: currentUser.id,
      closedByUserName: `${currentUser.firstName} ${currentUser.lastName}`,
      signedByUserId: currentUser.id,
      signedByUserName: `${currentUser.firstName} ${currentUser.lastName}`,
      assistInvolved: true,
      assistManagerId: managerUser.id,
      assistManagerName: `${managerUser.firstName} ${managerUser.lastName}`,
      triggerEvent: 'Contract Signed with Assist',
      state: 'Verified',
      amount: 450.00,
      reviewDate: new Date().toISOString().split('T')[0],
      reviewedBy: 'Donna Clark',
      trail: [
        { step: 'Claimed from Pool', date: '2026-10-15', actor: `${currentUser.firstName} ${currentUser.lastName}`, details: 'Claimed within territory radius' },
        { step: 'Scouting Lot Visit', date: '2026-10-20', actor: `${currentUser.firstName} ${currentUser.lastName}`, details: 'Discovery inside Golden Window', isGoodWindow: true },
        { step: 'Manager Assist Requested', date: '2026-10-28', actor: `${currentUser.firstName} ${currentUser.lastName}`, details: `Coordinated with ${managerUser.firstName} ${managerUser.lastName}` },
        { step: 'Contract Executed & Signed', date: new Date().toISOString().split('T')[0], actor: `${currentUser.firstName} & ${managerUser.firstName}`, details: 'Signed and placed in origin rep portfolio' }
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
      const fresh = await storage.loadAll(currentUser);
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
        <div className="fixed bottom-5 right-5 z-100 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200 border border-slate-700">
          {toastMessage.points ? (
            <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
              +{toastMessage.points}
            </span>
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Navbar with Persistent Game Strip */}
      <Navbar
        currentUser={currentUser}
        allUsers={users}
        onSelectUser={handleSelectUser}
        onOpenCommand={() => setIsCommandOpen(true)}
        onOpenMobileWorkDay={() => setIsMobileWorkDayOpen(true)}
        onOpenWorkspaceSync={() => setIsWorkspaceSyncOpen(true)}
        syncState={{ isSyncing, lastSyncTime: 'Today, 11:30 AM' }}
        gamificationProfile={gamification[currentUser.id]}
        onOpenGamification={() => setCurrentView('gamification')}
      />

      {/* Main App Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Role-based Sidebar with v2 Labels */}
        <Sidebar
          currentView={currentView}
          onNavigate={(v) => setCurrentView(v)}
          currentUser={currentUser}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          hotDealCount={hotDealCount}
          pendingAssistCount={pendingAssistCount}
          pendingFinanceCount={pendingFinanceCount}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          {currentView === 'planner' && (
            <PlannerView
              dealerships={dealerships}
              activities={activities}
              priorities={managerPriorities}
              bonuses={productBonuses}
              currentUser={currentUser}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onLogVisit={(d) => setSelectedDealership(d)}
              onUpdateActivities={(acts) => {
                setActivities(acts);
                acts.forEach(a => storage.saveActivity(a));
              }}
              onUpdatePriority={(p) => {
                const list = managerPriorities.map(m => m.id === p.id ? p : m);
                setManagerPriorities(list);
                storage.savePriority(p);
                if (p.status === 'completed') {
                  awardPoints('complete_priority', p.linkedDealershipId, p.linkedDealershipName, `Completed directive: ${p.title}`);
                }
              }}
              onLaunchWorkDay={() => setIsMobileWorkDayOpen(true)}
            />
          )}

          {currentView === 'pipeline' && (
            <PipelineView
              dealerships={dealerships}
              currentUser={currentUser}
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
              onAddNewProspect={(newDeal) => {}}
              isPoolOnly={false}
            />
          )}

          {currentView === 'pool' && (
            <ProspectPoolView
              dealerships={dealerships}
              currentUser={currentUser}
              onClaimDealership={handleClaimDealership}
              onOpenDealership={(d) => setSelectedDealership(d)}
              onAddNewProspect={(newDeal) => {}}
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
              onNavigateToGameRules={() => setCurrentView('game_rules')}
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
          onAddActivity={handleAddActivity}
          onRequestAssist={handleRequestAssist}
          onAddContact={(c) => {
            const list = [c, ...contacts];
            setContacts(list);
            storage.saveContact(c);
            showToast(`Added contact ${c.firstName} ${c.lastName}`);
          }}
          onLogKeyfetchTopup={handleLogKeyfetchTopup}
        />
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        dealerships={dealerships}
        onSelectDealership={(d) => setSelectedDealership(d)}
      />

      {/* Mobile Work My Day Modal */}
      {isMobileWorkDayOpen && (
        <WorkDayMobileModal
          stops={dealerships.filter(d => d.assignedRepId === currentUser.id && d.stage !== 'Client').slice(0, 4)}
          currentUser={currentUser}
          gamificationProfile={gamification[currentUser.id]}
          onClose={() => setIsMobileWorkDayOpen(false)}
          onLogCompletedStop={(d, notes, isHot) => {
            const now = new Date();
            const time24 = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            handleAddActivity({
              id: `act_${Date.now()}`,
              dealershipId: d.id,
              dealershipName: d.dealershipName,
              userId: currentUser.id,
              userName: `${currentUser.firstName} ${currentUser.lastName}`,
              activityType: 'In-Person Visit',
              communicationType: 'In-Person',
              status: 'completed',
              completedAt: now.toISOString(),
              plannedTime: time24,
              notes: notes,
              productsDiscussed: ['Keyfetch', 'Vehicle Service Contract (Extended Warranty)']
            });

            if (isHot) {
              handleMoveStage(d, 'HOT');
            } else {
              handleMoveStage(d, 'Visited');
            }
          }}
        />
      )}

      {/* Google Workspace Sync Modal */}
      {isWorkspaceSyncOpen && (
        <WorkspaceSyncView
          items={workspaceItems}
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
    </div>
  );
}
