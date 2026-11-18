import React, { useEffect, useState } from 'react';
import { BackLayer } from '../ui/kit';
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
  Users,
  Boxes,
  MoreHorizontal,
  X
} from 'lucide-react';

export type ActiveView = 
  | 'team'
  | 'inventory'
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
    inventory: 'Keyfetch stock',
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
          ? ['finance', 'inventory', 'assists', 'executive_desk', 'clients', 'pipeline', 'bench', 'settings']
          : role === 'inventory_manager'
            ? ['inventory', 'clients', 'groups', 'pipeline', 'settings']
          : role === 'admin'
            ? ['settings', 'game_rules', 'bench', 'pool', 'clients', 'groups']
            : ['executive_desk', 'team', 'inventory', 'pipeline', 'assists', 'finance', 'planner', 'bench', 'clients', 'groups', 'pool', 'gamification', 'game_rules', 'settings'];
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
  /** Dealerships that need keychains ordered now (inventory, owners, finance). */
  stockOrderCount?: number;
  /** Reps who need help (managers, owners). */
  teamHelpCount?: number;
}

export interface NavItem {
  id: ActiveView;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
  description?: string;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}
export interface NavCounts {
  hotDealCount: number;
  pendingAssistCount: number;
  pendingFinanceCount: number;
  stockOrderCount?: number;
  teamHelpCount?: number;
}

/** The menu for a role, in sections. Used by the side menu (tablets, computers) and the bottom bar's More (phones). */
export function navSectionsFor(currentUser: User, { hotDealCount, pendingAssistCount, pendingFinanceCount, teamHelpCount = 0, stockOrderCount = 0 }: NavCounts): NavSection[] {
  const role = currentUser.role;

  // Section 3: Navigation renaming
  const isManagerOrOwner = ['manager', 'owner', 'executive'].includes(role);
  const assistLabel = isManagerOrOwner ? 'Assist requests' : 'My assist requests';
  const assistBadge = isManagerOrOwner && pendingAssistCount > 0 ? pendingAssistCount : undefined;

  const getNavSections = (): NavSection[] => {
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

    const inventoryItem: NavItem = {
      id: 'inventory',
      label: 'Keyfetch stock',
      icon: <Boxes className="w-4 h-4" />,
      badge: stockOrderCount > 0 ? `${stockOrderCount} to order` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 font-bold',
      description: 'Keychains left, orders on the way, when to order'
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
          items: [financeItem, inventoryItem, assistsItem, executiveDeskItem]
        },
        {
          title: 'Records',
          items: [clientsItem, pipelineItem, benchItem, settingsItem]
        }
      ];
    }

    if (role === 'inventory_manager') {
      return [
        { title: 'Stock', items: [inventoryItem] },
        { title: 'Records', items: [clientsItem, groupsItem, pipelineItem, settingsItem] }
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
        items: [executiveDeskItem, teamItem, inventoryItem, pipelineItem, assistsItem, financeItem]
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

  return getNavSections();
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
  teamHelpCount = 0,
  stockOrderCount = 0
}) => {
  const short = useShortScreen();
  const collapsed = isCollapsed || short;
  const sections = navSectionsFor(currentUser, { hotDealCount, pendingAssistCount, pendingFinanceCount, teamHelpCount, stockOrderCount });

  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-300 z-20 md:flex ${collapsed ? 'w-16' : 'w-64'}`}
      aria-label="Main menu"
    >
      {/* Collapse toggle (not on short screens such as a phone turned sideways: there it stays narrow) */}
      {!short && (
        <div className="flex items-center justify-between border-b border-slate-100 p-2">
          {!collapsed && <span className="px-1 text-[13px] font-semibold text-slate-500">Menu</span>}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label={collapsed ? 'Show menu names' : 'Hide menu names'}
            title={collapsed ? 'Show menu names' : 'Hide menu names'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-4 overflow-y-auto p-2 text-[14px] font-medium">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {!collapsed && <div className="px-3 pb-1 pt-2 text-[12px] font-semibold text-slate-500">{section.title}</div>}
            {section.items.map(item => {
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={collapsed ? `${item.label}${item.badge !== undefined ? `, ${item.badge}` : ''}` : undefined}
                  className={`relative flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left transition-all ${
                    isActive ? 'bg-brand font-semibold text-onaccent shadow-xs' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  } ${collapsed ? 'justify-center' : ''}`}
                  title={item.label}
                >
                  <span className={`shrink-0 ${isActive ? 'text-onaccent' : 'text-slate-500'}`}>{item.icon}</span>
                  {collapsed && item.badge !== undefined && <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" aria-hidden />}
                  {!collapsed && (
                    <div className="flex flex-1 items-center justify-between truncate">
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[12px] ${item.badgeColor || 'bg-slate-200 text-slate-700'}`}>{item.badge}</span>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="m-2 space-y-0.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-600">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <MapPin className="h-3.5 w-3.5 text-blue-600" />
            <span>Home ZIP {currentUser.homeZipCode}</span>
          </div>
          <p className="text-[12px] text-slate-600">Territory: 60 miles</p>
        </div>
      )}
    </aside>
  );
};

/** True on short screens (a phone turned sideways). */
function useShortScreen(): boolean {
  const q = '(max-height: 500px)';
  const [short, setShort] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => {
    const m = window.matchMedia?.(q);
    if (!m) return;
    const on = () => setShort(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return !!short;
}

// ---------------------------------------------------------------- phones

/** The four most-used screens per role; everything else is under More. */
const PRIMARY: Record<string, ActiveView[]> = {
  new_rep: ['planner', 'bench', 'pipeline', 'clients'],
  veteran_rep: ['planner', 'bench', 'pipeline', 'clients'],
  manager: ['team', 'planner', 'pipeline', 'assists'],
  team_lead: ['team', 'planner', 'pipeline', 'assists'],
  finance: ['finance', 'inventory', 'assists', 'clients'],
  inventory_manager: ['inventory', 'clients', 'groups', 'pipeline'],
  admin: ['settings', 'game_rules', 'bench', 'clients']
};
const SHORT_LABEL: Partial<Record<ActiveView, string>> = {
  bench: 'Prospects',
  pool: 'Pool',
  assists: 'Assists',
  executive_desk: 'Desk',
  finance: 'Incentives',
  inventory: 'Stock',
  gamification: 'Points',
  game_rules: 'Rules',
  groups: 'Groups',
  team: 'Team'
};

/** Phones: labelled tabs along the bottom, with the rest of the menu under More. */
export const BottomNav: React.FC<Omit<SidebarProps, 'isCollapsed' | 'onToggleCollapse'>> = props => {
  const { currentView, onNavigate, currentUser } = props;
  const [more, setMore] = useState(false);
  const sections = navSectionsFor(currentUser, props);
  const all = sections.flatMap(sec => sec.items);
  const ids = PRIMARY[currentUser.role] ?? ['executive_desk', 'team', 'pipeline', 'planner'];
  const primary = ids.map(id => all.find(it => it.id === id)).filter(Boolean) as NavItem[];
  const onMore = !primary.some(it => it.id === currentView);
  const moreBadge = all.some(it => !ids.includes(it.id) && it.badge !== undefined);

  const tab = (key: string, label: string, icon: React.ReactNode, active: boolean, onClick: () => void, badge?: boolean, extra?: Record<string, unknown>) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`relative flex min-h-[56px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 px-1 text-[12px] font-semibold ${active ? 'text-blue-700' : 'text-slate-600'}`}
      {...extra}
    >
      <span className={`flex h-7 w-12 items-center justify-center rounded-full [&>svg]:h-5 [&>svg]:w-5 ${active ? 'bg-blue-100' : ''}`}>{icon}</span>
      <span className="max-w-full truncate">{label}</span>
      {badge && <span className="absolute right-[calc(50%-1.25rem)] top-1.5 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-white" aria-hidden />}
    </button>
  );

  return (
    <>
      <nav
        aria-label="Main menu"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {primary.map(it =>
          tab(it.id, SHORT_LABEL[it.id] ?? it.label, it.icon, currentView === it.id, () => onNavigate(it.id), it.badge !== undefined, it.badge !== undefined ? { 'aria-label': `${it.label}, ${it.badge}` } : {})
        )}
        {tab('more', 'More', <MoreHorizontal className="h-5 w-5" />, onMore, () => setMore(true), moreBadge, { 'aria-haspopup': 'dialog', 'aria-expanded': more })}
      </nav>

      {more && (
        <div className="fixed inset-0 z-[65] flex flex-col justify-end md:hidden" role="dialog" aria-modal="true" aria-label="More">
          <BackLayer onBack={() => setMore(false)} escape />
          <button type="button" aria-label="Close menu" className="flex-1 cursor-default bg-scrim/50" onClick={() => setMore(false)} />
          <div className="max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-1 flex items-center justify-between px-2">
              <h2 className="text-[18px] font-bold text-slate-900">Menu</h2>
              <button type="button" onClick={() => setMore(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sections.map(sec => (
              <div key={sec.title} className="mb-2">
                <div className="px-3 pb-1 pt-2 text-[13px] font-semibold text-slate-500">{sec.title}</div>
                {sec.items.map(it => (
                  <button
                    key={it.id}
                    type="button"
                    autoFocus={it.id === sections[0].items[0].id}
                    onClick={() => {
                      setMore(false);
                      onNavigate(it.id);
                    }}
                    aria-current={currentView === it.id ? 'page' : undefined}
                    className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-[16px] font-medium ${currentView === it.id ? 'bg-blue-50 text-blue-800' : 'text-slate-800 hover:bg-slate-100'}`}
                  >
                    <span className="text-slate-500">{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                    {it.badge !== undefined && <span className={`rounded-full px-2 py-0.5 text-[13px] ${it.badgeColor || 'bg-slate-200 text-slate-700'}`}>{it.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
            <div className="mx-1 mt-1 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2.5 text-[14px] text-slate-600">
              <MapPin className="h-4 w-4 text-blue-600" /> Home ZIP {currentUser.homeZipCode} · territory 60 miles
            </div>
          </div>
        </div>
      )}
    </>
  );
};
