import React, { useState } from 'react';
import { GameRule, GamificationProfile, PointsLedgerEntry, ProductBonus, ProductCatalogItem, User } from '../../types/crm';
import {
  Gamepad2,
  Sparkles,
  Flame,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  Sliders,
  Target,
  Trophy,
  RotateCcw,
  Zap,
  Play,
  ShieldAlert
} from 'lucide-react';

interface GameRulesConsoleViewProps {
  gameRules: GameRule[];
  productBonuses: ProductBonus[];
  catalog: ProductCatalogItem[];
  currentUser: User;
  onUpdateRule: (rule: GameRule) => void;
  onAddProductBonus: (bonus: ProductBonus) => void;
  onToggleBonus: (bonusId: string) => void;
  users?: User[];
  gamification?: Record<string, GamificationProfile>;
  pointsLedger?: PointsLedgerEntry[];
}

export const GameRulesConsoleView: React.FC<GameRulesConsoleViewProps> = ({
  gameRules,
  productBonuses,
  catalog,
  currentUser,
  users = [],
  gamification = {},
  pointsLedger = [],
  onUpdateRule,
  onAddProductBonus,
  onToggleBonus
}) => {
  const [activeTab, setActiveTab] = useState<'points_table' | 'product_bonuses' | 'levels_streaks' | 'simulator'>('product_bonuses');
  
  // Product bonus creation form
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusProductId, setBonusProductId] = useState(catalog[9]?.id || catalog[0]?.id || 'prod_10');
  const [bonusPoints, setBonusPoints] = useState(150);
  const [bonusMultiplier, setBonusMultiplier] = useState(1);
  const [bonusActionType, setBonusActionType] = useState<'upsell_won' | 'signed' | 'interest_recorded'>('upsell_won');
  const [bonusTargetType, setBonusTargetType] = useState<'all' | 'region' | 'team'>('all');

  const canEditRules = currentUser.role === 'owner' || currentUser.role === 'executive';
  const canManageBonuses = canEditRules || currentUser.role === 'manager';

  const handleCreateBonus = () => {
    const prod = catalog.find(p => p.id === bonusProductId);
    const newBonus: ProductBonus = {
      id: `pb_${Date.now()}`,
      productId: bonusProductId,
      productName: prod?.name || 'Selected Product',
      bonusPoints: bonusMultiplier > 1 ? 0 : bonusPoints,
      multiplier: bonusMultiplier > 1 ? bonusMultiplier : undefined,
      actionTypes: [bonusActionType],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10),
      targetType: bonusTargetType,
      isActive: true
    };
    onAddProductBonus(newBonus);
    setShowBonusModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-indigo-600" />
            <span>Game Rules & Incentive Console</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure scorable field actions, create launch multipliers on any catalog product, and tune territory streak targets.
          </p>
        </div>

        {canManageBonuses && (
          <button
            type="button"
            onClick={() => setShowBonusModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-r from-orange-600 to-rose-600 hover:from-orange-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Product Bonus</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold">
        {[
          { id: 'product_bonuses', label: '🔥 Active Product Bonuses', count: productBonuses.filter(b => b.isActive).length },
          { id: 'points_table', label: 'Scorable Actions Table', count: gameRules.length },
          { id: 'levels_streaks', label: 'Levels & Streak Thresholds' },
          { id: 'simulator', label: 'Leaderboard Simulation' }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`py-3 px-4 border-b-2 capitalize transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-mono">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: PRODUCT BONUSES (Section 6) */}
      {activeTab === 'product_bonuses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {productBonuses.map(b => (
              <div 
                key={b.id}
                className={`p-4 rounded-2xl border transition-all ${
                  b.isActive 
                    ? 'bg-linear-to-br from-rose-50/50 via-white to-amber-50/50 border-rose-200 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-100 px-2 py-0.5 rounded">
                    {b.targetType === 'all' ? 'All Territories' : b.targetType}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleBonus(b.id)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    {b.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>

                <div className="my-3">
                  <h4 className="font-black text-slate-900 text-base">{b.productName}</h4>
                  <div className="mt-1 flex items-center gap-2">
                    {b.multiplier ? (
                      <span className="text-xl font-black font-mono text-rose-600">
                        {b.multiplier}x Points
                      </span>
                    ) : (
                      <span className="text-xl font-black font-mono text-emerald-600">
                        +{b.bonusPoints} Bonus Pts
                      </span>
                    )}
                    <span className="text-xs text-slate-500">on {b.actionTypes.join(', ')}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Valid: {b.startDate} to {b.endDate}</span>
                  <span className="font-bold text-orange-600 flex items-center gap-0.5">
                    <Flame className="w-3 h-3 fill-current" /> Live
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: POINTS TABLE */}
      {activeTab === 'points_table' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <th className="p-3">Category</th>
                <th className="p-3">Action Description</th>
                <th className="p-3">Base Points</th>
                <th className="p-3">Daily Cap</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Applicable Roles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gameRules.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="p-3 font-semibold text-slate-500">{r.category}</td>
                  <td className="p-3 font-bold text-slate-900">{r.label}</td>
                  <td className="p-3 font-mono font-bold text-emerald-600">+{r.basePoints} pts</td>
                  <td className="p-3 font-mono text-slate-500">{r.dailyCap ? `${r.dailyCap} pts/day` : 'No Cap'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-500 font-mono text-[10px]">
                    {r.applicableRoles.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: LEVELS & STREAKS */}
      {activeTab === 'levels_streaks' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900">Professional Field Sales Levels</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {[
              { level: 1, title: 'Rookie', min: 0 },
              { level: 2, title: 'Road Warrior', min: 500 },
              { level: 3, title: 'Lot Legend', min: 1200 },
              { level: 4, title: 'Closer', min: 2000 },
              { level: 5, title: 'Territory Boss', min: 3500 },
              { level: 6, title: 'Hall of Fame', min: 5000 }
            ].map(l => (
              <div key={l.level} className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-center space-y-1">
                <span className="font-mono font-bold text-indigo-600 block text-[10px]">LEVEL {l.level}</span>
                <span className="font-bold text-slate-900 block">{l.title}</span>
                <span className="text-[10px] text-slate-400 font-mono">{l.min}+ pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LEADERBOARD SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 text-indigo-600 font-bold">
            <Zap className="w-5 h-5" />
            <span>Rule Impact Simulator</span>
          </div>
          <p className="text-slate-500">
            Preview how recent leaderboard standings would shift if you increase the Ceramic Pro launch bonus or double the Golden Window visit weight.
          </p>

          <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-2">
            <span className="font-bold text-indigo-900">Simulated Change: +150 Ceramic Pro Upsell Bonus</span>
            <p className="text-indigo-800 text-[11px]">
              {(() => {
                const reps = users.filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role) && gamification[u.id]);
                const extra = (id: string) => pointsLedger.filter(l => l.userId === id && /Ceramic Pro/.test(l.description)).length * 150;
                const now = [...reps].sort((a, b) => gamification[b.id].points - gamification[a.id].points);
                const then = [...reps].sort((a, b) => gamification[b.id].points + extra(b.id) - (gamification[a.id].points + extra(a.id)));
                if (!now.length) return 'No reps to simulate yet.';
                const moved = then.filter((u, i) => now.indexOf(u) !== i);
                const lead = then[0];
                return `Projected: ${lead.firstName} ${lead.lastName} ${now[0] === lead ? 'stays' : 'moves to'} #1 (+${extra(lead.id)} pts). ${moved.length ? `${moved.length} rep${moved.length > 1 ? 's' : ''} change position: ${moved.map(u => `${u.firstName} ${u.lastName} → #${then.indexOf(u) + 1}`).join(', ')}.` : 'No other positions change.'}`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Create Product Bonus Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="font-bold text-sm text-slate-900">
              Create Launch or Territory Product Bonus
            </h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Product:</label>
                <select
                  value={bonusProductId}
                  onChange={(e) => setBonusProductId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  {catalog.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isNewLaunch ? '(🔥 NEW Launch)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bonus Points (+pts):</label>
                  <input
                    type="number"
                    value={bonusPoints}
                    onChange={(e) => setBonusPoints(parseInt(e.target.value, 10) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Or Multiplier (e.g. 2x):</label>
                  <input
                    type="number"
                    value={bonusMultiplier}
                    onChange={(e) => setBonusMultiplier(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Eligible Action:</label>
                <select
                  value={bonusActionType}
                  onChange={(e) => setBonusActionType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white"
                >
                  <option value="upsell_won">Upsell Won on Active Client</option>
                  <option value="signed">Product Signed at Deal Sign-Up</option>
                  <option value="interest_recorded">Interest Recorded During Discovery</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBonusModal(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBonus}
                className="px-4 py-1.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 cursor-pointer"
              >
                Activate Bonus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
