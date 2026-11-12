import React, { useState } from 'react';
import { BackLayer, Badge, Btn, PageHeader, Switch } from '../ui/kit';
import { ThemeChoice } from '../ui/ThemeToggle';
import { TeamRulesPanel } from '../../features/team/TeamRulesPanel';
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
  const [activeTab, setActiveTab] = useState<'storage' | 'catalog' | 'fi_systems' | 'territory' | 'people' | 'team'>(currentUser.role === 'admin' ? 'people' : 'catalog');
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

  const canManageCatalog = ['owner', 'executive', 'manager', 'admin'].includes(currentUser.role);

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
      <PageHeader
        icon={<Settings className="h-6 w-6" />}
        title="Settings"
        subtitle="Products, territory and planning rules, people and data."
        actions={
          <Btn variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={onResetDemoData}>
            Reset demo data
          </Btn>
        }
      />

      <Switch
        label="Section"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'catalog', label: `Products (${catalog.filter(p => p.isActive).length})` },
          { value: 'territory', label: 'Territory & planning' },
          ...(currentUser.role.endsWith('_rep') ? [] : [{ value: 'team' as const, label: 'Team rules' }]),
          { value: 'people', label: `People (${allUsers.filter(u => u.active !== false).length})` },
          { value: 'fi_systems', label: 'F&I systems' },
          { value: 'storage', label: 'Appearance & data' }
        ]}
      />

      {activeTab === 'team' && <TeamRulesPanel canEdit={['owner', 'executive', 'admin'].includes(currentUser.role)} />}

      {activeTab === 'people' && onUpdateUsers && (
        <PeopleAdminPanel currentUser={currentUser} users={allUsers} knownLocations={knownLocations} onChange={onUpdateUsers} />
      )}

      {/* TAB 1: PRODUCT CATALOG (Section 2 - strictly NO price fields) */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[14px] text-slate-600">Products reps can pitch. Managers and owners can add one any time; switching one off hides it from visits and sign-ups.</p>
            {canManageCatalog && (
              <Btn variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddProductModal(true)}>
                Add a product
              </Btn>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Top-ups</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalog.map((prod, idx) => (
                  <tr key={prod.id} className="hover:bg-slate-50/80">
                    <td className="p-3">
                      <span className="font-bold text-slate-900">{prod.name}</span>
                      {prod.isNewLaunch && <Badge tone="red" className="ml-2">New</Badge>}
                      <span className="block" />
                      <span className="text-[13px] text-slate-500">{prod.description}</span>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{prod.category || 'General'}</td>
                    <td className="p-3">
                      {prod.requiresInventoryTopups ? 'Yes, tracked' : '—'}
                    </td>
                    <td className="p-3">
                      <Badge tone={prod.isActive ? 'green' : 'neutral'}>{prod.isActive ? 'On' : 'Off'}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      {canManageCatalog && (
                        <Btn size="sm" variant="ghost" onClick={() => handleToggleProductStatus(prod.id)}>
                          {prod.isActive ? 'Switch off' : 'Switch on'}
                        </Btn>
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
        <div className="space-y-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-[14px]">
          <h3 className="font-bold text-[16px] text-slate-900">Appearance</h3>
          <p className="text-slate-600">Auto follows your device, so it goes dark in the evening if your device does. Pick Light or Dark to override it on this device.</p>
          <ThemeChoice />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 text-[14px]">
          <h3 className="font-bold text-[16px] text-slate-900">Where the data lives</h3>
          <p className="text-slate-600">
            This demo keeps everything in this browser ({storageMode}). Use Reset demo data at the top to start again with fresh demo data dated from today.
          </p>
        </div>
        </div>
      )}

      {/* TAB 3: F&I SYSTEMS */}
      {activeTab === 'fi_systems' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-[14px]">
          <h3 className="font-bold text-[16px] text-slate-900">F&I systems reps can choose from</h3>
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5 text-[14px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-[16px] text-slate-900">Territory and planning</h3>
              <p className="text-slate-500 mt-0.5">
                Distances are measured from each rep’s home ZIP.
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
                <span className="font-bold text-emerald-900 text-[14px]">🟢 Territory</span>
                <span className="text-[14px] font-bold text-emerald-700">0–{homeRadius} mi</span>
              </div>
              <p className="text-[13px] text-emerald-800">Normal working area.</p>
              <input
                type="number"
                value={homeRadius}
                onChange={e => setHomeRadius(Number(e.target.value))}
                className="w-full bg-white border border-emerald-300 rounded-lg p-2 text-[14px] font-bold text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-900 text-[14px]">🟡 Edge of territory</span>
                <span className="text-[14px] font-bold text-amber-700">{homeRadius}–{edgeRadius} mi</span>
              </div>
              <p className="text-[13px] text-amber-800">Allowed, shown as “edge of region”.</p>
              <input
                type="number"
                value={edgeRadius}
                onChange={e => setEdgeRadius(Number(e.target.value))}
                className="w-full bg-white border border-amber-300 rounded-lg p-2 text-[14px] font-bold text-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-[14px]">🔴 Out of town</span>
                <span className="text-[14px] font-bold text-rose-700">{outOfTownRadius}+ mi</span>
              </div>
              <p className="text-[13px] text-rose-800">My Plan suggests a trip day, grouping stops within 15 miles.</p>
              <input
                type="number"
                value={outOfTownRadius}
                onChange={e => setOutOfTownRadius(Number(e.target.value))}
                className="w-full bg-white border border-rose-300 rounded-lg p-2 text-[14px] font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <h4 className="font-bold text-slate-800 text-[14px]">Visit hours and trips</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">Best hours for visits and calls</p>
                  <p className="text-[13px] text-slate-500">In the dealership’s own time zone.</p>
                </div>
                <span className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-bold">10 AM – 4 PM</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="font-semibold text-slate-800">Manager approves out-of-town trips</p>
                  <p className="text-[13px] text-slate-500">Trip days more than 70 miles from home need a manager’s OK.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTripApproval}
                    onChange={e => setRequireTripApproval(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-onaccent after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-onaccent after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand"></div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div>
                  <p className="font-semibold text-slate-800">Extra minutes before the first stop</p>
                  <p className="text-[13px] text-slate-500">Added on top of the drive and 10 minutes to park.</p>
                </div>
                <input
                  type="number"
                  value={safetyMarginMin}
                  onChange={e => setSafetyMarginMin(Number(e.target.value))}
                  className="w-20 bg-white border border-slate-300 rounded-lg p-1.5 text-[14px] font-bold text-center text-slate-800"
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
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-onaccent font-bold rounded-xl text-[14px] cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Product Modal (Section 2) */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-scrim/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <BackLayer onBack={() => setShowAddProductModal(false)} />
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl text-[14px]">
            <h3 className="font-bold text-sm text-slate-900">Add a product</h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Name</label>
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
                <label className="font-bold text-slate-700 block mb-1">Short description</label>
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
                  <span>Track top-ups (like Keyfetch tags)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={newProductIsLaunch}
                    onChange={(e) => setNewProductIsLaunch(e.target.checked)}
                    className="rounded"
                  />
                  <span>Mark as new (highlighted to reps)</span>
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
                className="px-4 py-1.5 rounded-xl bg-brand text-onaccent font-bold hover:bg-brand-hover cursor-pointer"
              >
                Add product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
