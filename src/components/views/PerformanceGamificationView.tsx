import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { User, GamificationProfile, PointsLedgerEntry } from '../../types/crm';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  Target,
  Crown,
  Medal,
  Calendar,
  CheckCircle2,
  TrendingUp,
  PartyPopper,
  Zap,
  History,
  ShieldCheck,
  Building
} from 'lucide-react';

interface PerformanceGamificationViewProps {
  currentUser: User;
  allUsers: User[];
  gamification: Record<string, GamificationProfile>;
  pointsLedger: PointsLedgerEntry[];
}

export const PerformanceGamificationView: React.FC<PerformanceGamificationViewProps> = ({
  currentUser,
  allUsers,
  gamification,
  pointsLedger
}) => {
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<'Weekly' | 'Monthly' | 'Quarterly' | 'Season'>('Weekly');
  const [activeTab, setActiveTab] = useState<'podium' | 'badges' | 'ledger'>('podium');

  const myProfile = gamification[currentUser.id] || {
    userId: currentUser.id,
    points: 1420,
    pointsToday: 60,
    dailyTarget: 100,
    streakDays: 8,
    bestStreak: 12,
    level: 4,
    levelTitle: 'Closer',
    pointsToNextLevel: 580,
    levelProgressPercent: 71,
    weeklyRank: 2,
    monthlyRank: 2,
    badges: [],
    personalBests: { maxVisitsDay: 6, maxWinsMonth: 4, longestStreak: 12 }
  };

  const handleCelebrateWin = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Rank users by points
  const reps = allUsers.filter(u => u.role === 'veteran_rep' || u.role === 'new_rep' || u.role === 'team_lead');
  const rankedReps = reps
    .map(rep => ({
      user: rep,
      profile: gamification[rep.id] || {
        userId: rep.id,
        points: 800,
        pointsToday: 30,
        dailyTarget: 100,
        streakDays: 3,
        bestStreak: 5,
        level: 2,
        levelTitle: 'Road Warrior',
        pointsToNextLevel: 200,
        levelProgressPercent: 50,
        weeklyRank: 4,
        monthlyRank: 4,
        badges: [],
        personalBests: { maxVisitsDay: 4, maxWinsMonth: 2, longestStreak: 5 }
      }
    }))
    .sort((a, b) => b.profile.points - a.profile.points);

  const top3 = rankedReps.slice(0, 3);
  const userLedger = pointsLedger.filter(p => p.userId === currentUser.id);

  return (
    <div className="space-y-6">
      {/* Top Game Day Header & Win Celebration */}
      <div className="bg-linear-to-r from-amber-500 via-orange-600 to-rose-600 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-black px-2 py-0.5 rounded bg-white/20 text-white tracking-wider font-mono">
              Q4 Field Championship
            </span>
            <span className="text-xs text-amber-100 flex items-center gap-1 font-bold">
              <Flame className="w-3.5 h-3.5 fill-current" /> {myProfile.streakDays}-Day Golden Window Streak!
            </span>
          </div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>Game Day Scorecard</span>
            <span className="text-sm font-bold bg-black/20 px-2 py-0.5 rounded-lg font-mono">
              LVL {myProfile.level} • {myProfile.levelTitle}
            </span>
          </h2>
          <p className="text-xs text-amber-100 mt-0.5">
            Real field actions award live points. Maintain good-window visit streaks to rank on the podium.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-xs px-4 py-2 rounded-2xl border border-white/20 text-center">
            <span className="text-[10px] font-bold uppercase text-amber-200 block">Total Verified Points</span>
            <span className="text-2xl font-black font-mono">{myProfile.points.toLocaleString()}</span>
          </div>

          <button
            type="button"
            onClick={handleCelebrateWin}
            className="flex items-center gap-2 px-4 py-2.5 bg-white text-orange-600 hover:bg-amber-50 rounded-2xl font-bold text-xs shadow-md transition-transform active:scale-95 cursor-pointer"
          >
            <PartyPopper className="w-4 h-4" />
            <span>Celebrate Win!</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold">
        {[
          { id: 'podium', label: '🏆 Leaderboard Podium' },
          { id: 'badges', label: 'Badges & Achievements' },
          { id: 'ledger', label: `My Points Ledger (${userLedger.length} entries)` }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`py-3 px-4 border-b-2 capitalize transition-colors cursor-pointer ${
              activeTab === t.id ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: PODIUM & LEADERBOARD (Section 5) */}
      {activeTab === 'podium' && (
        <div className="space-y-6">
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
            {/* Rank 2 */}
            {top3[1] && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center order-2 md:order-1 relative">
                <span className="w-8 h-8 rounded-full bg-slate-200 font-black font-mono flex items-center justify-center mx-auto mb-2 text-slate-700">
                  2
                </span>
                <h4 className="font-bold text-slate-900">{top3[1].user.firstName} {top3[1].user.lastName}</h4>
                <span className="text-[11px] text-slate-500">{top3[1].user.region} • {top3[1].profile.levelTitle}</span>
                <div className="text-xl font-black font-mono text-slate-800 mt-2">
                  {top3[1].profile.points.toLocaleString()} pts
                </div>
              </div>
            )}

            {/* Rank 1 (Gold Podium) */}
            {top3[0] && (
              <div className="bg-linear-to-b from-amber-50 to-white p-6 rounded-3xl border-2 border-amber-300 shadow-md text-center order-1 md:order-2 relative -translate-y-2">
                <Crown className="w-8 h-8 text-amber-500 mx-auto mb-1 fill-amber-500" />
                <span className="w-9 h-9 rounded-full bg-amber-500 font-black font-mono flex items-center justify-center mx-auto mb-2 text-white shadow-xs">
                  1
                </span>
                <h4 className="font-black text-slate-900 text-base">{top3[0].user.firstName} {top3[0].user.lastName}</h4>
                <span className="text-xs text-amber-800 font-semibold">{top3[0].user.region} • {top3[0].profile.levelTitle}</span>
                <div className="text-2xl font-black font-mono text-amber-600 mt-2">
                  {top3[0].profile.points.toLocaleString()} pts
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 font-mono">🔥 {top3[0].profile.streakDays}d streak</span>
              </div>
            )}

            {/* Rank 3 */}
            {top3[2] && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs text-center order-3 relative">
                <span className="w-8 h-8 rounded-full bg-amber-100 font-black font-mono flex items-center justify-center mx-auto mb-2 text-amber-800">
                  3
                </span>
                <h4 className="font-bold text-slate-900">{top3[2].user.firstName} {top3[2].user.lastName}</h4>
                <span className="text-[11px] text-slate-500">{top3[2].user.region} • {top3[2].profile.levelTitle}</span>
                <div className="text-xl font-black font-mono text-slate-800 mt-2">
                  {top3[2].profile.points.toLocaleString()} pts
                </div>
              </div>
            )}
          </div>

          {/* Full Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">Rank</th>
                  <th className="p-3">Sales Producer</th>
                  <th className="p-3">Level & Title</th>
                  <th className="p-3">Golden Window Streak</th>
                  <th className="p-3 text-right">Total Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rankedReps.map((r, i) => (
                  <tr 
                    key={r.user.id} 
                    className={`hover:bg-slate-50 ${r.user.id === currentUser.id ? 'bg-orange-50/50 font-bold' : ''}`}
                  >
                    <td className="p-3 font-mono font-bold">#{i + 1}</td>
                    <td className="p-3 font-bold text-slate-900">
                      {r.user.firstName} {r.user.lastName}
                      {r.user.id === currentUser.id && <span className="ml-2 text-orange-600 text-[10px]">(You)</span>}
                    </td>
                    <td className="p-3 text-slate-600">{r.profile.levelTitle}</td>
                    <td className="p-3 font-mono text-orange-600 font-bold flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 fill-current" /> {r.profile.streakDays} days
                    </td>
                    <td className="p-3 text-right font-mono font-black text-slate-900">
                      {r.profile.points.toLocaleString()} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BADGES & ACHIEVEMENTS */}
      {activeTab === 'badges' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Ceramic Pro Pioneer', cat: 'Upselling', desc: 'First 3 Ceramic Pro upsells closed', icon: '✨', prog: 1, target: 3, unlocked: false },
            { name: 'Golden Window Master', cat: 'Visits', desc: '10 consecutive visits within 10 AM-4 PM', icon: '⏱️', prog: 10, target: 10, unlocked: true },
            { name: 'Key Master', cat: 'Servicing', desc: 'Topped up 1,000+ Keyfetch fobs on clients', icon: '🔑', prog: 850, target: 1000, unlocked: false },
            { name: 'Territory Hawk', cat: 'Scouting', desc: 'Scouted 25+ qualified dealerships', icon: '🦅', prog: 28, target: 25, unlocked: true },
            { name: 'The Closer', cat: 'Closing', desc: 'Converted 5 assists into won contracts', icon: '🎯', prog: 4, target: 5, unlocked: false },
            { name: 'Shield of Trust', cat: 'Relationships', desc: 'Maintained 90%+ client health score', icon: '🛡️', prog: 94, target: 90, unlocked: true }
          ].map((b, i) => (
            <div key={i} className={`p-4 rounded-2xl border text-xs space-y-2 ${
              b.unlocked ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50 border-slate-200/80 opacity-75'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{b.icon}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  b.unlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}>
                  {b.unlocked ? 'Unlocked' : `${b.prog}/${b.target}`}
                </span>
              </div>
              <h4 className="font-bold text-slate-900">{b.name}</h4>
              <p className="text-[11px] text-slate-500">{b.desc}</p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${b.unlocked ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                  style={{ width: `${Math.min(100, (b.prog / b.target) * 100)}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: REAL POINTS LEDGER (Section 5) */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action Description</th>
                <th className="p-3">Dealership</th>
                <th className="p-3">Rule Version</th>
                <th className="p-3 text-right">Points Earned</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userLedger.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono text-slate-400">{entry.timestamp.replace('T', ' ').substring(0, 16)}</td>
                  <td className="p-3 font-semibold text-slate-800">{entry.description}</td>
                  <td className="p-3 text-slate-600">{entry.dealershipName || '—'}</td>
                  <td className="p-3 font-mono text-[10px] text-slate-400">{entry.ruleVersion}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    +{entry.pointsAwarded} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
