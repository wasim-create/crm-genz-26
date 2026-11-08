import React, { useState } from 'react';
import { Dealership, User, ProductCatalogItem, InventoryTopup, UpsellOpportunity } from '../../types/crm';
import { formatUSDate } from '../../utils/territory';
import {
  Users2,
  KeyRound,
  TrendingUp,
  AlertTriangle,
  Plus,
  Calendar,
  CheckCircle2,
  Car,
  PackageCheck,
  Search,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Check
} from 'lucide-react';

interface ClientPortfolioViewProps {
  dealerships: Dealership[];
  catalog: ProductCatalogItem[];
  currentUser: User;
  onOpenDealership: (dealership: Dealership) => void;
  onLogKeyfetchTopup: (dealershipId: string, quantity: number, notes?: string) => void;
  onUpdateUpsell: (dealershipId: string, upsell: UpsellOpportunity) => void;
  onCreateUpsell: (dealershipId: string, productId: string, nextStep: string) => void;
  /** Add a client directly (without going through the prospect stages). */
  onAddClient?: () => void;
  allUsers?: User[];
}

export const ClientPortfolioView: React.FC<ClientPortfolioViewProps> = ({
  dealerships,
  catalog,
  currentUser,
  onOpenDealership,
  onLogKeyfetchTopup,
  onUpdateUpsell,
  onCreateUpsell,
  onAddClient,
  allUsers = []
}) => {
  const repName = (id: string | null) => {
    if (!id) return '—';
    const u = allUsers.find(x => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : id;
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [topupModalDeal, setTopupModalDeal] = useState<Dealership | null>(null);
  const [topupQty, setTopupQty] = useState(250);
  const [topupNotes, setTopupNotes] = useState('Routine showroom key tag top-up');
  
  // Upsell modal state
  const [upsellModalDeal, setUpsellModalDeal] = useState<Dealership | null>(null);
  const [upsellProductId, setUpsellProductId] = useState('prod_10'); // Ceramic Pro by default
  const [upsellNextStep, setUpsellNextStep] = useState('Schedule presentation of test kit');

  // Filter won clients
  const clients = dealerships.filter(d => d.stage === 'Client' || d.stage === 'Onboarding');

  const filteredClients = clients.filter(c => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return c.dealershipName.toLowerCase().includes(q) || c.city.toLowerCase().includes(q);
  });

  const totalClients = clients.length;
  const keyfetchClientsCount = clients.filter(c => c.signedProducts?.includes('prod_3')).length;
  const totalTopupUnits = clients.reduce((acc, c) => acc + (c.topups || []).reduce((s, t) => s + t.quantity, 0), 0);
  const activeUpsellsCount = clients.reduce((acc, c) => acc + (c.upsells || []).filter(u => u.stage !== 'Won' && u.stage !== 'Lost').length, 0);

  const handleExecuteTopup = () => {
    if (!topupModalDeal) return;
    onLogKeyfetchTopup(topupModalDeal.id, topupQty, topupNotes);
    setTopupModalDeal(null);
  };

  const handleExecuteCreateUpsell = () => {
    if (!upsellModalDeal) return;
    onCreateUpsell(upsellModalDeal.id, upsellProductId, upsellNextStep);
    setUpsellModalDeal(null);
  };

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards (Strictly Non-Monetary) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Client Book</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalClients} Rooftops</div>
          <span className="text-[11px] text-emerald-600 font-semibold">100% Protected Attribution</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Keyfetch Hardware Clients</span>
          <div className="text-2xl font-bold text-blue-600 mt-1">{keyfetchClientsCount} Lots</div>
          <span className="text-[11px] text-slate-500 font-mono">{totalTopupUnits.toLocaleString()} units topped up</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Catalog Upsells</span>
          <div className="text-2xl font-bold text-purple-600 mt-1">{activeUpsellsCount} Mini-Opps</div>
          <span className="text-[11px] text-purple-700 font-semibold">Ceramic Pro, VSC & GAP</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-bold text-slate-500 uppercase">At-Risk Clients</span>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {clients.filter(c => (c.clientHealthScore || 100) < 70).length}
          </div>
          <span className="text-[11px] text-slate-500">Low touch (&gt;30d) or cooling temp</span>
        </div>
      </div>

      {/* Search Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users2 className="w-5 h-5 text-blue-600" />
            <span>Client Portfolio & Product Servicing</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Keyfetch physical unit top-ups, product penetration matrices, and upsell mini-opportunities.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {onAddClient && (
          <button
            type="button"
            onClick={onAddClient}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer"
          >
            + Add client
          </button>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search active clients..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 w-full"
          />
        </div>
        </div>
      </div>

      {/* Client List with Product Matrix */}
      <div className="grid grid-cols-1 gap-4">
        {filteredClients.map(client => {
          const hasKeyfetch = client.signedProducts?.includes('prod_3');
          const clientTopups = client.topups || [];
          const clientUpsells = client.upsells || [];
          
          // Products not yet signed (candidates for upselling)
          const availableForUpsell = catalog.filter(p => !client.signedProducts?.includes(p.id) && p.isActive);

          return (
            <div
              key={client.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900">{client.dealershipName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active Client
                    </span>
                    {client.groupName && (
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-bold">
                        {client.groupName}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {client.city}, {client.state} • {client.usedCarsOnLot} used cars • Rep: <strong>{repName(client.originRepId)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenDealership(client)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    View Record
                  </button>
                  {availableForUpsell.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setUpsellModalDeal(client);
                        setUpsellProductId(availableForUpsell[0]?.id || 'prod_10');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 cursor-pointer"
                    >
                      + Pitch Upsell
                    </button>
                  )}
                </div>
              </div>

              {/* 3-Column Servicing Layout: Signed Products, Keyfetch Top-ups, Active Upsells */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                {/* 1. Signed Products Matrix */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                    Contracted Products ({client.signedProducts?.length || 0})
                  </span>
                  <div className="space-y-1.5">
                    {client.signedProducts?.map(pid => {
                      const prod = catalog.find(p => p.id === pid);
                      return (
                        <div key={pid} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200/80">
                          <span className="font-semibold text-slate-800 text-[11px]">{prod?.name || pid}</span>
                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Active
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Keyfetch Inventory Top-Ups (ONLY if client has Keyfetch!) */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                      Keyfetch Lot Top-Ups
                    </span>
                    {hasKeyfetch && (
                      <button
                        type="button"
                        onClick={() => setTopupModalDeal(client)}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Log Top-Up (+30 pts)</span>
                      </button>
                    )}
                  </div>

                  {hasKeyfetch ? (
                    <div className="space-y-1.5">
                      {clientTopups.length === 0 ? (
                        <p className="text-slate-400 text-[11px] py-2 italic">No top-ups logged yet.</p>
                      ) : (
                        clientTopups.map(tp => (
                          <div key={tp.id} className="bg-white p-2 rounded-lg border border-slate-200/80 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-blue-700 text-xs">
                                {tp.quantity} units
                              </span>
                              <span className="text-[10px] text-slate-400 block">{tp.date}</span>
                            </div>
                            <span className="text-[10px] text-slate-500 italic">By {tp.handledByName}</span>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="p-3 bg-white/60 rounded-lg text-center text-slate-400 text-[11px]">
                      Client does not have Keyfetch hardware.
                    </div>
                  )}
                </div>

                {/* 3. Upsell Mini-Opportunities */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                    Upsell Pipeline
                  </span>

                  {clientUpsells.length === 0 ? (
                    <p className="text-slate-400 text-[11px] py-2 italic">No active upsells being pitched.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {clientUpsells.map(up => (
                        <div key={up.id} className="bg-white p-2 rounded-lg border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-[11px]">{up.productName}</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              up.stage === 'Won' ? 'bg-emerald-100 text-emerald-800' :
                              up.stage === 'Pitched' ? 'bg-blue-100 text-blue-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {up.stage}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">Next: {up.nextStep}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Keyfetch Top-up Modal (Quantity ONLY, no prices) */}
      {topupModalDeal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-xs">
            <h3 className="font-bold text-sm text-slate-900">
              Log Keyfetch Top-Up for {topupModalDeal.dealershipName}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Physical Quantity (Units):</label>
                <input
                  type="number"
                  value={topupQty}
                  onChange={(e) => setTopupQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-xl font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Delivery Reference:</label>
                <textarea
                  value={topupNotes}
                  onChange={(e) => setTopupNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl h-16"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTopupModalDeal(null)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteTopup}
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 cursor-pointer"
              >
                Save Top-Up (+30 pts)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pitch Upsell Modal */}
      {upsellModalDeal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="font-bold text-sm text-slate-900">
              Pitch Catalog Upsell: {upsellModalDeal.dealershipName}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Select Catalog Product:</label>
                <select
                  value={upsellProductId}
                  onChange={(e) => setUpsellProductId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl bg-white font-medium"
                >
                  {catalog
                    .filter(p => !upsellModalDeal.signedProducts?.includes(p.id) && p.isActive)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isNewLaunch ? '(🔥 NEW Launch)' : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Next Pitch Step:</label>
                <input
                  type="text"
                  value={upsellNextStep}
                  onChange={(e) => setUpsellNextStep(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUpsellModalDeal(null)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCreateUpsell}
                className="px-4 py-1.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 cursor-pointer"
              >
                Create Mini-Opportunity
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
