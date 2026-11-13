import { isKeyDecisionMaker, normalizeJobTitle } from '../data/jobTitles';
import {
  Dealership,
  User,
  DealerGroup,
  Contact,
  Activity,
  ManagerAssist,
  IntroductionIncentive,
  ProductCatalogItem,
  GamificationProfile,
  WorkspaceItem,
  AuditLogRecord,
  GameRule,
  ProductBonus,
  ManagerPriority,
  PointsLedgerEntry
} from '../types/crm';
import {
  USERS,
  INITIAL_DEALERSHIPS,
  DEALER_GROUPS,
  INITIAL_CONTACTS,
  INITIAL_ACTIVITIES,
  INITIAL_ASSISTS,
  INITIAL_INCENTIVES,
  PRODUCT_CATALOG,
  FI_SYSTEMS_LIST,
  INITIAL_GAMIFICATION,
  INITIAL_WORKSPACE_ITEMS,
  INITIAL_AUDIT_LOGS,
  INITIAL_GAME_RULES,
  INITIAL_PRODUCT_BONUSES,
  INITIAL_MANAGER_PRIORITIES,
  INITIAL_POINTS_LEDGER,
  SEED_VERSION
} from '../data/seedData';
import { MYPLAN_STORAGE_KEY } from '../features/myplan/data/store';

export type StorageMode = 'local_storage' | 'google_sheets' | 'cloud_sql';

export interface StorageAdapter {
  getMode(): StorageMode;
  loadAll(currentUser?: User): Promise<{
    dealerships: Dealership[];
    users: User[];
    groups: DealerGroup[];
    contacts: Contact[];
    activities: Activity[];
    assists: ManagerAssist[];
    incentives: IntroductionIncentive[];
    products: ProductCatalogItem[];
    fiSystems: string[];
    gamification: Record<string, GamificationProfile>;
    workspaceItems: WorkspaceItem[];
    auditLogs: AuditLogRecord[];
    gameRules: GameRule[];
    productBonuses: ProductBonus[];
    managerPriorities: ManagerPriority[];
    pointsLedger: PointsLedgerEntry[];
  }>;
  saveDealership(dealership: Dealership): Promise<void>;
  saveDealerships(dealerships: Dealership[]): Promise<void>;
  saveActivity(activity: Activity): Promise<void>;
  saveAssist(assist: ManagerAssist): Promise<void>;
  saveIncentive(incentive: IntroductionIncentive): Promise<void>;
  saveContact(contact: Contact): Promise<void>;
  saveGroup(group: DealerGroup): Promise<void>;
  saveUsers(users: User[]): Promise<void>;
  saveAuditLog(log: AuditLogRecord): Promise<void>;
  saveProduct(product: ProductCatalogItem): Promise<void>;
  saveGameRule(rule: GameRule): Promise<void>;
  saveProductBonus(bonus: ProductBonus): Promise<void>;
  savePriority(priority: ManagerPriority): Promise<void>;
  addPointsLedgerEntry(entry: PointsLedgerEntry): Promise<void>;
  transferOwnership(dealershipId: string, toRepId: string, managerId: string, managerName: string, reason: string): Promise<void>;
  resetToSeed(): Promise<void>;
}

// Older saved demo data: map free-text job titles onto the standard list,
// and make sure the demo admin login exists.
function migrateContactTitles(list: Contact[]): Contact[] {
  return list.map(c => {
    const n = normalizeJobTitle(c.jobTitle);
    if (n.title === c.jobTitle || (n.title === 'Other' && c.customTitle)) return c;
    return n.title === 'Other' ? { ...c, customTitle: n.custom ?? c.jobTitle } : { ...c, jobTitle: n.title, isDecisionMaker: c.isDecisionMaker || isKeyDecisionMaker(n.title) };
  });
}

/**
 * People added to the app after a browser first saved its user list (the demo
 * admin, the Inventory Manager). Without this they'd never appear for anyone
 * who opened the app before they were added.
 */
const ADDED_LATER = ['u_admin', 'u_monica'];

function withAdmin(list: User[]): User[] {
  const missing = USERS.filter(u => (u.role === 'admin' || ADDED_LATER.includes(u.id)) && !list.some(x => x.id === u.id));
  return missing.length ? [...list, ...missing] : list;
}

const STORAGE_KEYS = {
  MODE: 'apexdrive_storage_mode',
  DEALERSHIPS: 'apexdrive_dealerships',
  USERS: 'apexdrive_users',
  GROUPS: 'apexdrive_groups',
  CONTACTS: 'apexdrive_contacts',
  ACTIVITIES: 'apexdrive_activities',
  ASSISTS: 'apexdrive_assists',
  INCENTIVES: 'apexdrive_incentives',
  PRODUCTS: 'apexdrive_products',
  FI_SYSTEMS: 'apexdrive_fi_systems',
  GAMIFICATION: 'apexdrive_gamification',
  WORKSPACE: 'apexdrive_workspace',
  AUDIT_LOGS: 'apexdrive_audit_logs',
  GAME_RULES: 'apexdrive_game_rules',
  PRODUCT_BONUSES: 'apexdrive_product_bonuses',
  PRIORITIES: 'apexdrive_priorities',
  POINTS_LEDGER: 'apexdrive_points_ledger',
  SEED_VERSION: 'apexdrive_seed_version'
};

export class LocalStorageAdapter implements StorageAdapter {
  getMode(): StorageMode {
    return 'local_storage';
  }

  async loadAll(currentUser?: User) {
    try {
      const storedDeals = localStorage.getItem(STORAGE_KEYS.DEALERSHIPS);
      // Saved data from an older demo story is replaced with the current one.
      if (!storedDeals || localStorage.getItem(STORAGE_KEYS.SEED_VERSION) !== SEED_VERSION) {
        await this.resetToSeed();
      }

      const allIncentives: IntroductionIncentive[] = JSON.parse(
        localStorage.getItem(STORAGE_KEYS.INCENTIVES) || JSON.stringify(INITIAL_INCENTIVES)
      );

      // Section 4 Visibility Rule: Mask incentive amounts at the data layer!
      const filteredIncentives = this.filterIncentivesForUser(allIncentives, currentUser);

      const rawDeals = JSON.parse(localStorage.getItem(STORAGE_KEYS.DEALERSHIPS) || '[]');
      const loadedDeals: Dealership[] = (rawDeals.length > 0 ? rawDeals : INITIAL_DEALERSHIPS).map((d: any) => ({
        ...d,
        productInterests: Array.isArray(d.productInterests) ? d.productInterests : [
          {
            productId: 'prod_1',
            productName: 'Vehicle Service Contract (Extended Warranty)',
            interestLevel: (d.heatLevel === 'Hot' ? 'High' : 'Medium') as 'Low' | 'Medium' | 'High',
            recordedDate: d.lastTouchpointDate || new Date().toISOString(),
            recordedByUserId: d.originRepId || 'u_kelley',
            recordedByUserName: 'Kelley'
          },
          {
            productId: 'prod_3',
            productName: 'Keyfetch',
            interestLevel: 'High' as 'Low' | 'Medium' | 'High',
            recordedDate: d.lastTouchpointDate || new Date().toISOString(),
            recordedByUserId: d.originRepId || 'u_kelley',
            recordedByUserName: 'Kelley'
          }
        ],
        signedProducts: Array.isArray(d.signedProducts) ? d.signedProducts : (d.stage === 'Client' ? ['prod_3', 'prod_1'] : []),
        topups: Array.isArray(d.topups) ? d.topups : [],
        upsells: Array.isArray(d.upsells) ? d.upsells : [],
        relationshipTemperature: d.relationshipTemperature || {
          score: d.stage === 'Client' ? 85 : d.heatLevel === 'Hot' ? 78 : 62,
          trend: 'steady',
          sparkline: [55, 60, 62],
          intentPhrases: ['Receptive to <24hr SLA', 'Interested in key tracking'],
          hesitationPhrases: [],
          ghostingRisk: 'low'
        },
        inventoryHistory: Array.isArray(d.inventoryHistory) ? d.inventoryHistory : [],
        franchiseBrands: Array.isArray(d.franchiseBrands) ? d.franchiseBrands : [d.franchiseType || 'Franchise']
      }));

      return {
        dealerships: loadedDeals,
        users: withAdmin(JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || JSON.stringify(USERS))),
        groups: JSON.parse(localStorage.getItem(STORAGE_KEYS.GROUPS) || JSON.stringify(DEALER_GROUPS)),
        contacts: migrateContactTitles(JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || JSON.stringify(INITIAL_CONTACTS))),
        activities: JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES) || JSON.stringify(INITIAL_ACTIVITIES)),
        assists: JSON.parse(localStorage.getItem(STORAGE_KEYS.ASSISTS) || JSON.stringify(INITIAL_ASSISTS)),
        incentives: filteredIncentives,
        products: JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || JSON.stringify(PRODUCT_CATALOG)),
        fiSystems: JSON.parse(localStorage.getItem(STORAGE_KEYS.FI_SYSTEMS) || JSON.stringify(FI_SYSTEMS_LIST)),
        gamification: JSON.parse(localStorage.getItem(STORAGE_KEYS.GAMIFICATION) || JSON.stringify(INITIAL_GAMIFICATION)),
        workspaceItems: JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKSPACE) || JSON.stringify(INITIAL_WORKSPACE_ITEMS)),
        auditLogs: JSON.parse(localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS) || JSON.stringify(INITIAL_AUDIT_LOGS)),
        gameRules: JSON.parse(localStorage.getItem(STORAGE_KEYS.GAME_RULES) || JSON.stringify(INITIAL_GAME_RULES)),
        productBonuses: JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCT_BONUSES) || JSON.stringify(INITIAL_PRODUCT_BONUSES)),
        managerPriorities: JSON.parse(localStorage.getItem(STORAGE_KEYS.PRIORITIES) || JSON.stringify(INITIAL_MANAGER_PRIORITIES)),
        pointsLedger: JSON.parse(localStorage.getItem(STORAGE_KEYS.POINTS_LEDGER) || JSON.stringify(INITIAL_POINTS_LEDGER))
      };
    } catch {
      return {
        dealerships: INITIAL_DEALERSHIPS,
        users: USERS,
        groups: DEALER_GROUPS,
        contacts: INITIAL_CONTACTS,
        activities: INITIAL_ACTIVITIES,
        assists: INITIAL_ASSISTS,
        incentives: this.filterIncentivesForUser(INITIAL_INCENTIVES, currentUser),
        products: PRODUCT_CATALOG,
        fiSystems: FI_SYSTEMS_LIST,
        gamification: INITIAL_GAMIFICATION,
        workspaceItems: INITIAL_WORKSPACE_ITEMS,
        auditLogs: INITIAL_AUDIT_LOGS,
        gameRules: INITIAL_GAME_RULES,
        productBonuses: INITIAL_PRODUCT_BONUSES,
        managerPriorities: INITIAL_MANAGER_PRIORITIES,
        pointsLedger: INITIAL_POINTS_LEDGER
      };
    }
  }

  // Data layer visibility filtering
  private filterIncentivesForUser(incentives: IntroductionIncentive[], currentUser?: User): IntroductionIncentive[] {
    if (!currentUser) return incentives;
    const canSeeAll = ['finance', 'manager', 'executive', 'owner'].includes(currentUser.role);
    if (canSeeAll) return incentives;

    // Reps and team leads only see their OWN amounts
    return incentives.map(inc => {
      if (inc.originRepId === currentUser.id) {
        return inc;
      }
      // Mask amount for other reps' introductions
      const { amount, ...rest } = inc;
      return rest as IntroductionIncentive;
    });
  }

  async saveDealership(dealership: Dealership): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.DEALERSHIPS);
    const list: Dealership[] = raw ? JSON.parse(raw) : INITIAL_DEALERSHIPS;
    const idx = list.findIndex(d => d.id === dealership.id);
    if (idx >= 0) {
      list[idx] = { ...dealership, updatedAt: new Date().toISOString() };
    } else {
      list.push({ ...dealership, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(STORAGE_KEYS.DEALERSHIPS, JSON.stringify(list));
  }

  async saveDealerships(dealerships: Dealership[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.DEALERSHIPS, JSON.stringify(dealerships));
  }

  async saveActivity(activity: Activity): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    const list: Activity[] = raw ? JSON.parse(raw) : INITIAL_ACTIVITIES;
    const idx = list.findIndex(a => a.id === activity.id);
    if (idx >= 0) {
      list[idx] = activity;
    } else {
      list.unshift(activity);
    }
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(list));
  }

  async saveAssist(assist: ManagerAssist): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSISTS);
    const list: ManagerAssist[] = raw ? JSON.parse(raw) : INITIAL_ASSISTS;
    const idx = list.findIndex(h => h.id === assist.id);
    if (idx >= 0) {
      list[idx] = assist;
    } else {
      list.unshift(assist);
    }
    localStorage.setItem(STORAGE_KEYS.ASSISTS, JSON.stringify(list));
  }

  async saveIncentive(incentive: IntroductionIncentive): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.INCENTIVES);
    const list: IntroductionIncentive[] = raw ? JSON.parse(raw) : INITIAL_INCENTIVES;
    const idx = list.findIndex(i => i.id === incentive.id);
    if (idx >= 0) {
      list[idx] = incentive;
    } else {
      list.unshift(incentive);
    }
    localStorage.setItem(STORAGE_KEYS.INCENTIVES, JSON.stringify(list));
  }

  async saveGroup(group: DealerGroup): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.GROUPS);
    const list: DealerGroup[] = raw ? JSON.parse(raw) : DEALER_GROUPS;
    const idx = list.findIndex(g => g.id === group.id);
    if (idx >= 0) list[idx] = group;
    else list.push(group);
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(list));
  }

  async saveUsers(users: User[]): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  async saveContact(contact: Contact): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    const list: Contact[] = raw ? JSON.parse(raw) : INITIAL_CONTACTS;
    const idx = list.findIndex(c => c.id === contact.id);
    if (idx >= 0) {
      list[idx] = contact;
    } else {
      list.push(contact);
    }
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(list));
  }

  async saveAuditLog(log: AuditLogRecord): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    const list: AuditLogRecord[] = raw ? JSON.parse(raw) : INITIAL_AUDIT_LOGS;
    list.unshift(log);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(list.slice(0, 100)));
  }

  async saveProduct(product: ProductCatalogItem): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const list: ProductCatalogItem[] = raw ? JSON.parse(raw) : PRODUCT_CATALOG;
    const idx = list.findIndex(p => p.id === product.id);
    if (idx >= 0) {
      list[idx] = product;
    } else {
      list.push(product);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(list));
  }

  async saveGameRule(rule: GameRule): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_RULES);
    const list: GameRule[] = raw ? JSON.parse(raw) : INITIAL_GAME_RULES;
    const idx = list.findIndex(r => r.id === rule.id);
    if (idx >= 0) {
      list[idx] = rule;
    } else {
      list.push(rule);
    }
    localStorage.setItem(STORAGE_KEYS.GAME_RULES, JSON.stringify(list));
  }

  async saveProductBonus(bonus: ProductBonus): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.PRODUCT_BONUSES);
    const list: ProductBonus[] = raw ? JSON.parse(raw) : INITIAL_PRODUCT_BONUSES;
    const idx = list.findIndex(b => b.id === bonus.id);
    if (idx >= 0) {
      list[idx] = bonus;
    } else {
      list.push(bonus);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCT_BONUSES, JSON.stringify(list));
  }

  async savePriority(priority: ManagerPriority): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.PRIORITIES);
    const list: ManagerPriority[] = raw ? JSON.parse(raw) : INITIAL_MANAGER_PRIORITIES;
    const idx = list.findIndex(p => p.id === priority.id);
    if (idx >= 0) {
      list[idx] = priority;
    } else {
      list.unshift(priority);
    }
    localStorage.setItem(STORAGE_KEYS.PRIORITIES, JSON.stringify(list));
  }

  async addPointsLedgerEntry(entry: PointsLedgerEntry): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.POINTS_LEDGER);
    const list: PointsLedgerEntry[] = raw ? JSON.parse(raw) : INITIAL_POINTS_LEDGER;
    list.unshift(entry);
    localStorage.setItem(STORAGE_KEYS.POINTS_LEDGER, JSON.stringify(list));

    // Update profile total points and pointsToday
    const gRaw = localStorage.getItem(STORAGE_KEYS.GAMIFICATION);
    const profiles: Record<string, GamificationProfile> = gRaw ? JSON.parse(gRaw) : INITIAL_GAMIFICATION;
    if (profiles[entry.userId]) {
      profiles[entry.userId].points += entry.pointsAwarded;
      profiles[entry.userId].pointsToday += entry.pointsAwarded;
      localStorage.setItem(STORAGE_KEYS.GAMIFICATION, JSON.stringify(profiles));
    }
  }

  async transferOwnership(dealershipId: string, toRepId: string, managerId: string, managerName: string, reason: string): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.DEALERSHIPS);
    const list: Dealership[] = raw ? JSON.parse(raw) : INITIAL_DEALERSHIPS;
    const idx = list.findIndex(d => d.id === dealershipId);
    if (idx >= 0) {
      const d = list[idx];
      const fromRepId = d.assignedRepId || 'unassigned';
      const transferRecord = {
        id: `tx_${Date.now()}`,
        dealershipId,
        fromRepId,
        toRepId,
        transferredByManagerId: managerId,
        transferredByManagerName: managerName,
        reason,
        timestamp: new Date().toISOString()
      };
      d.assignedRepId = toRepId;
      d.ownershipTransfers = [...(d.ownershipTransfers || []), transferRecord];
      list[idx] = d;
      localStorage.setItem(STORAGE_KEYS.DEALERSHIPS, JSON.stringify(list));

      await this.saveAuditLog({
        id: `aud_${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: managerId,
        userName: managerName,
        dealershipId,
        dealershipName: d.dealershipName,
        action: 'Deal Ownership Transferred',
        details: `Ownership transferred from ${fromRepId} to ${toRepId}. Reason: ${reason}`
      });
    }
  }

  async resetToSeed(): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.DEALERSHIPS, JSON.stringify(INITIAL_DEALERSHIPS));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(USERS));
    localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(DEALER_GROUPS));
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(INITIAL_CONTACTS));
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(INITIAL_ACTIVITIES));
    localStorage.setItem(STORAGE_KEYS.ASSISTS, JSON.stringify(INITIAL_ASSISTS));
    localStorage.setItem(STORAGE_KEYS.INCENTIVES, JSON.stringify(INITIAL_INCENTIVES));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(PRODUCT_CATALOG));
    localStorage.setItem(STORAGE_KEYS.FI_SYSTEMS, JSON.stringify(FI_SYSTEMS_LIST));
    localStorage.setItem(STORAGE_KEYS.GAMIFICATION, JSON.stringify(INITIAL_GAMIFICATION));
    localStorage.setItem(STORAGE_KEYS.WORKSPACE, JSON.stringify(INITIAL_WORKSPACE_ITEMS));
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(INITIAL_AUDIT_LOGS));
    localStorage.setItem(STORAGE_KEYS.GAME_RULES, JSON.stringify(INITIAL_GAME_RULES));
    localStorage.setItem(STORAGE_KEYS.PRODUCT_BONUSES, JSON.stringify(INITIAL_PRODUCT_BONUSES));
    localStorage.setItem(STORAGE_KEYS.PRIORITIES, JSON.stringify(INITIAL_MANAGER_PRIORITIES));
    localStorage.setItem(STORAGE_KEYS.POINTS_LEDGER, JSON.stringify(INITIAL_POINTS_LEDGER));
    localStorage.setItem(STORAGE_KEYS.SEED_VERSION, SEED_VERSION);
    localStorage.removeItem('apexdrive_myplan_v4');
    localStorage.removeItem(MYPLAN_STORAGE_KEY);
  }
}
