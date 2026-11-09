// Logging a visit (or call, Meet, email) that wasn't planned first, e.g. from
// the dealership record. It builds the same kind of slot My Plan uses, so the
// rep answers the same "How did it go?" form and the CRM is updated the same way.

import { Contact, Dealership, ProductCatalogItem } from '../../../types/crm';
import { HowType, PlanSlot, SlotTask } from '../types';
import { defaultHow, defaultTaskIds, durationFor, TASK_BY_ID, workTypeForStage } from '../engine/tasks';
import { toHHMM } from '../engine/time';
import { defaultProducts, newId } from './slotHelpers';

export function loggedTasks(d: Dealership, catalog: ProductCatalogItem[]): SlotTask[] {
  const work = workTypeForStage(d.stage) ?? 'prospect';
  const hasKeyfetch = (d.signedProducts ?? []).includes('prod_3');
  return defaultTaskIds(d.stage, work, hasKeyfetch).map(taskId => {
    const products = TASK_BY_ID[taskId]?.products ? defaultProducts(taskId, d, catalog) : [];
    return products.length ? { taskId, productIds: products } : { taskId };
  });
}

/** Start time for something that just finished: now minus its length, on a 5-minute mark. */
export function startedBefore(now: Date, minutes: number): string {
  const m = now.getHours() * 60 + now.getMinutes() - minutes;
  return toHHMM(Math.max(0, Math.floor(m / 5) * 5));
}

export function buildLoggedSlot(d: Dealership, userId: string, contacts: Contact[], catalog: ProductCatalogItem[], today: string, now: Date): PlanSlot {
  const tasks = loggedTasks(d, catalog);
  const how: HowType = defaultHow(d.stage, tasks.map(t => t.taskId));
  const durationMin = durationFor(how, tasks);
  const main = contacts.filter(c => c.dealershipId === d.id).sort((a, b) => Number(!!b.isDecisionMaker) - Number(!!a.isDecisionMaker))[0];
  const iso = now.toISOString();
  return {
    id: newId('slot'),
    userId,
    date: today,
    orderIndex: 0,
    status: 'planned',
    how,
    workType: workTypeForStage(d.stage) ?? 'prospect',
    target: {
      kind: 'dealership',
      id: d.id,
      name: d.dealershipName,
      city: d.city,
      state: d.state,
      coords: d.coordinates,
      address: [d.address, d.city, `${d.state} ${d.zipCode}`].filter(Boolean).join(', ')
    },
    tasks,
    contactIds: main ? [main.id] : [],
    contactNames: main ? [`${main.firstName} ${main.lastName}`] : [],
    timeMode: 'exact',
    fixedTime: startedBefore(now, durationMin),
    durationMin,
    source: 'manual',
    unplanned: true,
    createdAt: iso,
    updatedAt: iso
  };
}
