import React from 'react';
import { User } from '../../types/crm';
import {
  CalendarDays,
  KanbanSquare,
  Building2,
  Users2,
  Compass,
  Trophy,
  Briefcase,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
  ShieldCheck,
  Gamepad2,
  FileCheck2,
  MapPin,
  Users
} from 'lucide-react';

export type ActiveView = 
  | 'team'
  | 'planner'
  | 'pipeline'
  | 'bench'
  | 'pool'
  | 'clients'
  | 'assists'
  | 'executive_desk'
  | 'finance'
  | 'gamification'
  | 'game_rules'
  | 'groups'
  | 'settings';

/** Pages each role can open, in menu order (also used by search). */
export function pagesFor(role: string): { id: ActiveView; label: string }[] {
  const L: Record<ActiveView, string> = {
    team: role === 'manager' || role === 'team_lead' ? 'My team' : 'Teams',
    planner: 'My plan',
    pipeline: 'Pipeline',
    bench: 'My prospects',
    pool: 'Prospect pool',
    clients: 'Clients',
    assists: ['manager', 'owner', 'executive'].includes(role) ? 'Assist requests' : 'My assist requests',
    executive_desk: 'Executive desk',
    finance: 'Introduction incentives',
    gamification: 'Points & leaderboard',
    game_rules: 'Points rules',
    groups: 'Dealer groups',
    settings: 'Settings'
  };
  const ids: ActiveView[] =
    role === 'new_rep' || role === 'veteran_rep'
      ? ['planner', 'bench', 'pipeline', 'pool', 'clients', 'assists', 'gamification', 'groups', 'game_rules', 'settings']
      : role === 'manager' || role === 'team_lead'
        ? ['team', 'assists', 'pipeline', 'planner', 'bench', 'clients', 'pool', 'groups', 'executive_desk', 'gamification', 'game_rules', 'settings']
        : role === 'finance'
          ? ['finance', 'assists', 'executive_desk', 'clients', 'pipeline', 'bench', 'settings']
          : role === 'admin'
            ? ['settings', 'game_rules', 'bench', 'pool', 'clients', 'groups']
            : ['executive_desk', 'team', 'pipeline', 'assists', 'finance', 'planner', 'bench', 'clients', 'groups', 'pool', 'gamification', 'game_rules', 'settings'];
  return ids.map(id => ({ id, label: L[id] }));
}

interface SidebarProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  currentUser: User;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hotDealCount: number;
  pendingAssistCount: number;
  pendingFinanceCount: number;
  /** Reps who need help (managers, owners). */
  teamHelpCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  hotDealCount,
  pendingAssistCount,
  pendingFinanceCount,
  teamHelpCount = 0
}) => {
  const role = currentUser.role;

  interface NavItem {
    id: ActiveView;
    label: string;
    icon: React.ReactNode;
    badge?: number | string;
    badgeColor?: string;
    description?: string;
  }

  // Section 3: Navigation renaming
  const isManagerOrOwner = ['manager', 'owner', 'executive'].includes(role);
  const assistLabel = isManagerOrOwner ? 'Assist requests' : 'My assist requests';
  const assistBadge = isManagerOrOwner && pendingAssistCount > 0 ? pendingAssistCount : undefined;

  const getNavSections = (): { title: string; items: NavItem[] }[] => {
    const plannerItem: NavItem = {
      id: 'planner',
      label: 'My plan',
      icon: <CalendarDays className="w-4 h-4" />,
      description: 'Today, this week, contacts & travel'
    };

    const pipelineItem: NavItem = {
      id: 'pipeline',
      label: 'Pipeline',
      icon: <KanbanSquare className="w-4 h-4" />,
      badge: hotDealCount > 0 ? `${hotDealCount} hot` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 font-bold',
      description: 'Stage flow with Assist badges'
    };

    const benchItem: NavItem = {
      id: 'bench',
      label: 'My prospects',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Claimed dealership targets'
    };

    const poolItem: NavItem = {
      id: 'pool',
      label: 'Prospect pool',
      icon: <Compass className="w-4 h-4" />,
      description: '60-mile radius search'
    };

    const clientsItem: NavItem = {
      id: 'clients',
      label: 'Clients',
      icon: <Users2 className="w-4 h-4" />,
      description: 'Keyfetch top-ups & catalog upsells'
    };

    const assistsItem: NavItem = {
      id: 'assists',
      label: assistLabel,
      icon: <Briefcase className="w-4 h-4" />,
      badge: assistBadge,
      badgeColor: 'bg-amber-100 text-amber-800 font-bold',
      description: isManagerOrOwner ? 'Review & join rep closing meetings' : 'Request manager assistance'
    };

    const gamificationItem: NavItem = {
      id: 'gamification',
      label: 'Points & leaderboard',
      icon: <Trophy className="w-4 h-4" />,
      description: 'Leaderboards, streaks & badges'
    };

    const gameRulesItem: NavItem = {
      id: 'game_rules',
      label: 'Points rules',
      icon: <Gamepad2 className="w-4 h-4" />,
      description: 'Points table, product bonuses & quests'
    };

    const groupsItem: NavItem = {
      id: 'groups',
      label: 'Dealer groups',
      icon: <Layers className="w-4 h-4" />,
      description: 'Multi-store group networks'
    };

    const financeItem: NavItem = {
      id: 'finance',
      label: 'Introduction incentives',
      icon: <FileCheck2 className="w-4 h-4" />,
      badge: pendingFinanceCount > 0 ? pendingFinanceCount : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800 font-bold',
      description: 'Donna Clark introduction trail & verification'
    };

    const executiveDeskItem: NavItem = {
      id: 'executive_desk',
      label: 'Executive desk',
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Storytelling rollups (Counts & Rates)'
    };

    const teamItem: NavItem = {
      id: 'team',
      label: role === 'manager' || role === 'team_lead' ? 'My team' : 'Teams',
      icon: <Users className="w-4 h-4" />,
      badge: teamHelpCount > 0 ? `${teamHelpCount} need help` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 font-bold',
      description: 'Who needs help, and why'
    };

    const settingsItem: NavItem = {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4" />,
      description: '10 catalog products & open admin'
    };

    if (role === 'new_rep' || role === 'veteran_rep') {
      return [
        {
          title: 'Daily work',
          items: [plannerItem, benchItem, pipelineItem, poolItem]
        },
        {
          title: 'Accounts',
          items: [clientsItem, assistsItem, gamificationItem]
        },
        {
          title: 'Setup',
          items: [groupsItem, gameRulesItem, settingsItem]
        }
      ];
    }

    if (role === 'manager' || role === 'team_lead') {
      return [
        {
          title: 'Team',
          items: [teamItem, assistsItem, pipelineItem, plannerItem]
        },
        {
          title: 'Accounts',
          items: [benchItem, clientsItem, poolItem, groupsItem]
        },
        {
          title: 'Results & setup',
          items: [executiveDeskItem, gamificationItem, gameRulesItem, settingsItem]
        }
      ];
    }

    if (role === 'finance') {
      return [
        {
          title: 'Finance',
          items: [financeItem, assistsItem, executiveDeskItem]
        },
        {
          title: 'Records',
          items: [clientsItem, pipelineItem, benchItem, settingsItem]
        }
      ];
    }

    if (role === 'admin') {
      return [
        {
          title: 'Admin',
          items: [settingsItem, gameRulesItem]
        },
        {
          title: 'Records',
          items: [benchItem, poolItem, clientsItem, groupsItem]
        }
      ];
    }

    // Executive & Owner
    return [
      {
        title: 'Overview',
        items: [executiveDeskItem, teamItem, pipelineItem, assistsItem, financeItem]
      },
      {
        title: 'Field work',
        items: [plannerItem, benchItem, clientsItem, groupsItem, poolItem]
      },
      {
        title: 'Points & setup',
        items: [gamificationItem, gameRulesItem, settingsItem]
      }
    ];
  };

  const sections = getNavSections();

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-20 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Collapse Toggle Button */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
        {!isCollapsed && (
          <span className="text-[13px] font-semibold text-slate-500">Menu</span>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-7 h-7 mx-auto rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4 text-[14px] font-medium">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[12px] font-semibold text-slate-500">
                {section.title}
              </div>
            )}
            {section.items.map(item => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-brand text-onaccent font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  <span className={`shrink-0 ${isActive ? 'text-onaccent' : 'text-slate-500'}`}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-200 text-slate-700'}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Rep Territory Radius Badge (Bottom) */}
      {!isCollapsed && (
        <div className="p-3 m-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[13px] space-y-0.5">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Home ZIP {currentUser.homeZipCode}</span>
          </div>
          <p className="text-[12px] text-slate-500">Territory: 60 miles</p>
        </div>
      )}
    </aside>
  );
};
