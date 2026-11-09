import React, { useMemo, useState } from 'react';
import { Flame, Sparkles, Trophy } from 'lucide-react';
import { GamificationProfile, PointsLedgerEntry, User } from '../../types/crm';
import { Badge, EmptyState, Page, PageHeader, Panel, Stat, Switch, Toolbar } from '../ui/kit';
import { formatStamp, matches, plural } from '../../utils/format';

interface PerformanceGamificationViewProps {
  currentUser: User;
  allUsers: User[];
  gamification: Record<string, GamificationProfile>;
  pointsLedger: PointsLedgerEntry[];
}

type Period = 'week' | 'month' | 'all';
const REP_ROLES = ['veteran_rep', 'new_rep', 'team_lead'];
const MEDAL = ['🥇', '🥈', '🥉'];

const startOf = (p: Period) => {
  const d = new Date();
  // Rolling windows, so Monday morning isn't a page of zeros.
  if (p === 'week') d.setDate(d.getDate() - 7);
  else if (p === 'month') d.setDate(d.getDate() - 30);
  else return '';
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const ACTION_LABEL = (t: string) =>
  t
    .replace(/_/g, ' ')
    .replace(/\b(\w)/, c => c.toUpperCase())
    .replace('Gap', 'GAP');

export const PerformanceGamificationView: React.FC<PerformanceGamificationViewProps> = ({ currentUser, allUsers, gamification, pointsLedger }) => {
  const me = gamification[currentUser.id];
  const [tab, setTab] = useState<'board' | 'badges' | 'mine'>('board');
  const [period, setPeriod] = useState<Period>('week');
  const [region, setRegion] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'done' | 'next'>('all');
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [minePeriod, setMinePeriod] = useState('all');

  const reps = allUsers.filter(u => REP_ROLES.includes(u.role) && u.active !== false);
  const regions = [...new Set(reps.map(r => r.region))];

  const board = useMemo(() => {
    const from = startOf(period);
    return reps
      .filter(r => region === 'all' || r.region === region)
      .map(r => {
        const prof = gamification[r.id];
        const pts = period === 'all' ? prof?.points ?? 0 : pointsLedger.filter(e => e.userId === r.id && e.timestamp >= from).reduce((s, e) => s + e.pointsAwarded, 0);
        return { r, prof, pts };
      })
      .sort((a, b) => b.pts - a.pts);
  }, [reps, region, period, gamification, pointsLedger]);

  const mine = useMemo(() => {
    const from = minePeriod === 'all' ? '' : startOf(minePeriod as Period);
    return pointsLedger
      .filter(e => e.userId === currentUser.id && e.timestamp >= from && (type === 'all' || e.actionType === type) && matches(q, e.description, e.dealershipName))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [pointsLedger, currentUser.id, minePeriod, type, q]);
  const myTypes = [...new Set(pointsLedger.filter(e => e.userId === currentUser.id).map(e => e.actionType))];

  const badges = useMemo(() => {
    const list = [...(me?.badges ?? [])].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.currentProgress / b.targetProgress - a.currentProgress / a.targetProgress);
    return list.filter(b => badgeFilter === 'all' || (badgeFilter === 'done' ? b.unlocked : !b.unlocked));
  }, [me, badgeFilter]);

  return (
    <Page>
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Points & leaderboard"
        subtitle="Points come from real field work: visits and calls between 10 and 4, sign-ups, top-ups and products. Nothing to claim; it adds up as you log."
      />

      {me && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Panel className="p-4">
            <div className="text-[13px] font-medium text-slate-600">Level {me.level}</div>
            <div className="text-[22px] font-extrabold leading-tight text-slate-900">{me.levelTitle}</div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, me.levelProgressPercent)}%` }} />
            </div>
            <div className="mt-1 text-[13px] text-slate-500">{me.pointsToNextLevel > 0 ? `${me.pointsToNextLevel.toLocaleString()} points to the next level` : 'Top level'}</div>
          </Panel>
          <Stat label="Total points" value={me.points.toLocaleString()} hint={`#${me.weeklyRank} this week · #${me.monthlyRank} this month`} />
          <Stat label="Today" value={`${me.pointsToday} / ${me.dailyTarget}`} hint={me.pointsToday >= me.dailyTarget ? 'Daily target hit' : `${me.dailyTarget - me.pointsToday} to go`} tone={me.pointsToday >= me.dailyTarget ? 'green' : 'neutral'} />
          <Stat
            label="Streak"
            value={
              <span className="inline-flex items-center gap-1">
                <Flame className="h-6 w-6 fill-orange-500 text-orange-500" />
                {plural(me.streakDays, 'day')}
              </span>
            }
            hint={`Best ${me.bestStreak} · working days with a visit or call in 10–4`}
          />
        </div>
      )}

      {me?.activeMultiplier && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[14px] text-rose-900">
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            <strong>{me.activeMultiplier.label}.</strong> See Points rules for every bonus running now.
          </span>
        </div>
      )}

      <Switch
        label="Section"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'board', label: 'Leaderboard' },
          { value: 'badges', label: `Badges${me ? ` (${me.badges.filter(b => b.unlocked).length}/${me.badges.length})` : ''}` },
          ...(me ? [{ value: 'mine' as const, label: 'My points' }] : [])
        ]}
      />

      {tab === 'board' && (
        <>
          <Toolbar
            filters={[
              {
                id: 'period',
                allLabel: 'All time',
                defaultValue: 'week',
                value: period === 'all' ? 'all' : period,
                onChange: v => setPeriod(v as Period),
                options: [
                  { value: 'week', label: 'Last 7 days' },
                  { value: 'month', label: 'Last 30 days' }
                ]
              },
              { id: 'region', allLabel: 'All regions', value: region, onChange: setRegion, options: regions.map(r => ({ value: r, label: r })) }
            ]}
            count={plural(board.length, 'rep')}
            onClear={() => {
              setPeriod('week');
              setRegion('all');
            }}
          />
          <Panel className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Rep</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Streak</th>
                  <th className="px-4 py-3 text-right">{period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'All time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {board.map(({ r, prof, pts }, i) => (
                  <tr key={r.id} className={r.id === currentUser.id ? 'bg-blue-50/60' : ''}>
                    <td className="px-4 py-3 text-[16px]">{MEDAL[i] ?? <span className="text-[14px] font-semibold text-slate-500">{i + 1}</span>}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {r.firstName} {r.lastName}
                        {r.id === currentUser.id && <Badge tone="blue" className="ml-2">You</Badge>}
                        {r.role === 'new_rep' && <Badge tone="teal" className="ml-2">New</Badge>}
                      </div>
                      <div className="text-[13px] text-slate-500">{r.region}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{prof ? `${prof.level} · ${prof.levelTitle}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      {prof ? (
                        <span className="inline-flex items-center gap-1">
                          <Flame className="h-4 w-4 fill-orange-500 text-orange-500" />
                          {plural(prof.streakDays, 'day')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[16px] font-bold text-slate-900">{pts.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {tab === 'badges' &&
        (!me ? (
          <EmptyState title="Badges are earned by reps" />
        ) : (
          <>
            <Switch
              label="Show"
              value={badgeFilter}
              onChange={setBadgeFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: 'done', label: 'Earned' },
                { value: 'next', label: 'In progress' }
              ]}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {badges.map(b => (
                <Panel key={b.id ?? b.name} className={`space-y-2 p-4 ${b.unlocked ? '' : 'bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[28px] leading-none">{b.icon}</span>
                    {b.unlocked ? <Badge tone="green">Earned</Badge> : <Badge>{`${b.currentProgress} of ${b.targetProgress}`}</Badge>}
                  </div>
                  <div className="text-[16px] font-bold text-slate-900">{b.name}</div>
                  <p className="text-[14px] text-slate-600">{b.description}</p>
                  {!b.unlocked && (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (b.currentProgress / b.targetProgress) * 100)}%` }} />
                    </div>
                  )}
                </Panel>
              ))}
            </div>
          </>
        ))}

      {tab === 'mine' && me && (
        <>
          <Toolbar
            search={{ value: q, onChange: setQ, placeholder: 'Search what or where' }}
            filters={[
              { id: 'type', allLabel: 'Every kind', value: type, onChange: setType, options: myTypes.map(t => ({ value: t, label: ACTION_LABEL(t), count: pointsLedger.filter(e => e.userId === currentUser.id && e.actionType === t).length })) },
              { id: 'when', allLabel: 'Any time', value: minePeriod, onChange: setMinePeriod, options: [{ value: 'week', label: 'Last 7 days' }, { value: 'month', label: 'Last 30 days' }] }
            ]}
            count={`${plural(mine.length, 'entry', 'entries')} · ${mine.reduce((s, e) => s + e.pointsAwarded, 0).toLocaleString()} pts`}
            onClear={() => {
              setQ('');
              setType('all');
              setMinePeriod('all');
            }}
          />
          {mine.length === 0 ? (
            <EmptyState title="Nothing here" hint="Try clearing a filter." />
          ) : (
            <Panel className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">What</th>
                    <th className="px-4 py-3">Dealership</th>
                    <th className="px-4 py-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mine.map(e => (
                    <tr key={e.id} title={e.ruleVersion ? `Rule ${e.ruleVersion}` : undefined}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatStamp(e.timestamp)}</td>
                      <td className="px-4 py-3 text-slate-900">{e.description}</td>
                      <td className="px-4 py-3 text-slate-600">{e.dealershipName || '—'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${e.pointsAwarded < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {e.pointsAwarded > 0 ? '+' : ''}
                        {e.pointsAwarded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </>
      )}
    </Page>
  );
};
