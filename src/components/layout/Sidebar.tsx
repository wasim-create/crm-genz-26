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
  MapPin
} from 'lucide-react';

export type ActiveView = 
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

interface SidebarProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
  currentUser: User;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  hotDealCount: number;
  pendingAssistCount: number;
  pendingFinanceCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  hotDealCount,
  pendingAssistCount,
  pendingFinanceCount
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
  const assistLabel = isManagerOrOwner ? 'Assist Requests' : 'My Assists';
  const assistBadge = isManagerOrOwner && pendingAssistCount > 0 ? pendingAssistCount : undefined;

  const getNavSections = (): { title: string; items: NavItem[] }[] => {
    const plannerItem: NavItem = {
      id: 'planner',
      label: 'My Plan',
      icon: <CalendarDays className="w-4 h-4" />,
      description: 'Today, this week, contacts & travel'
    };

    const pipelineItem: NavItem = {
      id: 'pipeline',
      label: 'Pipeline',
      icon: <KanbanSquare className="w-4 h-4" />,
      badge: hotDealCount > 0 ? `${hotDealCount} HOT` : undefined,
      badgeColor: 'bg-rose-100 text-rose-700 font-bold',
      description: 'Stage flow with Assist badges'
    };

    const benchItem: NavItem = {
      id: 'bench',
      label: 'My Prospects (Bench)',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Claimed dealership targets'
    };

    const poolItem: NavItem = {
      id: 'pool',
      label: 'Prospect Pool & Map',
      icon: <Compass className="w-4 h-4" />,
      description: '60-mile radius search'
    };

    const clientsItem: NavItem = {
      id: 'clients',
      label: 'Client Portfolio',
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
      label: role === 'new_rep' ? 'Rookie League & Points' : 'Game Day Scorecard',
      icon: <Trophy className="w-4 h-4" />,
      description: 'Leaderboards, streaks & badges'
    };

    const gameRulesItem: NavItem = {
      id: 'game_rules',
      label: 'Game Rules Console',
      icon: <Gamepad2 className="w-4 h-4" />,
      description: 'Points table, product bonuses & quests'
    };

    const groupsItem: NavItem = {
      id: 'groups',
      label: 'Dealer Groups',
      icon: <Layers className="w-4 h-4" />,
      description: 'Multi-store group networks'
    };

    const financeItem: NavItem = {
      id: 'finance',
      label: 'Introduction Incentives',
      icon: <FileCheck2 className="w-4 h-4" />,
      badge: pendingFinanceCount > 0 ? pendingFinanceCount : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800 font-bold',
      description: 'Donna Clark introduction trail & verification'
    };

    const executiveDeskItem: NavItem = {
      id: 'executive_desk',
      label: 'Executive Desk',
      icon: <TrendingUp className="w-4 h-4" />,
      description: 'Storytelling rollups (Counts & Rates)'
    };

    const settingsItem: NavItem = {
      id: 'settings',
      label: 'Settings & Catalog',
      icon: <Settings className="w-4 h-4" />,
      description: '10 catalog products & open admin'
    };

    if (role === 'new_rep' || role === 'veteran_rep') {
      return [
        {
          title: 'Daily Field Work',
          items: [plannerItem, benchItem, pipelineItem, poolItem]
        },
        {
          title: 'Accounts & Assists',
          items: [clientsItem, assistsItem, gamificationItem]
        },
        {
          title: 'System & Rules',
          items: [groupsItem, gameRulesItem, settingsItem]
        }
      ];
    }

    if (role === 'manager' || role === 'team_lead') {
      return [
        {
          title: 'Management & Assists',
          items: [assistsItem, pipelineItem, plannerItem]
        },
        {
          title: 'Territory Coverage',
          items: [benchItem, clientsItem, poolItem, groupsItem]
        },
        {
          title: 'Performance & Rules',
          items: [executiveDeskItem, gamificationItem, gameRulesItem, settingsItem]
        }
      ];
    }

    if (role === 'finance') {
      return [
        {
          title: 'Finance Controller Queue',
          items: [financeItem, assistsItem, executiveDeskItem]
        },
        {
          title: 'Company Records',
          items: [clientsItem, pipelineItem, benchItem, settingsItem]
        }
      ];
    }

    if (role === 'admin') {
      return [
        {
          title: 'System Admin',
          items: [settingsItem, gameRulesItem]
        },
        {
          title: 'Company Records',
          items: [benchItem, poolItem, clientsItem, groupsItem]
        }
      ];
    }

    // Executive & Owner
    return [
      {
        title: 'Executive Oversight',
        items: [executiveDeskItem, pipelineItem, assistsItem, financeItem]
      },
      {
        title: 'Field Operations',
        items: [plannerItem, benchItem, clientsItem, groupsItem, poolItem]
      },
      {
        title: 'Game & System Admin',
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
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {role === 'new_rep' ? 'Rookie Station' : 'Navigation'}
          </span>
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
      <nav className="flex-1 overflow-y-auto p-2 space-y-4 text-xs font-medium">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
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
                      ? 'bg-blue-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title={item.label}
                >
                  <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {item.icon}
                  </span>
                  {!isCollapsed && (
                    <div className="flex-1 flex items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badgeColor || 'bg-slate-200 text-slate-700'}`}>
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
        <div className="p-3 m-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            <span>Home Base: {currentUser.homeZipCode}</span>
          </div>
          <p className="text-[10px] text-slate-500">
            Territory radius: <strong>60 miles</strong> standard
          </p>
        </div>
      )}
    </aside>
  );
};
