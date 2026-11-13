// Keyfetch stock for the whole app: worked out once, read anywhere.

import React, { createContext, useContext, useMemo } from 'react';
import type { DealerGroup, Dealership, User } from '../../types/crm';
import { buildInventoryDemo } from './demo';
import { DealerStock, dealerStock, indexStock, OfficeStock, officeStock, StockIndex } from './stock';
import { mergeInventory, useInventoryChanges } from './store';
import type { InventoryData } from './types';

export interface InventoryValue {
  data: InventoryData;
  index: StockIndex;
  stocks: Map<string, DealerStock>;
  office: OfficeStock | null;
  today: string;
}

const Ctx = createContext<InventoryValue | null>(null);

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function useBuildInventory(dealerships: Dealership[], groups: DealerGroup[], users: User[]): InventoryValue {
  const today = todayISO();
  const changes = useInventoryChanges();
  // Only rebuild the demo sheets when the Keyfetch dealerships themselves change.
  const key = dealerships
    .filter(d => d.signedProducts?.includes('prod_3'))
    .map(d => `${d.id}:${d.stage}:${d.groupId ?? ''}:${d.assignedRepId ?? ''}`)
    .join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demo = useMemo(() => buildInventoryDemo(dealerships, groups, users, today).data, [key, today, groups.length, users.length]);
  return useMemo(() => {
    const data = mergeInventory(demo, changes);
    const index = indexStock(data);
    const stocks = new Map<string, DealerStock>();
    Object.keys(data.setups).forEach(id => {
      const s = dealerStock(id, data, today, index);
      if (s) stocks.set(id, s);
    });
    const groupStores = data.heldGroupId ? dealerships.filter(d => d.groupId === data.heldGroupId).map(d => d.id) : [];
    const office = officeStock(data, groupStores, stocks, today, index);
    return { data, index, stocks, office, today };
  }, [demo, changes, today, dealerships]);
}

export const InventoryProvider: React.FC<{ value: InventoryValue; children: React.ReactNode }> = ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;

export function useInventory(): InventoryValue | null {
  return useContext(Ctx);
}
