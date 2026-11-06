import React, { createContext, useContext } from 'react';
import {
  Contact,
  DealerGroup,
  Dealership,
  GameRule,
  ManagerPriority,
  ProductBonus,
  ProductCatalogItem,
  User
} from '../../../types/crm';
import { EngineSettings, HowType, LatLng, MyPlanSettings, PlanSlot } from '../types';
import { DayLayout } from '../engine/schedule';
import { Suggestion } from '../services/suggestions';

export interface AddPreset {
  dealershipId?: string;
  groupId?: string;
  how?: HowType;
  date?: string;
  /** Open straight into "Plan later" mode. */
  planLater?: boolean;
  /** Re-use an existing basket slot (from the basket / week planner). */
  basketSlotId?: string;
  /** A manager suggesting something for a rep's basket. */
  priorityFrom?: string;
  /** Forces a fresh flow when re-opened with the same preset. */
  nonce?: number;
}

export type SheetState =
  | { kind: 'add'; preset?: AddPreset }
  | { kind: 'edit'; slotId: string }
  | { kind: 'outcome'; slotId: string }
  | { kind: 'move'; slotId: string }
  | { kind: 'todo' }
  | { kind: 'basket' }
  | { kind: 'settings' }
  | { kind: 'walkthrough' }
  | null;

export interface MyPlanContextValue {
  today: string;
  now: Date;
  /** Signed-in user. */
  user: User;
  /** Whose plan is on screen (managers can view a rep's plan). */
  viewUser: User;
  readOnly: boolean;
  users: User[];
  dealerships: Dealership[];
  dealershipById: Map<string, Dealership>;
  contacts: Contact[];
  groups: DealerGroup[];
  catalog: ProductCatalogItem[];
  gameRules: GameRule[];
  productBonuses: ProductBonus[];
  priorities: ManagerPriority[];
  settings: MyPlanSettings;
  engine: EngineSettings;
  home: LatLng;
  slots: PlanSlot[];
  daySlots: (date: string) => PlanSlot[];
  layout: (date: string) => DayLayout;
  basket: PlanSlot[];
  suggestions: Map<string, Suggestion>;
  date: string;
  setDate: (d: string) => void;
  view: 'day' | 'week' | 'month';
  setView: (v: 'day' | 'week' | 'month') => void;
  sheet: SheetState;
  openSheet: (s: SheetState) => void;
  closeSheet: () => void;
  onAddContact: (c: Contact) => void;
  onAddDealership: (d: Dealership) => void;
  onClaimDealership: (d: Dealership) => void;
  onOpenDealership: (d: Dealership) => void;
}

export const MyPlanContext = createContext<MyPlanContextValue | null>(null);

export const useMyPlan = (): MyPlanContextValue => {
  const ctx = useContext(MyPlanContext);
  if (!ctx) throw new Error('useMyPlan must be used inside <MyPlanModule>');
  return ctx;
};

export const MyPlanProvider: React.FC<{ value: MyPlanContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <MyPlanContext.Provider value={value}>{children}</MyPlanContext.Provider>
);
