// "Log a visit or call" from anywhere in My Plan: works out where you are (phone
// location, then today's plan) and offers it as one big button. Everything
// else is a tap or a quick search away. Every dealership shows what it is to
// us (Prospect, Signing up, Client…) and its street, so neighbours on the same
// road can't be mixed up.

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, LocateFixed, MapPin, Navigation, Plus, Search } from 'lucide-react';
import { ProspectForm } from '../../../components/forms/ProspectForm';
import { HiddenMatch, isMineActive, relationshipOf, RelTone, searchDealerships, streetLine } from '../engine/logSearch';
import type { Dealership } from '../../../types/crm';
import { isMessage } from '../engine/tasks';
import { format12h } from '../engine/time';
import { distanceText, LatLng, whereAmI, WhereCandidate } from '../engine/whereAmI';
import { Button, Card, Sheet } from './primitives';
import { useMyPlan } from './context';
import { buildLoggedSlot } from './logVisit';

type Locating = 'asking' | 'found' | 'off' | 'unavailable';

/** Phone location, asked once when the sheet opens. */
function usePosition(): { position: LatLng | null; accuracy?: number; status: Locating } {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | undefined>();
  const [status, setStatus] = useState<Locating>(() => (typeof navigator !== 'undefined' && navigator.geolocation ? 'asking' : 'unavailable'));
  useEffect(() => {
    if (!navigator.geolocation) return;
    let done = false;
    const timer = window.setTimeout(() => !done && setStatus('unavailable'), 8000);
    navigator.geolocation.getCurrentPosition(
      p => {
        done = true;
        window.clearTimeout(timer);
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAccuracy(p.coords.accuracy);
        setStatus('found');
      },
      err => {
        done = true;
        window.clearTimeout(timer);
        setStatus(err.code === err.PERMISSION_DENIED ? 'off' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
    return () => window.clearTimeout(timer);
  }, []);
  return { position, accuracy, status };
}

const TONE: Record<RelTone, string> = {
  blue: 'bg-blue-50 text-blue-800 ring-blue-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200'
};

/** "Client", "Prospect", "Signing up"…: what this dealership is to us. */
export const RelChip: React.FC<{ d: Pick<Dealership, 'stage'> }> = ({ d }) => {
  const r = relationshipOf(d);
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[13px] font-semibold ring-1 ring-inset ${TONE[r.tone]}`}>{r.label}</span>;
};

const HIDDEN_TEXT: Record<HiddenMatch['reason'], (h: HiddenMatch) => { note: string; action: string }> = {
  lost: () => ({ note: 'Marked lost or disqualified', action: 'Log it anyway' }),
  pool: () => ({ note: 'In the prospect pool', action: 'Claim it and log' }),
  teammate: h => ({ note: `${h.ownerName}’s account`, action: `Log it for ${h.ownerName?.split(' ')[0]}` }),
  unassigned: () => ({ note: 'Not assigned to anyone', action: 'Log it' })
};

export const LogPickerSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ctx = useMyPlan();
  const { user, today, dealerships, contacts, catalog, openSheet, users, groups, onSaveProspect, onClaimDealership } = ctx;
  const { position, accuracy, status } = usePosition();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);

  const mine = useMemo(() => dealerships.filter(d => isMineActive(d, user.id)), [dealerships, user.id]);
  const timings = ctx.layout(today).timings;
  const stops = ctx
    .daySlots(today)
    .filter(s => s.userId === user.id && s.status === 'planned' && s.target.kind === 'dealership' && !isMessage(s.how))
    .map(s => ({ slotId: s.id, dealershipId: s.target.id, start: timings[s.id]?.start ?? 0, end: timings[s.id]?.end ?? 0, how: s.how }));
  const recent = [...mine].sort((a, b) => (b.lastTouchpointDate ?? '').localeCompare(a.lastTouchpointDate ?? '')).map(d => d.id);
  const answer = whereAmI({ mine, stops, nowMin: ctx.nowMin, position, recent, accuracy });
  const choose = answer.alsoHere.length > 0;

  const log = (c: { dealership: Dealership; slotId?: string }, notes?: string) => {
    const planned = c.slotId ?? stops.find(s => s.dealershipId === c.dealership.id)?.slotId;
    if (planned) openSheet({ kind: 'outcome', slotId: planned });
    else {
      const draft = buildLoggedSlot(c.dealership, user.id, contacts, catalog, today, new Date(), ctx.repZone);
      openSheet({ kind: 'outcome', slotId: draft.id, draft: notes ? { ...draft, notes } : draft });
    }
  };
  const logHidden = (h: HiddenMatch) => {
    if (h.reason === 'pool') onClaimDealership(h.dealership);
    log({ dealership: h.dealership }, h.reason === 'teammate' ? `Logged for ${h.ownerName}` : undefined);
  };

  const found = searchDealerships(q, { all: dealerships, userId: user.id, contacts, groups, users });

  const why = (c: WhereCandidate) =>
    c.why === 'nearby'
      ? `You're here · ${distanceText(c.metres ?? 0)}`
      : c.why === 'now'
        ? `On your plan now${c.start !== undefined ? ` · ${format12h(c.start)}` : ''}`
        : c.why === 'next'
          ? `Next on your plan${c.start !== undefined ? ` · ${format12h(c.start)}` : ''}`
          : c.start !== undefined
            ? format12h(c.start)
            : c.metres !== undefined
              ? distanceText(c.metres)
              : c.dealership.lastTouchpointDate
                ? `Last contact ${new Date(`${c.dealership.lastTouchpointDate.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : '';

  const Row: React.FC<{ d: Dealership; extra?: string; onPick: () => void; note?: string; action?: string }> = ({ d, extra, onPick, note, action }) => (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-[64px] w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-100 active:bg-slate-200"
    >
      <MapPin className="mt-1 h-5 w-5 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="break-words text-[16px] font-semibold leading-snug text-slate-900">{d.dealershipName}</span>
          <RelChip d={d} />
        </span>
        <span className="block text-[14px] text-slate-600">
          {streetLine(d)}
          {extra ? ` · ${extra}` : ''}
        </span>
        {note && (
          <span className="mt-0.5 block text-[14px] text-slate-700">
            {note} · <span className="font-semibold text-blue-700">{action}</span>
          </span>
        )}
      </span>
    </button>
  );

  const BigChoice: React.FC<{ c: WhereCandidate; primary: boolean }> = ({ c, primary }) => (
    <Card className={`p-4 ${primary ? 'border-blue-200' : ''}`}>
      <div className="text-[14px] font-semibold text-blue-700">{why(c)}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        <span className="text-[20px] font-extrabold text-slate-900">{c.dealership.dealershipName}</span>
        <RelChip d={c.dealership} />
      </div>
      <div className="text-[15px] text-slate-600">{streetLine(c.dealership)}</div>
      <Button variant={primary ? 'primary' : 'secondary'} size="lg" block className="mt-3" onClick={() => log(c)}>
        {choose ? 'Log it here' : 'Log this visit'}
      </Button>
    </Card>
  );

  if (adding) {
    return (
      <Sheet title="Add a new dealership" onClose={onClose} onBack={() => setAdding(false)}>
        <ProspectForm
          currentUser={user}
          users={users}
          dealerships={dealerships}
          groups={groups}
          catalog={catalog}
          onCancel={() => setAdding(false)}
          onSave={r => {
            onSaveProspect(r);
            setAdding(false);
            log({ dealership: r.dealership });
          }}
          onOpenExisting={d => {
            setAdding(false);
            log({ dealership: d });
          }}
        />
      </Sheet>
    );
  }

  return (
    <Sheet title="Log a visit or call" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-[14px] text-slate-600" role="status">
          {status === 'asking' && (
            <>
              <LocateFixed className="h-4 w-4 animate-pulse text-blue-600" /> Finding where you are…
            </>
          )}
          {status === 'found' && (
            <>
              <Navigation className="h-4 w-4 text-emerald-600" />{' '}
              {answer.best?.why === 'nearby'
                ? choose
                  ? 'You’re near more than one of your dealerships.'
                  : 'Found you.'
                : (accuracy ?? 0) > 300
                  ? 'Your location isn’t precise enough right now, so here is your plan.'
                  : 'None of your dealerships is right here, so here is your plan.'}
            </>
          )}
          {status === 'off' && (
            <>
              <LocateFixed className="h-4 w-4 text-slate-400" /> Location is off for this app, so here is your plan. Turn it on to find the dealership you're at.
            </>
          )}
          {status === 'unavailable' && (
            <>
              <LocateFixed className="h-4 w-4 text-slate-400" /> Couldn't get your location, so here is your plan.
            </>
          )}
        </div>

        {choose && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[15px] text-amber-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> Pick the one you're at: check the name and street.
          </p>
        )}
        {answer.best && <BigChoice c={answer.best} primary={!choose} />}
        {answer.alsoHere.map(c => (
          <BigChoice key={c.dealership.id} c={c} primary={false} />
        ))}

        {answer.plan.length > 0 && (
          <section>
            <h3 className="mb-1 text-[15px] font-bold text-slate-900">{answer.best ? 'Somewhere else on today’s plan?' : 'Today’s plan'}</h3>
            <Card className="p-1">
              {answer.plan.map(c => (
                <Row key={c.slotId} d={c.dealership} extra={why(c)} onPick={() => log(c)} />
              ))}
            </Card>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-[15px] font-bold text-slate-900">{q.trim() ? 'Search results' : position ? 'Nearby' : 'Recently'}</h3>
          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Name, street, ZIP, contact or group"
              aria-label="Search dealerships by name, street, ZIP, contact or group"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-[16px]"
            />
          </label>
          {!(q.trim() && !found.mine.length && found.hidden.length > 0) && (
          <Card className="p-1">
            {q.trim()
              ? found.mine.map(d => <Row key={d.id} d={d} onPick={() => log({ dealership: d })} />)
              : answer.others.map(c => <Row key={c.dealership.id} d={c.dealership} extra={why(c)} onPick={() => log(c)} />)}
            {q.trim() && !found.mine.length && !found.hidden.length && (
              <div className="px-3 py-4 text-[15px] text-slate-600">No dealership matches “{q.trim()}”. Check the spelling, or add it below.</div>
            )}
            {!q.trim() && !answer.others.length && <div className="px-3 py-4 text-[15px] text-slate-600">Search above for any dealership.</div>}
          </Card>
          )}
          {q.trim() && found.hidden.length > 0 && (
            <div className="mt-3">
              <h4 className="mb-1 text-[14px] font-semibold text-slate-700">Not on your list</h4>
              <Card className="p-1">
                {found.hidden.map(h => {
                  const t = HIDDEN_TEXT[h.reason](h);
                  return <Row key={h.dealership.id} d={h.dealership} note={t.note} action={t.action} onPick={() => logHidden(h)} />;
                })}
              </Card>
            </div>
          )}
        </section>

        <Button variant="secondary" block icon={<Plus className="h-5 w-5" />} onClick={() => setAdding(true)}>
          Not in the list? Add a new dealership
        </Button>
      </div>
    </Sheet>
  );
};
