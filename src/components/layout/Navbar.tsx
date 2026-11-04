import React from 'react';
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
      case 'team_lead': return 'Team Lead';
      case 'manager': return 'Regional Manager';
      case 'finance': return 'Finance Controller';
      case 'executive': return 'Executive / C-Level';
      case 'owner': return 'Company Owner';
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
      case 'owner': return 'bg-slate-900 text-white border-slate-700';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const profile = gamificationProfile;

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 md:px-5 flex items-center justify-between sticky top-0 z-30 shadow-xs gap-2">
      {/* Brand & Command Bar Trigger */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-linear-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center text-white shadow-xs font-black">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base md:text-lg tracking-tight text-slate-900">ApexDrive</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">CRM</span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Dealership Field Sales</p>
          </div>
        </div>

        {/* Global Quick Search / Command Button */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden sm:flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200/80 text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          title="Open Natural Language Command Bar (Cmd+K)"
        >
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden xl:inline font-medium">Quick search or AI command...</span>
          <kbd className="hidden 2xl:inline-flex items-center gap-0.5 text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-500 shadow-2xs">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* PERSISTENT GAME STRIP (Section 5) */}
      {profile && (
        <div 
          onClick={onOpenGamification}
          className="flex items-center gap-2 md:gap-3 px-2.5 py-1 bg-linear-to-r from-amber-50/80 via-indigo-50/50 to-blue-50/80 rounded-xl border border-amber-200/70 shadow-2xs cursor-pointer hover:border-amber-300 transition-all text-xs overflow-x-auto no-scrollbar"
          title="Click to view full Game Day Scorecard & Leaderboards"
        >
          {/* Level Title */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-black text-amber-700 bg-amber-200/70 px-1.5 py-0.5 rounded text-[11px] font-mono">
              LVL {profile.level}
            </span>
            <span className="font-bold text-slate-800 text-[11px] hidden md:inline">
              {profile.levelTitle}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Points Progress */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="text-right">
              <span className="font-black font-mono text-slate-900 text-xs">
                {profile.points.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400 ml-0.5">pts</span>
            </div>
            {/* Progress bar to next level */}
            <div className="w-14 h-2 bg-slate-200 rounded-full overflow-hidden hidden lg:block">
              <div 
                className="h-full bg-linear-to-r from-amber-500 to-indigo-600 rounded-full" 
                style={{ width: `${Math.min(100, profile.levelProgressPercent)}%` }} 
              />
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          {/* Points Today vs Target */}
          <div className="flex items-center gap-1 shrink-0 bg-white/80 px-2 py-0.5 rounded-lg border border-slate-200/60">
            <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600" />
            <span className="font-bold font-mono text-[11px] text-indigo-950">
              {profile.pointsToday}/{profile.dailyTarget}
            </span>
            <span className="text-[9px] text-slate-400 hidden xl:inline">today</span>
          </div>

          {/* Streak Flame */}
          <div className="flex items-center gap-1 shrink-0 text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-200">
            <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
            <span className="font-mono text-[11px]">{profile.streakDays}d</span>
          </div>

          {/* Team Rank */}
          <div className="flex items-center gap-1 shrink-0 text-slate-700 bg-white/80 px-2 py-0.5 rounded-lg border border-slate-200/60 hidden sm:flex">
            <Trophy className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-semibold font-mono">#{profile.weeklyRank}</span>
          </div>

          {/* Active Product Bonus / Multiplier Badge */}
          {profile.activeMultiplier && (
            <div className="flex items-center gap-1 shrink-0 text-rose-700 font-black bg-rose-100/90 px-2 py-0.5 rounded-lg border border-rose-300 text-[10px] animate-pulse">
              <Sparkles className="w-3 h-3" />
              <span>{profile.activeMultiplier.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Action shortcuts & Role switcher */}
      <div className="flex items-center gap-1.5 md:gap-2.5 shrink-0">
        {/* Mobile Work Day Button */}
        <button
          type="button"
          onClick={onOpenMobileWorkDay}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
          title="Launch Field Execution Mode for today's visits"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Work My Day</span>
        </button>

        {/* Google Workspace Sync */}
        <button
          type="button"
          onClick={onOpenWorkspaceSync}
          className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200 transition-colors cursor-pointer"
          title="Google Workspace weekly data sync"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
          <span className="hidden 2xl:inline text-[11px] text-slate-500">Workspace Synced</span>
        </button>

        {/* Role Switcher (Preview Persona) */}
        <div className="flex items-center gap-2 bg-slate-100/90 pl-2 pr-1.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
          <div className="hidden lg:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {currentUser.firstName} {currentUser.lastName}
            </span>
            <span className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
              <span>{currentUser.region}</span>
              <span>•</span>
              <span className={`px-1 rounded text-[9px] font-bold border ${getRoleBadgeColor(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
            </span>
          </div>

          <select
            value={currentUser.id}
            onChange={(e) => {
              const u = allUsers.find(x => x.id === e.target.value);
              if (u) onSelectUser(u);
            }}
            className="text-xs bg-white text-slate-800 font-semibold px-2 py-1 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
            aria-label="Switch Role Persona"
          >
            <optgroup label="Sales Reps">
              {allUsers.filter(u => u.role === 'veteran_rep' || u.role === 'new_rep').map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.role === 'new_rep' ? 'Rookie Rep' : 'Vet Rep'} - {u.region})
                </option>
              ))}
            </optgroup>
            <optgroup label="Management & Leadership">
              {allUsers.filter(u => u.role === 'manager').map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} (Manager - {u.region})
                </option>
              ))}
            </optgroup>
            <optgroup label="Finance & Executives">
              {allUsers.filter(u => u.role === 'finance').map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} (Finance Controller)
                </option>
              ))}
              {allUsers.filter(u => u.role === 'owner').map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} (Owner / C-Level)
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>
    </header>
  );
};
