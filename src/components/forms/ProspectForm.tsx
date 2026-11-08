// "Add New Prospect" (and "Add Client") — the one dealership form used
// everywhere: Bench, Prospect Pool, Client Portfolio and My Plan.
// Includes Open Radar, referral trail, Single Rooftop / Dealer Group with
// placeholder rooftops, duplicate checks and a live distance band.

import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, Building2, Loader2, MapPin, Radar, UserRoundPlus } from 'lucide-react';
import { DealerGroup, Dealership, ProductCatalogItem, ReferralInfo, User } from '../../types/crm';
import { approximateCoords, findDuplicateDealerships, makeDealership, newRecordId, US_STATES } from '../../utils/dealershipFactory';
import { getCurrentLocation, RadarResult, searchNearbyDealerships } from '../../utils/radar';
import { distanceBand, milesBetween } from '../../features/myplan/engine/geo';
import { Field, FormShell, inputCls } from './FormShell';
import { ROLE_LABEL } from '../views/PeopleAdminPanel';

export interface ProspectFormResult {
  dealership: Dealership;
  newGroup?: DealerGroup;
  updatedGroup?: DealerGroup;
  placeholders: Dealership[];
}

const RELATIONSHIPS = ['Vendor / supplier', 'Existing client', 'Dealer group contact', 'Industry contact', 'Friend / family', 'Other'];

export const ProspectForm: React.FC<{
  mode?: 'prospect' | 'client';
  currentUser: User;
  users: User[];
  dealerships: Dealership[];
  groups: DealerGroup[];
  catalog?: ProductCatalogItem[];
  onCancel: () => void;
  onSave: (r: ProspectFormResult) => void;
  onOpenExisting?: (d: Dealership) => void;
  /** Start straight in Open Radar. */
  startWithRadar?: boolean;
}> = ({ mode = 'prospect', currentUser, users, dealerships, groups, catalog = [], onCancel, onSave, onOpenExisting, startWithRadar }) => {
  const [f, setF] = useState({
    dealershipName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    franchiseType: 'Franchise' as 'Franchise' | 'Independent',
    brands: '',
    usedCarsOnLot: '',
    website: '',
    internalReferral: '',
    externalReferral: '',
    externalCompany: '',
    relationship: '',
    structure: 'single' as 'single' | 'group',
    groupChoice: '' as string, // existing group id or 'new'
    groupName: '',
    groupDomain: '',
    rooftops: '2',
    hqCity: '',
    hqState: '',
    groupDecisionMaker: '',
    isHq: true,
    signedProducts: [] as string[]
  });
  const [radarCoords, setRadarCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showRadar, setShowRadar] = useState(!!startWithRadar);
  const [radarFrom, setRadarFrom] = useState<'home' | 'current'>('home');
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const set = (p: Partial<typeof f>) => setF(prev => ({ ...prev, ...p }));

  const located = useMemo(() => {
    if (radarCoords) return { coords: radarCoords, approximate: false };
    if (!f.zipCode && !f.city) return null;
    return approximateCoords(f.zipCode, f.city, f.state, dealerships);
  }, [radarCoords, f.zipCode, f.city, f.state, dealerships]);
  const miles = located ? milesBetween(currentUser.homeCoords, located.coords) : undefined;
  const band = miles !== undefined ? distanceBand(miles) : undefined;
  const dupes = f.dealershipName.trim() ? findDuplicateDealerships(f, dealerships) : [];
  const activeUsers = users.filter(u => u.active !== false);
  const isClient = mode === 'client';
  const valid =
    f.dealershipName.trim() &&
    f.zipCode.trim() &&
    f.city.trim() &&
    f.state &&
    (f.structure === 'single' || (f.groupChoice && (f.groupChoice !== 'new' || f.groupName.trim()))) &&
    (!isClient || f.signedProducts.length > 0);
  const stillNeeded = [
    !f.dealershipName.trim() && 'name',
    !f.city.trim() && 'city',
    !f.state && 'state',
    !f.zipCode.trim() && 'ZIP',
    f.structure === 'group' && !f.groupChoice && 'which group',
    f.structure === 'group' && f.groupChoice === 'new' && !f.groupName.trim() && 'group name',
    isClient && f.signedProducts.length === 0 && 'signed products'
  ].filter(Boolean) as string[];

  const useRadarResult = (r: RadarResult) => {
    setF(prev => ({
      ...prev,
      dealershipName: r.dealershipName,
      phone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      zipCode: r.zipCode,
      website: r.website,
      franchiseType: r.franchiseType,
      brands: r.franchiseBrands.join(', ')
    }));
    setRadarCoords(r.coordinates);
    setShowRadar(false);
  };

  const save = () => {
    if (!valid || !located) return;
    if (dupes.length && !confirmDuplicate) {
      setConfirmDuplicate(true);
      return;
    }
    const now = new Date().toISOString();
    const internal = activeUsers.find(u => u.id === f.internalReferral);
    const referral: ReferralInfo | undefined =
      internal || f.externalReferral.trim()
        ? {
            internalUserId: internal?.id,
            internalName: internal ? `${internal.firstName} ${internal.lastName}` : undefined,
            externalName: f.externalReferral.trim() || undefined,
            externalCompany: f.externalCompany.trim() || undefined,
            relationship: f.relationship || undefined,
            recordedAt: now,
            recordedByUserId: currentUser.id,
            recordedByName: `${currentUser.firstName} ${currentUser.lastName}`
          }
        : undefined;

    let newGroup: DealerGroup | undefined;
    let updatedGroup: DealerGroup | undefined;
    let group: DealerGroup | undefined;
    const rooftopTotal = Math.max(1, Number(f.rooftops) || 1);
    if (f.structure === 'group') {
      if (f.groupChoice === 'new') {
        newGroup = {
          id: newRecordId('grp'),
          name: f.groupName.trim(),
          hqAddress: f.isHq ? f.address.trim() : '',
          hqCity: f.isHq ? f.city.trim() : f.hqCity.trim(),
          hqState: f.isHq ? f.state : f.hqState,
          hqZip: f.isHq ? f.zipCode.trim() : '',
          mainDecisionMaker: f.groupDecisionMaker.trim() || 'To be confirmed',
          mainPhone: f.isHq ? f.phone.trim() : '',
          notes: `Added by ${currentUser.firstName} ${currentUser.lastName}`,
          domain: f.groupDomain.trim() || undefined,
          rooftopCount: rooftopTotal,
          groupAccountOwnerId: null
        };
        group = newGroup;
      } else {
        group = groups.find(g => g.id === f.groupChoice);
        if (group) updatedGroup = { ...group, rooftopCount: (group.rooftopCount ?? dealerships.filter(d => d.groupId === group!.id).length) + 1 };
      }
    }

    const base = {
      dealershipName: f.dealershipName.trim(),
      phone: f.phone.trim(),
      address: f.address.trim(),
      city: f.city.trim(),
      state: f.state,
      zipCode: f.zipCode.trim(),
      coordinates: located.coords,
      locationApproximate: located.approximate,
      franchiseType: f.franchiseType,
      franchiseBrands: f.franchiseType === 'Franchise' ? f.brands.split(',').map(b => b.trim()).filter(Boolean) : [],
      usedCarsOnLot: Number(f.usedCarsOnLot) || 0,
      website: f.website.trim() || undefined,
      referral,
      source: (radarCoords ? 'Radar' : referral ? 'Referral' : 'Manual Search') as Dealership['source'],
      discoveredVia: (radarCoords ? 'Radar' : 'Manual') as Dealership['discoveredVia'],
      dealershipType: (f.structure === 'group' ? 'Dealer Group' : 'Standalone') as Dealership['dealershipType'],
      groupId: group?.id ?? null,
      groupName: group?.name,
      rooftopCount: f.structure === 'group' ? updatedGroup?.rooftopCount ?? rooftopTotal : 1,
      stage: (isClient ? 'Client' : 'Claimed') as Dealership['stage'],
      signedProducts: isClient ? f.signedProducts : [],
      clientHealthScore: isClient ? 80 : undefined
    };
    const dealership = makeDealership(base, currentUser);

    // A new group: placeholder rooftops for the rest, to fill in later.
    const placeholders: Dealership[] =
      newGroup && rooftopTotal > 1
        ? Array.from({ length: rooftopTotal - 1 }, (_, i) =>
            makeDealership(
              {
                ...base,
                dealershipName: `${newGroup!.name} — Rooftop ${i + 2} (details needed)`,
                phone: '',
                address: '',
                website: undefined,
                referral: undefined,
                isPlaceholder: true,
                locationApproximate: true,
                stage: 'Claimed',
                signedProducts: [],
                clientHealthScore: undefined
              },
              currentUser
            )
          )
        : [];

    onSave({ dealership, newGroup, updatedGroup, placeholders });
  };

  return (
    <FormShell
      title={showRadar ? 'Open Radar — dealerships near you' : isClient ? 'Add New Client' : 'Add New Prospect'}
      icon={showRadar ? <Radar className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
      onClose={onCancel}
      wide={showRadar}
      footer={
        showRadar ? (
          <button type="button" onClick={() => setShowRadar(false)} className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-5 text-[16px] font-semibold text-slate-700 hover:bg-slate-200">
            <ArrowLeft className="h-5 w-5" /> Back to the form
          </button>
        ) : (
          <>
            {stillNeeded.length > 0 && <span className="mr-auto text-xs font-medium text-slate-500">Still needed: {stillNeeded.join(', ')}</span>}
            <button type="button" onClick={onCancel} className="min-h-[48px] rounded-xl px-5 text-[16px] font-semibold text-slate-600 hover:bg-slate-200">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={!valid || !located} className="min-h-[48px] rounded-xl bg-blue-600 px-6 text-[16px] font-bold text-white shadow hover:bg-blue-700 disabled:bg-slate-300">
              {confirmDuplicate ? 'Save anyway' : isClient ? 'Save Client' : 'Save Prospect'}
            </button>
          </>
        )
      }
    >
      {showRadar ? (
        <RadarPanel from={radarFrom} setFrom={setRadarFrom} currentUser={currentUser} dealerships={dealerships} onPick={useRadarResult} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-[16px] font-bold text-blue-950">Need a prospect?</div>
              <div className="text-[14px] text-blue-800">Find nearby dealerships that aren’t in the CRM yet, and fill this form in one tap.</div>
            </div>
            <select className={`${inputCls} sm:w-44`} value={radarFrom} onChange={e => setRadarFrom(e.target.value as 'home' | 'current')} aria-label="Search from">
              <option value="home">Home ZIP</option>
              <option value="current">Current location</option>
            </select>
            <button type="button" onClick={() => setShowRadar(true)} className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-[16px] font-bold text-white hover:bg-blue-700">
              <Radar className="h-5 w-5" /> Open Radar
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dealership Name" required className="sm:col-span-2">
              <input className={inputCls} value={f.dealershipName} onChange={e => set({ dealershipName: e.target.value })} />
            </Field>
            <Field label="Main Phone">
              <input className={inputCls} type="tel" inputMode="tel" placeholder="(555) 555-5555" value={f.phone} onChange={e => set({ phone: e.target.value })} />
            </Field>
            <Field label="Street Address">
              <input className={inputCls} value={f.address} onChange={e => set({ address: e.target.value })} />
            </Field>
            <Field label="City" required>
              <input className={inputCls} value={f.city} onChange={e => { set({ city: e.target.value }); setRadarCoords(null); }} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="State" required>
                <select className={inputCls} value={f.state} onChange={e => { set({ state: e.target.value }); setRadarCoords(null); }}>
                  <option value="">—</option>
                  {US_STATES.map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="ZIP Code" required>
                <input className={inputCls} inputMode="numeric" maxLength={10} value={f.zipCode} onChange={e => { set({ zipCode: e.target.value }); setRadarCoords(null); }} />
              </Field>
            </div>
            {located && band && miles !== undefined && (
              <div className="flex flex-wrap items-center gap-2 text-[15px] sm:col-span-2">
                <MapPin className="h-5 w-5 text-slate-500" />
                <span className={`rounded-full border px-2.5 py-0.5 font-semibold ${band === 'home' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : band === 'edge' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-rose-300 bg-rose-50 text-rose-800'}`}>
                  {band === 'home' ? '🟢' : band === 'edge' ? '🟡' : '🔴'} {Math.round(miles)} mi from your home{band === 'edge' ? ' · edge of region' : band === 'out_of_town' ? ' · out of town' : ''}
                </span>
                {located.approximate && <span className="text-slate-500">(approximate until the address is checked)</span>}
              </div>
            )}
            <Field label="Dealership Type">
              <select className={inputCls} value={f.franchiseType} onChange={e => set({ franchiseType: e.target.value as 'Franchise' | 'Independent' })}>
                <option>Franchise</option>
                <option>Independent</option>
              </select>
            </Field>
            <Field label="Used Cars on Lot">
              <input className={inputCls} inputMode="numeric" placeholder="e.g. 75" value={f.usedCarsOnLot} onChange={e => set({ usedCarsOnLot: e.target.value })} />
            </Field>
            {f.franchiseType === 'Franchise' && (
              <Field label="Brand(s)" hint="Separate with commas, e.g. Ford, Lincoln" className="sm:col-span-2">
                <input className={inputCls} value={f.brands} onChange={e => set({ brands: e.target.value })} />
              </Field>
            )}
            <Field label="Website Domain" className="sm:col-span-2">
              <input className={inputCls} placeholder="www.dealership.com" value={f.website} onChange={e => set({ website: e.target.value })} />
            </Field>
          </div>

          {isClient && catalog.length > 0 && (
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-2 text-[16px] font-bold text-slate-900">
                Products they’ve signed up for <span className="text-rose-600">*</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {catalog
                  .filter(p => p.isActive)
                  .map(p => {
                    const on = f.signedProducts.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set({ signedProducts: on ? f.signedProducts.filter(x => x !== p.id) : [...f.signedProducts, p.id] })}
                        className={`min-h-[44px] rounded-xl border-2 px-3 text-[15px] font-semibold ${on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4">
            <div className="mb-3 flex items-center gap-2 text-[16px] font-bold text-slate-900">
              <UserRoundPlus className="h-5 w-5 text-blue-600" /> Referral Information (Optional)
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Internal Referral">
                <select className={inputCls} value={f.internalReferral} onChange={e => set({ internalReferral: e.target.value })}>
                  <option value="">-- None --</option>
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                      {` — ${u.title ?? ROLE_LABEL[u.role]}`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="External Referral">
                <input className={inputCls} placeholder="e.g. John Doe" value={f.externalReferral} onChange={e => set({ externalReferral: e.target.value })} />
              </Field>
              {f.externalReferral.trim() && (
                <>
                  <Field label="Their company">
                    <input className={inputCls} value={f.externalCompany} onChange={e => set({ externalCompany: e.target.value })} />
                  </Field>
                  <Field label="Relationship">
                    <select className={inputCls} value={f.relationship} onChange={e => set({ relationship: e.target.value })}>
                      <option value="">—</option>
                      {RELATIONSHIPS.map(r => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <p className="mt-2 text-[13px] text-slate-500">Saved on the dealership’s history so there’s always a trail of who introduced it.</p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <Field label="Structure Type">
              <select className={inputCls} value={f.structure} onChange={e => set({ structure: e.target.value as 'single' | 'group' })}>
                <option value="single">Single Rooftop</option>
                <option value="group">Dealer Group</option>
              </select>
            </Field>
            {f.structure === 'group' && (
              <div className="mt-3 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <Field label="Which group?" required>
                  <select className={inputCls} value={f.groupChoice} onChange={e => set({ groupChoice: e.target.value })}>
                    <option value="">-- Choose --</option>
                    <option value="new">+ A new dealer group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.hqCity}, {g.hqState})
                      </option>
                    ))}
                  </select>
                </Field>
                {f.groupChoice === 'new' && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Group Name" required>
                      <input className={inputCls} value={f.groupName} onChange={e => set({ groupName: e.target.value })} />
                    </Field>
                    <Field label="Group Domain">
                      <input className={inputCls} placeholder="www.group.com" value={f.groupDomain} onChange={e => set({ groupDomain: e.target.value })} />
                    </Field>
                    <Field label="# of Rooftops">
                      <input className={inputCls} inputMode="numeric" value={f.rooftops} onChange={e => set({ rooftops: e.target.value })} />
                    </Field>
                    <Field label="Group decision maker" className="sm:col-span-3">
                      <input className={inputCls} placeholder="Name and title, if known" value={f.groupDecisionMaker} onChange={e => set({ groupDecisionMaker: e.target.value })} />
                    </Field>
                    <label className="flex min-h-[48px] items-center gap-3 sm:col-span-3">
                      <input type="checkbox" className="h-6 w-6 accent-blue-600" checked={f.isHq} onChange={e => set({ isHq: e.target.checked })} />
                      <span className="text-[16px] text-slate-800">This rooftop is the group’s head office</span>
                    </label>
                    {!f.isHq && (
                      <>
                        <Field label="Head office city">
                          <input className={inputCls} value={f.hqCity} onChange={e => set({ hqCity: e.target.value })} />
                        </Field>
                        <Field label="Head office state">
                          <select className={inputCls} value={f.hqState} onChange={e => set({ hqState: e.target.value })}>
                            <option value="">—</option>
                            {US_STATES.map(s => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </Field>
                      </>
                    )}
                    {Number(f.rooftops) > 1 && (
                      <p className="text-[14px] text-slate-600 sm:col-span-3">
                        We’ll add {Number(f.rooftops) - 1} placeholder rooftop{Number(f.rooftops) - 1 === 1 ? '' : 's'} to your list, marked “details needed”, so you can fill them in later.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {confirmDuplicate && dupes.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <span>
                  Looks like this may already be in the CRM: {dupes.map(d => `${d.dealershipName} (${d.city}, ${d.state} · ${d.stage})`).join('; ')}.
                </span>
              </div>
              {onOpenExisting && (
                <button type="button" onClick={() => onOpenExisting(dupes[0])} className="min-h-[44px] rounded-xl border border-amber-400 bg-white px-4 font-semibold">
                  Open the existing one
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </FormShell>
  );
};

const RadarPanel: React.FC<{
  from: 'home' | 'current';
  setFrom: (f: 'home' | 'current') => void;
  currentUser: User;
  dealerships: Dealership[];
  onPick: (r: RadarResult) => void;
}> = ({ from, setFrom, currentUser, dealerships, onPick }) => {
  const [radius, setRadius] = useState(25);
  const [results, setResults] = useState<RadarResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState<string>('');

  const search = async (which = from, r = radius) => {
    setLoading(true);
    setError(null);
    try {
      let at = currentUser.homeCoords;
      if (which === 'current') {
        try {
          at = await getCurrentLocation();
          setOrigin('your current location');
        } catch (e) {
          setError(`${(e as Error).message} Showing results around your home ZIP instead.`);
          setOrigin(`home ZIP ${currentUser.homeZipCode}`);
        }
      } else setOrigin(`home ZIP ${currentUser.homeZipCode}`);
      setResults(await searchNearbyDealerships(at, dealerships, r));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(['home', 'current'] as const).map(w => (
          <button
            key={w}
            type="button"
            onClick={() => {
              setFrom(w);
              void search(w);
            }}
            className={`min-h-[48px] rounded-xl border-2 px-4 text-[16px] font-semibold ${from === w ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 bg-white'}`}
          >
            {w === 'home' ? 'From my home ZIP' : 'From where I am now'}
          </button>
        ))}
        <select
          aria-label="Search radius"
          className={`${inputCls} w-auto`}
          value={radius}
          onChange={e => {
            setRadius(Number(e.target.value));
            void search(from, Number(e.target.value));
          }}
        >
          {[10, 25, 60].map(m => (
            <option key={m} value={m}>
              Within {m} miles
            </option>
          ))}
        </select>
      </div>
      {error && <div className="rounded-xl bg-amber-50 p-3 text-[15px] text-amber-900">{error}</div>}
      <p className="text-[14px] text-slate-500">
        Demo results near {origin || '…'} — only dealerships not already in the CRM. The live version uses Google Maps.
      </p>
      {loading && (
        <div className="flex items-center gap-2 py-6 text-[16px] text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Searching nearby…
        </div>
      )}
      {!loading && results?.length === 0 && <p className="text-[16px] text-slate-600">No new dealerships found. Try a wider radius.</p>}
      {!loading && (
        <div className="space-y-2">
          {results?.map(r => (
            <div key={r.placeId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="min-w-0 flex-1">
                <div className="text-[17px] font-bold text-slate-900">{r.dealershipName}</div>
                <div className="text-[14px] text-slate-600">
                  {r.address}, {r.city}, {r.state} {r.zipCode} · {r.phone}
                </div>
                <div className="text-[14px] text-slate-500">
                  {r.miles} mi away · {r.franchiseType}
                  {r.franchiseBrands.length ? ` (${r.franchiseBrands.join(', ')})` : ''}
                </div>
              </div>
              <button type="button" onClick={() => onPick(r)} className="min-h-[48px] rounded-xl bg-blue-600 px-4 text-[16px] font-bold text-white hover:bg-blue-700">
                Add
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
