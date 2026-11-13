// "Log a visit" from anywhere in My Plan: works out where you are (phone
// location, then today's plan) and offers it as one big button. Everything
// else is a tap or a quick search away.

import React, { useEffect, useMemo, useState } from 'react';
import { LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import type { Dealership } from '../../../types/crm';
import { isMessage } from '../engine/tasks';
import { format12h } from '../engine/time';
import { distanceText, LatLng, whereAmI, WhereCandidate } from '../engine/whereAmI';
import { Button, Card, Sheet } from './primitives';
import { useMyPlan } from './context';
import { buildLoggedSlot } from './logVisit';

type Locating = 'asking' | 'found' | 'off' | 'unavailable';

/** Phone location, asked once when the sheet opens. */
function usePosition(): { position: LatLng | null; status: Locating } {
  const [position, setPosition] = useState<LatLng | null>(null);
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
  return { position, status };
}

export const LogPickerSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ctx = useMyPlan();
  const { user, today, now, dealerships, contacts, catalog, openSheet } = ctx;
  const { position, status } = usePosition();
  const [q, setQ] = useState('');

  const mine = useMemo(() => dealerships.filter(d => d.assignedRepId === user.id && !d.isPlaceholder && d.stage !== 'Lost' && d.stage !== 'Disqualified'), [dealerships, user.id]);
  const timings = ctx.layout(today).timings;
  const stops = ctx
    .daySlots(today)
    .filter(s => s.userId === user.id && s.status === 'planned' && s.target.kind === 'dealership' && !isMessage(s.how))
    .map(s => ({ slotId: s.id, dealershipId: s.target.id, start: timings[s.id]?.start ?? 0, end: timings[s.id]?.end ?? 0, how: s.how }));
  const recent = [...mine].sort((a, b) => (b.lastTouchpointDate ?? '').localeCompare(a.lastTouchpointDate ?? '')).map(d => d.id);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const answer = whereAmI({ mine, stops, nowMin, position, recent });

  const log = (c: { dealership: Dealership; slotId?: string }) => {
    const planned = c.slotId ?? stops.find(s => s.dealershipId === c.dealership.id)?.slotId;
    if (planned) openSheet({ kind: 'outcome', slotId: planned });
    else {
      const draft = buildLoggedSlot(c.dealership, user.id, contacts, catalog, today, new Date());
      openSheet({ kind: 'outcome', slotId: draft.id, draft });
    }
  };

  const found = q.trim()
    ? mine.filter(d => `${d.dealershipName} ${d.city ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];

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

  const Row: React.FC<{ c: WhereCandidate }> = ({ c }) => (
    <button
      type="button"
      onClick={() => log(c)}
      className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100 active:bg-slate-200"
    >
      <MapPin className="h-5 w-5 shrink-0 text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-slate-900">{c.dealership.dealershipName}</span>
        <span className="block text-[14px] text-slate-500">
          {c.dealership.city}
          {why(c) ? ` · ${why(c)}` : ''}
        </span>
      </span>
    </button>
  );

  return (
    <Sheet title="Log a visit" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-[14px] text-slate-600" role="status">
          {status === 'asking' && (
            <>
              <LocateFixed className="h-4 w-4 animate-pulse text-blue-600" /> Finding where you are…
            </>
          )}
          {status === 'found' && (
            <>
              <Navigation className="h-4 w-4 text-emerald-600" /> {answer.best?.why === 'nearby' ? 'Found you.' : 'None of your dealerships is right here, so here is your plan.'}
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

        {answer.best && (
          <Card className="border-blue-200 p-4">
            <div className="text-[14px] font-semibold text-blue-700">{why(answer.best)}</div>
            <div className="mt-0.5 text-[20px] font-extrabold text-slate-900">{answer.best.dealership.dealershipName}</div>
            <div className="text-[15px] text-slate-600">
              {answer.best.dealership.address ? `${answer.best.dealership.address}, ` : ''}
              {answer.best.dealership.city}
            </div>
            <Button variant="primary" size="lg" block className="mt-3" onClick={() => log(answer.best!)}>
              Log this visit
            </Button>
          </Card>
        )}

        {answer.plan.length > 0 && (
          <section>
            <h3 className="mb-1 text-[15px] font-bold text-slate-900">{answer.best ? 'Somewhere else on today’s plan?' : 'Today’s plan'}</h3>
            <Card className="p-1">
              {answer.plan.map(c => (
                <Row key={c.slotId} c={c} />
              ))}
            </Card>
          </section>
        )}

        <section>
          <h3 className="mb-1 text-[15px] font-bold text-slate-900">{position ? 'Nearby' : 'Recently'}</h3>
          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search your dealerships"
              aria-label="Search your dealerships"
              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-[16px]"
            />
          </label>
          <Card className="p-1">
            {(q.trim() ? found.map(d => ({ dealership: d, why: 'recent' as const })) : answer.others).map(c => (
              <Row key={c.dealership.id} c={c} />
            ))}
            {q.trim() && !found.length && <div className="px-3 py-4 text-[15px] text-slate-600">None of your dealerships match. Check the spelling, or add it from My prospects.</div>}
            {!q.trim() && !answer.others.length && <div className="px-3 py-4 text-[15px] text-slate-600">Search above for any of your dealerships.</div>}
          </Card>
        </section>
      </div>
    </Sheet>
  );
};
