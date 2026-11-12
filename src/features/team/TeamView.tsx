// The manager's home: every rep on one screen, who needs help first, with the
// reason in plain words. Open a rep to act: offer to join a visit, send a
// nudge, note it for the next check-in, or record that you've checked in.

import React, { useMemo, useState } from 'react';
import { ChevronRight, Trophy, Users } from 'lucide-react';
import type { Dealership, User } from '../../types/crm';
import { Badge, EmptyState, Page, PageHeader, Panel, Stat, Toolbar, useSticky } from '../../components/ui/kit';
import { formatRelative, matches, plural } from '../../utils/format';
import { FlagKind, RepReport, RepStatus, sortReports } from './signals';
import { FlagGlyph, flagColour, initials, KIND_LABEL, StatusBadge } from './flagUi';
import { lastCheckIn, useTeamState } from './store';
import { RepPanel, RepPanelActions } from './RepPanel';

interface Props extends RepPanelActions {
  reports: RepReport[];
  currentUser: User;
  users: User[];
  dealerships: Dealership[];
}

type Sort = 'attention' | 'checkin' | 'name';

export const TeamView: React.FC<Props> = props => {
  const { reports, currentUser, users } = props;
  const team = useTeamState();
  const isManager = currentUser.role === 'manager' || currentUser.role === 'team_lead';
  const managers = users.filter(u => (u.role === 'manager' || u.role === 'team_lead') && reports.some(r => r.rep.managerId === u.id));

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | RepStatus>('all');
  const [kind, setKind] = useState<'all' | FlagKind>('all');
  const [mgr, setMgr] = useState('all');
  const [sort, setSort] = useSticky<Sort>('team_sort', 'attention');
  const [openRep, setOpenRep] = useState<string | null>(null);

  const scoped = useMemo(() => reports.filter(r => mgr === 'all' || r.rep.managerId === mgr), [reports, mgr]);
  const list = useMemo(() => {
    const filtered = scoped.filter(
      r =>
        (status === 'all' || r.status === status) &&
        (kind === 'all' || r.open.some(f => f.kind === kind)) &&
        matches(q, `${r.rep.firstName} ${r.rep.lastName}`, r.rep.region, ...r.flags.map(f => f.title), ...r.flags.map(f => f.detail))
    );
    if (sort === 'name') return [...filtered].sort((a, b) => a.rep.firstName.localeCompare(b.rep.firstName));
    if (sort === 'checkin')
      return [...filtered].sort((a, b) => (lastCheckIn(team, a.rep.id)?.at ?? '').localeCompare(lastCheckIn(team, b.rep.id)?.at ?? ''));
    return sortReports(filtered);
  }, [scoped, status, kind, q, sort, team]);

  const count = (s: RepStatus) => scoped.filter(r => r.status === s).length;
  const kinds = (Object.keys(KIND_LABEL) as FlagKind[]).filter(k => scoped.some(r => r.open.some(f => f.kind === k)));
  const selected = reports.find(r => r.rep.id === openRep);

  return (
    <Page>
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title={isManager ? 'My team' : 'Teams'}
        subtitle="Who needs help, and why. Worked out from what your team logs and plans, using rules you can see in Settings. Reps see their own flags too."
      />

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Needs help" value={count('help')} tone="red" active={status === 'help'} onClick={() => setStatus(status === 'help' ? 'all' : 'help')} />
        <Stat label="Keep an eye" value={count('watch')} tone="amber" active={status === 'watch'} onClick={() => setStatus(status === 'watch' ? 'all' : 'watch')} />
        <Stat label="On track" value={count('good')} tone="green" active={status === 'good'} onClick={() => setStatus(status === 'good' ? 'all' : 'good')} />
      </div>

      <Toolbar
        search={{ value: q, onChange: setQ, placeholder: 'Search rep or reason' }}
        filters={[
          { id: 'status', allLabel: 'Any status', value: status, onChange: v => setStatus(v as typeof status), options: [{ value: 'help', label: 'Needs help', count: count('help') }, { value: 'watch', label: 'Keep an eye', count: count('watch') }, { value: 'good', label: 'On track', count: count('good') }] },
          { id: 'kind', allLabel: 'Any reason', value: kind, onChange: v => setKind(v as typeof kind), options: kinds.map(k => ({ value: k, label: KIND_LABEL[k], count: scoped.filter(r => r.open.some(f => f.kind === k)).length })) },
          ...(!isManager && managers.length > 1 ? [{ id: 'mgr', allLabel: 'All managers', value: mgr, onChange: setMgr, options: managers.map(m => ({ value: m.id, label: `${m.firstName} ${m.lastName}`, count: reports.filter(r => r.rep.managerId === m.id).length })) }] : [])
        ]}
        sort={{ value: sort, onChange: v => setSort(v as Sort), options: [{ value: 'attention', label: 'Needs help first' }, { value: 'checkin', label: 'Longest since check-in' }, { value: 'name', label: 'Name (A–Z)' }] }}
        count={plural(list.length, 'rep')}
        onClear={() => {
          setQ('');
          setStatus('all');
          setKind('all');
          setMgr('all');
        }}
      />

      {list.length === 0 ? (
        <EmptyState title={reports.length ? 'No reps match' : 'No reps on your team yet'} hint={reports.length ? 'Try clearing the filters.' : undefined} />
      ) : (
        <Panel className="divide-y divide-slate-200 overflow-hidden">
          {list.map(r => (
            <RepRow key={r.rep.id} report={r} lastAt={lastCheckIn(team, r.rep.id)?.at} managerName={!isManager ? users.find(u => u.id === r.rep.managerId)?.firstName : undefined} onOpen={() => setOpenRep(r.rep.id)} />
          ))}
        </Panel>
      )}

      {selected && <RepPanel {...props} report={selected} onClose={() => setOpenRep(null)} />}
    </Page>
  );
};

const RepRow: React.FC<{ report: RepReport; lastAt?: string; managerName?: string; onOpen: () => void }> = ({ report: r, lastAt, managerName, onOpen }) => {
  const shown = r.open.slice(0, 3);
  const more = r.open.length - shown.length;
  const handled = r.flags.filter(f => f.handled);
  const since = lastAt ? formatRelative(lastAt) : null;
  const daysSince = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : null;
  return (
    <button type="button" onClick={onOpen} className="flex w-full cursor-pointer items-start gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[14px] font-bold text-slate-700">{initials(r.rep.firstName, r.rep.lastName)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[16px] font-bold text-slate-900">
            {r.rep.firstName} {r.rep.lastName}
          </span>
          <StatusBadge status={r.status} />
          {r.rep.role === 'new_rep' && <Badge tone="teal">New starter</Badge>}
          <span className="text-[13px] text-slate-500">
            {r.rep.region}
            {managerName ? ` · ${managerName}'s team` : ''}
          </span>
        </span>
        {shown.length > 0 && (
          <span className="mt-1.5 block space-y-1">
            {shown.map(f => (
              <span key={f.id} className="flex items-start gap-2 text-[14px] text-slate-700">
                <span className={`mt-0.5 ${flagColour(f)}`}>
                  <FlagGlyph flag={f} />
                </span>
                <span className="min-w-0">{f.title}</span>
              </span>
            ))}
            {more > 0 && <span className="block pl-6 text-[13px] text-slate-500">and {plural(more, 'more thing')}</span>}
          </span>
        )}
        {shown.length === 0 && r.wins.length > 0 && (
          <span className="mt-1.5 flex items-start gap-2 text-[14px] text-slate-700">
            <Trophy className="mt-0.5 h-4 w-4 text-emerald-600" />
            {r.wins.slice(0, 2).join(' · ')}
          </span>
        )}
        {shown.length === 0 && r.wins.length === 0 && <span className="mt-1.5 block text-[14px] text-slate-500">Nothing flagged.</span>}
        {handled.length > 0 && (
          <span className="mt-1 block pl-6 text-[13px] text-slate-500">
            Handled: {handled.map(f => f.title.split(':')[0]).slice(0, 2).join('; ')}
            {handled.length > 2 ? ` and ${handled.length - 2} more` : ''}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2 self-center">
        <span className={`hidden text-right text-[13px] sm:block ${daysSince !== null && daysSince >= 10 ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
          {since ? (
            <>
              Last check-in
              <br />
              {since}
            </>
          ) : (
            'No check-in yet'
          )}
        </span>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </span>
    </button>
  );
};
