import React, { useMemo, useState } from 'react';
import { Gamepad2, Plus } from 'lucide-react';
import { GameRule, GamificationProfile, PointsLedgerEntry, ProductBonus, ProductCatalogItem, User, UserRole } from '../../types/crm';
import { Badge, Btn, Dialog, EmptyState, Page, PageHeader, Panel, SectionTitle, Switch, Toolbar } from '../ui/kit';
import { formatShortDay, matches, plural } from '../../utils/format';

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

const LEVELS = [
  { level: 1, title: 'Rookie', min: 0 },
  { level: 2, title: 'Road Warrior', min: 500 },
  { level: 3, title: 'Lot Legend', min: 1200 },
  { level: 4, title: 'Closer', min: 2000 },
  { level: 5, title: 'Territory Boss', min: 3500 },
  { level: 6, title: 'Hall of Fame', min: 5000 }
];

const ACTION_WORD: Record<ProductBonus['actionTypes'][number], string> = {
  upsell_won: 'an upsell is won',
  signed: 'it’s signed at sign-up',
  interest_recorded: 'interest is recorded'
};
const ROLE_WORD: Partial<Record<UserRole, string>> = { new_rep: 'New reps', veteran_rep: 'Reps', team_lead: 'Team leads', manager: 'Managers', owner: 'Owners' };
const rolesText = (roles: UserRole[]) => {
  const reps = ['new_rep', 'veteran_rep', 'team_lead'].every(r => roles.includes(r as UserRole));
  const rest = roles.filter(r => !reps || !['new_rep', 'veteran_rep', 'team_lead'].includes(r)).map(r => ROLE_WORD[r] ?? r);
  return [...(reps ? ['All reps'] : []), ...rest].join(', ');
};
const today = () => new Date().toISOString().slice(0, 10);
const bonusStatus = (b: ProductBonus): { label: string; tone: 'green' | 'neutral' | 'amber' } =>
  !b.isActive ? { label: 'Paused', tone: 'neutral' } : b.endDate < today() ? { label: 'Ended', tone: 'neutral' } : b.startDate > today() ? { label: 'Starts soon', tone: 'amber' } : { label: 'Live', tone: 'green' };

export const GameRulesConsoleView: React.FC<GameRulesConsoleViewProps> = ({ gameRules, productBonuses, catalog, currentUser, users = [], gamification = {}, pointsLedger = [], onUpdateRule, onAddProductBonus, onToggleBonus }) => {
  const canEditRules = currentUser.role === 'owner' || currentUser.role === 'executive';
  const canManageBonuses = canEditRules || currentUser.role === 'manager';
  const [tab, setTab] = useState<'bonuses' | 'actions' | 'levels' | 'try'>('bonuses');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');

  const rules = gameRules.filter(r => (cat === 'all' || r.category === cat) && matches(q, r.label, r.category));
  const reps = users.filter(u => ['new_rep', 'veteran_rep', 'team_lead'].includes(u.role) && gamification[u.id]);

  return (
    <Page>
      <PageHeader
        icon={<Gamepad2 className="h-6 w-6" />}
        title="Points rules"
        subtitle="What each piece of field work is worth, bonuses running now, and the levels reps climb."
        actions={
          canManageBonuses && (
            <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add a product bonus
            </Btn>
          )
        }
      />

      <Switch
        label="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'bonuses', label: `Bonuses (${productBonuses.filter(b => bonusStatus(b).label === 'Live').length} live)` },
          { value: 'actions', label: 'What earns points' },
          { value: 'levels', label: 'Levels & streaks' },
          ...(canManageBonuses ? [{ value: 'try' as const, label: 'Try a change' }] : [])
        ]}
      />

      {tab === 'bonuses' &&
        (productBonuses.length === 0 ? (
          <EmptyState title="No bonuses yet" action={canManageBonuses && <Btn variant="primary" onClick={() => setAdding(true)}>Add a product bonus</Btn>} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...productBonuses]
              .sort((a, b) => Number(bonusStatus(b).label === 'Live') - Number(bonusStatus(a).label === 'Live'))
              .map(b => {
                const st = bonusStatus(b);
                return (
                  <Panel key={b.id} className={`space-y-2 p-4 ${st.label === 'Live' ? '' : 'bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {canManageBonuses && (
                        <Btn size="sm" variant="ghost" onClick={() => onToggleBonus(b.id)}>
                          {b.isActive ? 'Pause' : 'Turn on'}
                        </Btn>
                      )}
                    </div>
                    <div className="text-[17px] font-bold text-slate-900">{b.productName}</div>
                    <div className="text-[22px] font-extrabold text-emerald-700">{b.multiplier ? `${b.multiplier}× points` : `+${b.bonusPoints} points`}</div>
                    <p className="text-[14px] text-slate-600">
                      When {b.actionTypes.map(a => ACTION_WORD[a]).join(' or ')} · {b.targetType === 'all' ? 'everyone' : b.targetValue ?? b.targetType}
                    </p>
                    <p className="text-[13px] text-slate-500">
                      {formatShortDay(b.startDate)} – {formatShortDay(b.endDate)}
                    </p>
                  </Panel>
                );
              })}
          </div>
        ))}

      {tab === 'actions' && (
        <>
          <Toolbar
            search={{ value: q, onChange: setQ, placeholder: 'Search actions' }}
            filters={[{ id: 'cat', allLabel: 'All kinds', value: cat, onChange: setCat, options: [...new Set(gameRules.map(r => r.category))].map(c => ({ value: c, label: c, count: gameRules.filter(r => r.category === c).length })) }]}
            count={plural(rules.length, 'action')}
            onClear={() => {
              setQ('');
              setCat('all');
            }}
          />
          <Panel className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Kind</th>
                  <th className="px-4 py-3 text-right">Points</th>
                  <th className="px-4 py-3 text-right">Most per day</th>
                  <th className="px-4 py-3">Who</th>
                  {canEditRules && <th className="px-4 py-3">On</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rules.map(r => (
                  <tr key={r.id} className={r.enabled ? '' : 'text-slate-400'}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{r.label}</td>
                    <td className="px-4 py-3 text-slate-600">{r.category}</td>
                    <td className="px-4 py-3 text-right">
                      {canEditRules ? (
                        <input
                          type="number"
                          min={0}
                          aria-label={`Points for ${r.label}`}
                          value={r.basePoints}
                          onChange={e => onUpdateRule({ ...r, basePoints: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          className="min-h-[36px] w-20 rounded-lg border border-slate-300 px-2 text-right font-semibold"
                        />
                      ) : (
                        <span className="font-bold text-emerald-700">+{r.basePoints}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.dailyCap ? r.dailyCap : 'No limit'}</td>
                    <td className="px-4 py-3 text-slate-600">{rolesText(r.applicableRoles)}</td>
                    {canEditRules && (
                      <td className="px-4 py-3">
                        <input type="checkbox" aria-label={`${r.label} on`} checked={r.enabled} onChange={e => onUpdateRule({ ...r, enabled: e.target.checked })} className="h-5 w-5 accent-blue-600" />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          {!canEditRules && <p className="text-[13px] text-slate-500">Only owners can change these points.</p>}
        </>
      )}

      {tab === 'levels' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Panel className="p-4 lg:col-span-2">
            <SectionTitle>Levels</SectionTitle>
            <table className="mt-2 w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                  <th className="py-2">Level</th>
                  <th className="py-2">From</th>
                  <th className="py-2">Reps there now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LEVELS.map(l => {
                  const here = reps.filter(u => gamification[u.id].level === l.level);
                  return (
                    <tr key={l.level}>
                      <td className="py-2.5 font-semibold text-slate-900">
                        {l.level} · {l.title}
                      </td>
                      <td className="py-2.5 text-slate-700">{l.min.toLocaleString()} pts</td>
                      <td className="py-2.5 text-slate-700">{here.length ? here.map(u => u.firstName).join(', ') : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <Panel className="space-y-2 p-4 text-[14px] text-slate-700">
            <SectionTitle>Streaks</SectionTitle>
            <p>A streak counts working days in a row with at least one visit, call or Google Meet between 10 AM and 4 PM.</p>
            <p>Weekends and booked days off don’t break it. A day with no live contact does.</p>
            <p>The daily target is 100 points; reps see their progress in the top bar.</p>
          </Panel>
        </div>
      )}

      {tab === 'try' && <TryAChange catalog={catalog} reps={reps} gamification={gamification} pointsLedger={pointsLedger} />}

      {adding && (
        <AddBonus
          catalog={catalog}
          onClose={() => setAdding(false)}
          onAdd={b => {
            onAddProductBonus(b);
            setAdding(false);
          }}
        />
      )}
    </Page>
  );
};

const field = 'mt-1 min-h-[40px] w-full rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-normal';
const labelCls = 'block text-[14px] font-semibold text-slate-800';

const AddBonus: React.FC<{ catalog: ProductCatalogItem[]; onClose: () => void; onAdd: (b: ProductBonus) => void }> = ({ catalog, onClose, onAdd }) => {
  const [productId, setProductId] = useState(catalog.find(p => p.isNewLaunch)?.id ?? catalog[0]?.id ?? '');
  const [kind, setKind] = useState<'points' | 'multiply'>('points');
  const [points, setPoints] = useState(150);
  const [mult, setMult] = useState(2);
  const [action, setAction] = useState<ProductBonus['actionTypes'][number]>('upsell_won');
  const [start, setStart] = useState(today());
  const [end, setEnd] = useState(new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10));
  return (
    <Dialog title="Add a product bonus" onClose={onClose}>
      <label className={labelCls}>
        Product
        <select value={productId} onChange={e => setProductId(e.target.value)} className={field}>
          {catalog.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isNewLaunch ? ' (new)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        When
        <select value={action} onChange={e => setAction(e.target.value as typeof action)} className={field}>
          <option value="upsell_won">An upsell is won on a client</option>
          <option value="signed">It’s signed at sign-up</option>
          <option value="interest_recorded">Interest is recorded on a visit</option>
        </select>
      </label>
      <div>
        <Switch
          label="Bonus kind"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'points', label: 'Extra points' },
            { value: 'multiply', label: 'Multiply points' }
          ]}
        />
        <input
          type="number"
          min={kind === 'points' ? 1 : 2}
          aria-label={kind === 'points' ? 'Extra points' : 'Multiply by'}
          value={kind === 'points' ? points : mult}
          onChange={e => (kind === 'points' ? setPoints(parseInt(e.target.value, 10) || 0) : setMult(parseInt(e.target.value, 10) || 2))}
          className={`${field} mt-2`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className={labelCls}>
          From
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className={field} />
        </label>
        <label className={labelCls}>
          Until
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={field} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>
          Cancel
        </Btn>
        <Btn
          variant="primary"
          disabled={!productId || end < start}
          onClick={() =>
            onAdd({
              id: `pb_${Date.now()}`,
              productId,
              productName: catalog.find(p => p.id === productId)?.name ?? 'Product',
              bonusPoints: kind === 'points' ? points : 0,
              multiplier: kind === 'multiply' ? mult : undefined,
              actionTypes: [action],
              startDate: start,
              endDate: end,
              targetType: 'all',
              isActive: true
            })
          }
        >
          Start bonus
        </Btn>
      </div>
    </Dialog>
  );
};

const TryAChange: React.FC<{ catalog: ProductCatalogItem[]; reps: User[]; gamification: Record<string, GamificationProfile>; pointsLedger: PointsLedgerEntry[] }> = ({ catalog, reps, gamification, pointsLedger }) => {
  const [productId, setProductId] = useState(catalog.find(p => p.isNewLaunch)?.id ?? catalog[0]?.id ?? '');
  const [extra, setExtra] = useState(150);
  const name = catalog.find(p => p.id === productId)?.name ?? '';
  const rows = useMemo(() => {
    const hits = (id: string) => pointsLedger.filter(l => l.userId === id && name && l.description.includes(name)).length;
    const now = [...reps].sort((a, b) => gamification[b.id].points - gamification[a.id].points);
    const then = [...reps].sort((a, b) => gamification[b.id].points + hits(b.id) * extra - (gamification[a.id].points + hits(a.id) * extra));
    return then.map((u, i) => ({ u, before: now.indexOf(u) + 1, after: i + 1, add: hits(u.id) * extra, total: gamification[u.id].points + hits(u.id) * extra }));
  }, [reps, gamification, pointsLedger, name, extra]);
  return (
    <Panel className="space-y-4 p-5">
      <div>
        <SectionTitle>What if every {name || 'product'} entry earned extra?</SectionTitle>
        <p className="text-[14px] text-slate-500">Uses the last 30 days of real points. Nothing changes until you add a bonus.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className={labelCls}>
          Product
          <select value={productId} onChange={e => setProductId(e.target.value)} className={field}>
            {catalog.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          Extra points each time
          <input type="number" min={0} value={extra} onChange={e => setExtra(parseInt(e.target.value, 10) || 0)} className={`${field} w-32`} />
        </label>
      </div>
      <table className="w-full text-left text-[14px]">
        <thead>
          <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
            <th className="py-2">Rank</th>
            <th className="py-2">Rep</th>
            <th className="py-2 text-right">Extra</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.u.id}>
              <td className="py-2.5">
                {r.after}
                {r.after !== r.before && <span className={`ml-2 text-[13px] font-semibold ${r.after < r.before ? 'text-emerald-700' : 'text-rose-700'}`}>{r.after < r.before ? `▲ from ${r.before}` : `▼ from ${r.before}`}</span>}
              </td>
              <td className="py-2.5 font-semibold text-slate-900">
                {r.u.firstName} {r.u.lastName}
              </td>
              <td className="py-2.5 text-right text-emerald-700">{r.add ? `+${r.add}` : '—'}</td>
              <td className="py-2.5 text-right font-semibold">{r.total.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
};
