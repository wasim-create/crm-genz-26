import { Contact, DealerGroup, Dealership, ProductCatalogItem, User } from '../../../types/crm';
import { HowType, PlanSlot, SlotTask, WorkType } from '../types';
import { defaultHow, defaultTaskIds, durationFor, HOW_LABEL, TASK_BY_ID, workTypeForStage } from '../engine/tasks';
import { contactsFor, targetFromDealership, targetFromGroup } from '../data/seed';
import { hasKeyfetch } from '../services/suggestions';
import { format12h } from '../engine/time';

let seq = 0;
export const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export const productName = (catalog: ProductCatalogItem[], id: string) => catalog.find(p => p.id === id)?.name ?? id;

/** Product options for a task, given the dealership. */
export function productOptions(taskId: string, d: Dealership | undefined, catalog: ProductCatalogItem[]): ProductCatalogItem[] {
  const def = TASK_BY_ID[taskId];
  const active = catalog.filter(p => p.isActive);
  if (!def?.products) return [];
  if (def.products === 'not_owned') return active.filter(p => !(d?.signedProducts ?? []).includes(p.id));
  return active;
}

export function defaultProducts(taskId: string, d: Dealership | undefined, catalog: ProductCatalogItem[]): string[] {
  const def = TASK_BY_ID[taskId];
  if (!def?.products) return [];
  const options = productOptions(taskId, d, catalog);
  if (def.products === 'interested_or_all') {
    const interested = (d?.productInterests ?? []).map(p => p.productId).filter(id => options.some(o => o.id === id));
    return interested.slice(0, 2);
  }
  if (def.products === 'not_owned') return options.filter(p => p.isNewLaunch).slice(0, 1).map(p => p.id);
  return [];
}

export function makeTasks(taskIds: string[], d: Dealership | undefined, catalog: ProductCatalogItem[]): SlotTask[] {
  return taskIds.map(taskId => {
    const products = defaultProducts(taskId, d, catalog);
    return products.length ? { taskId, productIds: products } : { taskId };
  });
}

export function draftSlotForDealership(params: {
  user: User;
  dealership: Dealership;
  contacts: Contact[];
  catalog: ProductCatalogItem[];
  how?: HowType;
  date?: string;
}): PlanSlot {
  const { user, dealership: d, contacts, catalog } = params;
  const work = (workTypeForStage(d.stage) ?? 'prospect') as WorkType;
  const taskIds = defaultTaskIds(d.stage, work, hasKeyfetch(d, catalog));
  const how = params.how ?? defaultHow(d.stage, taskIds);
  const tasks = makeTasks(taskIds, d, catalog);
  const cs = contactsFor(d.id, contacts);
  const now = new Date().toISOString();
  return {
    id: newId('slot'),
    userId: user.id,
    date: params.date,
    orderIndex: 9999,
    status: params.date ? 'planned' : 'basket',
    how,
    workType: work,
    target: targetFromDealership(d),
    tasks,
    contactIds: cs.slice(0, 1).map(c => c.id),
    contactNames: cs.slice(0, 1).map(c => `${c.firstName} ${c.lastName}`),
    timeMode: 'flow',
    durationMin: durationFor(how, tasks),
    source: 'manual',
    createdAt: now,
    updatedAt: now
  };
}

export function draftSlotForGroup(params: { user: User; group: DealerGroup; dealerships: Dealership[]; how?: HowType; date?: string }): PlanSlot {
  const { user, group } = params;
  const rooftops = params.dealerships.filter(d => d.groupId === group.id && (d.assignedRepId === user.id || group.groupAccountOwnerId === user.id));
  const tasks: SlotTask[] = [{ taskId: 'g_meeting' }];
  const how = params.how ?? 'in_person';
  const now = new Date().toISOString();
  const target = targetFromGroup(group, rooftops.length ? rooftops : params.dealerships.filter(d => d.groupId === group.id));
  return {
    id: newId('slot'),
    userId: user.id,
    date: params.date,
    orderIndex: 9999,
    status: params.date ? 'planned' : 'basket',
    how,
    workType: 'group',
    target: { ...target, rooftopIds: rooftops.slice(0, 3).map(r => r.id) },
    tasks,
    contactIds: [],
    contactNames: [group.mainDecisionMaker],
    timeMode: 'flow',
    durationMin: durationFor(how, tasks),
    source: 'manual',
    createdAt: now,
    updatedAt: now
  };
}

export function taskSummary(slot: PlanSlot, catalog: ProductCatalogItem[]): string[] {
  return slot.tasks.map(t => {
    const def = TASK_BY_ID[t.taskId];
    const label = def?.label ?? t.taskId;
    const products = (t.productIds ?? []).map(id => productName(catalog, id));
    return products.length ? `${label}: ${products.join(', ')}` : label;
  });
}

export function timeText(slot: PlanSlot, start?: number, end?: number): string {
  if (slot.how === 'email' || slot.how === 'text') return slot.sendTime ? `Sends ${format12h(slot.sendTime)}` : 'Send today';
  if (start === undefined) return 'Anytime';
  return `${format12h(start)} – ${format12h(end ?? start)}`;
}

export const howVerb: Record<HowType, string> = {
  in_person: 'Visit',
  phone: 'Call',
  meet: 'Google Meet with',
  email: 'Email',
  text: 'Text'
};

export const describeSlot = (slot: PlanSlot) =>
  slot.target.kind === 'block' ? slot.target.name : `${HOW_LABEL[slot.how]} — ${slot.target.name}`;

export const mapsUrl = (slot: PlanSlot) =>
  slot.target.coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${slot.target.coords.lat},${slot.target.coords.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${slot.target.name} ${slot.target.city ?? ''} ${slot.target.state ?? ''}`)}`;
