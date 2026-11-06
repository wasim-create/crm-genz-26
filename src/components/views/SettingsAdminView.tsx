import React, { useState } from 'react';
import { ProductCatalogItem, User } from '../../types/crm';
import { PeopleAdminPanel } from './PeopleAdminPanel';
import {
  Settings,
  Database,
  FileSpreadsheet,
  HardDrive,
  Copy,
  CheckCircle2,
  RotateCcw,
  Plus,
  Sliders,
  ShieldAlert,
  Globe,
  Tag,
  Sparkles
} from 'lucide-react';

interface SettingsAdminViewProps {
  currentUser: User;
  allUsers: User[];
  catalog: ProductCatalogItem[];
  fiSystems: string[];
  storageMode: string;
  onResetDemoData: () => void;
  onUpdateCatalog: (catalog: ProductCatalogItem[]) => void;
  onUpdateFISystems: (systems: string[]) => void;
  onNavigateToGameRules?: () => void;
  onUpdateUsers?: (users: User[], message: string) => void;
  knownLocations?: { zipCode: string; city: string; state: string; coordinates: { lat: number; lng: number } }[];
}

export const SettingsAdminView: React.FC<SettingsAdminViewProps> = ({
  currentUser,
  allUsers,
  catalog,
  fiSystems,
  storageMode,
  onResetDemoData,
  onUpdateCatalog,
  onUpdateFISystems,
  onNavigateToGameRules,
  onUpdateUsers,
  knownLocations = []
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'catalog' | 'fi_systems' | 'territory' | 'people'>(currentUser.role === 'admin' ? 'people' : 'catalog');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('Ancillary');
  const [newProductDesc, setNewProductDesc] = useState('');
  const [newProductRequiresTopup, setNewProductRequiresTopup] = useState(false);
  const [newProductIsLaunch, setNewProductIsLaunch] = useState(false);

  // Territory & Planning Settings
  const [homeRadius, setHomeRadius] = useState<number>(60);
  const [edgeRadius, setEdgeRadius] = useState<number>(69);
  const [outOfTownRadius, setOutOfTownRadius] = useState<number>(70);
  const [requireTripApproval, setRequireTripApproval] = useState<boolean>(false);
  const [safetyMarginMin, setSafetyMarginMin] = useState<number>(10);
  const [savedTerritoryNotice, setSavedTerritoryNotice] = useState<boolean>(false);

  const canManageCatalog = ['owner', 'executive', 'manager'].includes(currentUser.role);

  const handleToggleProductStatus = (productId: string) => {
    const updated = catalog.map(p => {
      if (p.id === productId) {
        return { ...p, isActive: !p.isActive };
      }
      return p;
    });
    onUpdateCatalog(updated);
  };

  const handleCreateProduct = () => {
    if (!newProductName.trim()) return;

    const newProd: ProductCatalogItem = {
      id: `prod_${Date.now()}`,
      name: newProductName.trim(),
      category: newProductCategory,
      description: newProductDesc.trim() || 'Custom dealership program item.',
      isActive: true,
      requiresInventoryTopups: newProductRequiresTopup,
      isNewLaunch: newProductIsLaunch,
      dateAdded: new Date().toISOString().split('T')[0],
      addedBy: `${currentUser.firstName} ${currentUser.lastName}`
    };

    onUpdateCatalog([...catalog, newProd]);
    setShowAddProductModal(false);
    setNewProductName('');
    setNewProductDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-700" />
            <span>Settings & Open Product Catalog</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system parameters, manage active products across field checklists, and view data repositories.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetDemoData}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All Demo Seed Data</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2 text-xs font-bold">
        {[
          { id: 'catalog', label: `Product Catalog (${catalog.length} Products)` },
          { id: 'territory', label: 'Territory & Planning Rules' },
          { id: 'storage', label: 'Data Storage Adapters' },
          { id: 'fi_systems', label: 'F&I Systems List' },
          { id: 'people', label: `People (${allUsers.filter(u => u.active !== false).length})` }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-3 px-4 border-b-2 capitalize transition-colors cursor-pointer ${
              activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'people' && onUpdateUsers && (
        <PeopleAdminPanel currentUser={currentUser} users={allUsers} knownLocations={knownLocations} onChange={onUpdateUsers} />
      )}

      {/* TAB 1: PRODUCT CATALOG (Section 2 - strictly NO price fields) */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              The product catalog is <strong>OPEN</strong>. Managers and owners can add new programs at any time.
            </p>
            {canManageCatalog && (
              <button
                type="button"
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Catalog Product</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">#</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Requires Top-Ups?</th>
                  <th className="p-3">Launch Flag</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalog.map((prod, idx) => (
                  <tr key={prod.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <span className="font-bold text-slate-900 block">{prod.name}</span>
                      <span className="text-[11px] text-slate-500">{prod.description}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{prod.category || 'General'}</td>
                    <td className="p-3">
                      {prod.requiresInventoryTopups ? (
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[10px] border border-blue-200">
                          Yes (Keyfetch Tracking)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      {prod.isNewLaunch ? (
                        <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200 animate-pulse">
                          🔥 New Launch
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Standard</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        prod.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {prod.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {canManageCatalog && (
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(prod.id)}
                          className="text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                        >
                          {prod.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: STORAGE */}
      {activeTab === 'storage' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-xs">
          <h3 className="font-bold text-sm text-slate-900">Active Storage Repository</h3>
          <p className="text-slate-500">
            Current mode: <strong className="text-slate-800 font-mono">{storageMode}</strong>. Data synchronized locally with role-based privacy masking.
          </p>
        </div>
      )}

      {/* TAB 3: F&I SYSTEMS */}
      {activeTab === 'fi_systems' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
          <h3 className="font-bold text-sm text-slate-900">Dealership F&I / DMS Systems</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {fiSystems.map((s, i) => (
              <div key={i} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-medium">
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TERRITORY & PLANNING RULES */}
      {activeTab === 'territory' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Territory Distance Bands & Scheduling Policies</h3>
              <p className="text-slate-500 mt-0.5">
                Configure territorial thresholds measured from each sales representative's home ZIP code.
              </p>
            </div>
            {savedTerritoryNotice && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-xs">🟢 Home Region Radius</span>
                <span className="text-xs font-bold text-emerald-700">0–{homeRadius} mi</span>
              </div>
              <p className="text-[11px] text-emerald-800">Normal working territory. Standard travel calculations apply.</p>
              <input
                type="number"
                value={homeRadius}
                onChange={e => setHomeRadius(Number(e.target.value))}
                className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 text-xs">🟡 Edge Tolerance</span>
                <span className="text-xs font-bold text-amber-700">{homeRadius}–{edgeRadius} mi</span>
              </div>
              <p className="text-[11px] text-amber-800">10–15% buffer. Flagged gently as "Edge of region".</p>
              <input
                type="number"
                value={edgeRadius}
                onChange={e => setEdgeRadius(Number(e.target.value))}
                className="w-full bg-white border border-amber-300 rounded-lg p-2 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-xs">🔴 Out-of-Town Threshold</span>
                <span className="text-xs font-bold text-rose-700">{outOfTownRadius}+ mi</span>
              </div>
              <p className="text-[11px] text-rose-800">Triggers Trip Planning with 15-mile proximity clusters.</p>
              <input
                type="number"
                value={outOfTownRadius}
                onChange={e => setOutOfTownRadius(Number(e.target.value))}
                className="w-full bg-white border border-rose-300 rounded-lg p-2 text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs">Live Contact Golden Window & Trip Approvals</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Golden Window for In-Person & Calls</p>
                  <p className="text-[11px] text-slate-500">10:00 AM – 4:00 PM local time of dealership.</p>
                </div>
                <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono font-bold">10:00 - 16:00</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="font-semibold text-slate-800">Require Trip Approval for Out-of-Town (70+ mi)</p>
                  <p className="text-[11px] text-slate-500">Requires manager sign-off on travel days over 70 miles from home.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTripApproval}
                    onChange={e => setRequireTripApproval(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="font-semibold text-slate-800">Leave-By Safety Margin (minutes)</p>
                  <p className="text-[11px] text-slate-500">Buffer added before first appointment (on top of drive + 10m parking).</p>
                </div>
                <input
                  type="number"
                  value={safetyMarginMin}
                  onChange={e => setSafetyMarginMin(Number(e.target.value))}
                  className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-center text-slate-800"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSavedTerritoryNotice(true);
                  setTimeout(() => setSavedTerritoryNotice(false), 3000);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs"
              >
                Save Territory Policies
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal (Section 2) */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-xs">
            <h3 className="font-bold text-sm text-slate-900">Add New Product to Open Catalog</h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. Paintless Dent Repair Protection"
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <input
                  type="text"
                  value={newProductCategory}
                  onChange={(e) => setNewProductCategory(e.target.value)}
                  placeholder="e.g. Appearance & Protection"
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Short Description</label>
                <textarea
                  value={newProductDesc}
                  onChange={(e) => setNewProductDesc(e.target.value)}
                  placeholder="Brief description for sales pitch..."
                  className="w-full p-2 border border-slate-300 rounded-xl h-16"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newProductRequiresTopup}
                    onChange={(e) => setNewProductRequiresTopup(e.target.checked)}
                    className="rounded"
                  />
                  <span>Requires Inventory Top-Ups (Physical hardware tracking)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newProductIsLaunch}
                    onChange={(e) => setNewProductIsLaunch(e.target.checked)}
                    className="rounded"
                  />
                  <span>Flag as "New Launch" (Highlighted to field reps)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateProduct}
                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 cursor-pointer"
              >
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
