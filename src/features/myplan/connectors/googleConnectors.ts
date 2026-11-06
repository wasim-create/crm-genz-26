// Google Tasks and Google Calendar connectors.
//
// DEMO: these are realistic mocks that store their "remote" data in
// localStorage, so the team can see two-way sync working. For the test
// version, implement the same interfaces with the real Google Tasks API
// (tasks.tasklists / tasks.tasks) and Calendar API (events) — the rest of
// My Plan does not need to change.

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  /** YYYY-MM-DD */
  due?: string;
  status: 'needsAction' | 'completed';
  updated: string;
}

export interface TasksConnector {
  readonly isDemo: boolean;
  list(userId: string): Promise<GoogleTask[]>;
  upsert(userId: string, task: Omit<GoogleTask, 'id' | 'updated'> & { id?: string }): Promise<GoogleTask>;
  remove(userId: string, id: string): Promise<void>;
}

export interface CalendarEvent {
  id: string;
  slotId?: string;
  title: string;
  date: string;
  start: string;
  end: string;
  description?: string;
  updated: string;
}

export interface CalendarConnector {
  readonly isDemo: boolean;
  list(userId: string): Promise<CalendarEvent[]>;
  replaceForSlots(userId: string, events: Omit<CalendarEvent, 'id' | 'updated'>[]): Promise<void>;
}

const read = <T,>(key: string): Record<string, T[]> => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — demo only */
  }
};

const TASKS_KEY = 'apexdrive_mock_google_tasks';
const CAL_KEY = 'apexdrive_mock_google_calendar';
let seq = 0;
const gid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const mockGoogleTasks: TasksConnector = {
  isDemo: true,
  async list(userId) {
    return read<GoogleTask>(TASKS_KEY)[userId] ?? [];
  },
  async upsert(userId, task) {
    const all = read<GoogleTask>(TASKS_KEY);
    const list = all[userId] ?? [];
    const updated = new Date().toISOString();
    const existing = task.id ? list.find(t => t.id === task.id) : undefined;
    const next: GoogleTask = existing
      ? { ...existing, ...task, id: existing.id, updated }
      : { ...task, id: gid('gt_'), updated };
    all[userId] = existing ? list.map(t => (t.id === next.id ? next : t)) : [...list, next];
    write(TASKS_KEY, all);
    return next;
  },
  async remove(userId, id) {
    const all = read<GoogleTask>(TASKS_KEY);
    all[userId] = (all[userId] ?? []).filter(t => t.id !== id);
    write(TASKS_KEY, all);
  }
};

export const mockGoogleCalendar: CalendarConnector = {
  isDemo: true,
  async list(userId) {
    return read<CalendarEvent>(CAL_KEY)[userId] ?? [];
  },
  async replaceForSlots(userId, events) {
    const all = read<CalendarEvent>(CAL_KEY);
    const updated = new Date().toISOString();
    const keep = (all[userId] ?? []).filter(e => !e.slotId);
    all[userId] = [...keep, ...events.map(e => ({ ...e, id: `gc_${e.slotId}`, updated }))];
    write(CAL_KEY, all);
  }
};

export const resetMockGoogle = () => {
  try {
    localStorage.removeItem(TASKS_KEY);
    localStorage.removeItem(CAL_KEY);
  } catch {
    /* ignore */
  }
};
