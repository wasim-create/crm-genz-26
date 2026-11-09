import React from 'react';
import { ThemeMenu } from '../ui/ThemeToggle';
import { User, UserRole, GamificationProfile } from '../../types/crm';
import { 
  Compass, 
  Search, 
  Smartphone, 
  RefreshCw, 
  Command,
  Flame,
  Trophy,
  Sparkles,
  Zap
} from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  allUsers: User[];
  onSelectUser: (user: User) => void;
  onOpenCommand: () => void;
  onOpenMobileWorkDay: () => void;
  onOpenWorkspaceSync: () => void;
  syncState: { isSyncing: boolean; lastSyncTime: string };
  gamificationProfile?: GamificationProfile;
  onOpenGamification?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  allUsers,
  onSelectUser,
  onOpenCommand,
  onOpenMobileWorkDay,
  onOpenWorkspaceSync,
  syncState,
  gamificationProfile,
  onOpenGamification
}) => {
  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'new_rep': return 'New Sales Rep';
      case 'veteran_rep': return 'Veteran Sales Rep';
      case 'team_lead': return 'Team lead';
      case 'manager': return 'Manager';
      case 'finance': return 'Finance';
      case 'executive': return 'Executive';
      case 'owner': return 'Owner';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'new_rep': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'veteran_rep': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'team_lead': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'manager': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'finance': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'executive': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'owner': return 'bg-ink text-onaccent border-ink-2';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const profile = gamificationProfile;
  const roleWord = (u: User) => (u.role === 'new_rep' ? 'New rep' : u.role === 'veteran_rep' ? 'Rep' : getRoleLabel(u.role));
  const groupsList: { label: string; roles: UserRole[] }[] = [
    { label: 'Reps', roles: ['veteran_rep', 'new_rep', 'team_lead'] },
    { label: 'Managers', roles: ['manager'] },
    { label: 'Owners & finance', roles: ['owner', 'executive', 'finance'] },
    { label: 'Admin', roles: ['admin'] }
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 md:px-5">
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-onaccent">
            <Compass className="h-5 w-5" />
          </div>
          <span className="hidden text-[18px] font-extrabold tracking-tight text-slate-900 sm:inline">ApexDrive</span>
        </div>

        <button
          type="button"
          onClick={onOpenCommand}
          className="flex min-h-[40px] min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-[14px] text-slate-500 transition hover:border-slate-400 md:w-80"
          title="Search (Ctrl+K or Cmd+K)"
          aria-label="Search"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden truncate md:inline">Search dealerships, people, pages…</span>
          <kbd className="ml-auto hidden items-center gap-0.5 rounded border border-slate-300 bg-slate-50 px-1.5 text-[12px] text-slate-500 lg:inline-flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {profile && (
          <button
            type="button"
            onClick={onOpenGamification}
            className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-semibold text-slate-800 transition hover:border-slate-400"
            title={`Level ${profile.level} · ${profile.levelTitle} · ${profile.pointsToday} of ${profile.dailyTarget} points today${profile.activeMultiplier ? ` · ${profile.activeMultiplier.label}` : ''}`}
          >
            <span className="inline-flex items-center gap-0.5 text-orange-600">
              <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
              {profile.streakDays}
            </span>
            <span className="hidden sm:inline">{profile.points.toLocaleString()} pts</span>
            <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 lg:block" aria-hidden>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (profile.pointsToday / Math.max(1, profile.dailyTarget)) * 100)}%` }} />
            </span>
          </button>
        )}

        <ThemeMenu />

        <button
          type="button"
          onClick={onOpenWorkspaceSync}
          className="hidden min-h-[40px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 transition hover:border-slate-400 sm:flex"
          title={`Google Calendar & Tasks sync${syncState.lastSyncTime ? ` · last ${syncState.lastSyncTime}` : ''}`}
          aria-label="Google sync"
        >
          <RefreshCw className={`h-4 w-4 ${syncState.isSyncing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        <label className="flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 pl-1.5 pr-1">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-2 text-[12px] font-bold text-onaccent" aria-hidden>
            {currentUser.firstName[0]}
            {currentUser.lastName[0]}
          </span>
          <span className="hidden text-[12px] text-slate-500 xl:inline">Viewing as</span>
          <select
            value={currentUser.id}
            onChange={e => {
              const u = allUsers.find(x => x.id === e.target.value);
              if (u) onSelectUser(u);
            }}
            className="max-w-[140px] cursor-pointer bg-transparent py-1 text-[14px] font-semibold text-slate-900 focus:outline-hidden sm:max-w-[280px]"
            aria-label="Switch Role Persona"
          >
            {groupsList.map(g => (
              <optgroup key={g.label} label={g.label}>
                {allUsers
                  .filter(u => g.roles.includes(u.role))
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {roleWord(u)}
                      {u.region && u.role !== 'admin' ? `, ${u.region}` : ''}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
};
