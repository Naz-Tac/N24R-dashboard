// Lightweight in-memory store to support CI and local dev when DB schema isn't present

export type OrgRole = 'manager' | 'agent';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  manager_user_id: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}

export interface OrgShift {
  id: string;
  organization_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  notes?: string | null;
}

export interface OrgAssignment {
  id: string;
  organization_id: string | null;
  agent_id: string;
  shift_id: string;
  status: string;
  shared?: boolean;
}

// AI Assistant Memory
export interface AiMemoryEntry {
  id: string;
  user_id: string;
  role: 'admin' | 'dispatcher' | 'manager' | 'agent';
  timestamp: string;
  // message or action summary
  type: 'user_message' | 'assistant_message' | 'action';
  content: string;
  intent?: 'create_shift' | 'assign_agent' | 'notify_agent' | 'show_analytics' | 'none';
  action?: string | null;
  action_details?: Record<string, any> | null;
}

const g: any = globalThis as any;
if (!g.__ORG_STORE__) {
  g.__ORG_STORE__ = {
    organizations: [] as Organization[],
    members: [] as OrganizationMember[],
    shifts: [] as OrgShift[],
    assignments: [] as OrgAssignment[],
    aiMemory: [] as AiMemoryEntry[],
  };
}

const store = g.__ORG_STORE__ as {
  organizations: Organization[];
  members: OrganizationMember[];
  shifts: OrgShift[];
  assignments: OrgAssignment[];
  aiMemory: AiMemoryEntry[];
};

const uuid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export const OrgStore = {
  addOrganization(name: string, manager_user_id: string): Organization {
    const org: Organization = {
      id: uuid(),
      name,
      created_at: new Date().toISOString(),
      manager_user_id,
    };
    store.organizations.push(org);
    return org;
  },
  listOrganizations(): Organization[] {
    return [...store.organizations];
  },
  addMember(organization_id: string, user_id: string, role: OrgRole): OrganizationMember {
    const mem: OrganizationMember = {
      id: uuid(),
      organization_id,
      user_id,
      role,
      joined_at: new Date().toISOString(),
    };
    store.members.push(mem);
    return mem;
  },
  listMembers(orgId: string): OrganizationMember[] {
    return store.members.filter((m) => m.organization_id === orgId);
  },
  myOrgId(user_id: string): string | null {
    const m = store.members.find((mm) => mm.user_id === user_id && mm.role === 'manager');
    return m ? m.organization_id : null;
  },
  addShift(orgId: string, shift: Omit<OrgShift, 'id'>): OrgShift {
    const s: OrgShift = { id: uuid(), ...shift, organization_id: orgId } as OrgShift;
    store.shifts.push(s);
    return s;
  },
  listShifts(orgId: string): OrgShift[] {
    return store.shifts.filter((s) => s.organization_id === orgId);
  },
  addAssignment(a: Omit<OrgAssignment, 'id'>): OrgAssignment {
    const row: OrgAssignment = { id: uuid(), ...a };
    store.assignments.push(row);
    return row;
  },
  listAssignments(orgId: string): OrgAssignment[] {
    return store.assignments.filter((a) => a.organization_id === orgId);
  },
};

import { supabaseService } from '@/lib/supabaseClient';

// check if Supabase service client is available
function supabaseReady(): boolean {
  try {
    // @ts-ignore dynamic check
    return !!supabaseService && typeof (supabaseService as any).from === 'function';
  } catch {
    return false;
  }
}

// Simple AI Memory Store helpers (per-user scoped) with Supabase-first strategy
export const AiMemoryStore = {
  // Local-only ops
  addLocal(entry: Omit<AiMemoryEntry, 'id'>): AiMemoryEntry {
    const row: AiMemoryEntry = { id: uuid(), ...entry };
    store.aiMemory.push(row);
    return row;
  },
  listByUserLocal(user_id: string, limit = 10): AiMemoryEntry[] {
    return store.aiMemory
      .filter((m) => m.user_id === user_id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, limit);
  },
  clearUserLocal(user_id: string): number {
    const before = store.aiMemory.length;
    const remaining = store.aiMemory.filter((m) => m.user_id !== user_id);
    store.aiMemory.length = 0;
    store.aiMemory.push(...remaining);
    return before - store.aiMemory.length;
  },
  purgeOlderThanLocal(days: number): number {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const before = store.aiMemory.length;
    const remaining = store.aiMemory.filter((m) => new Date(m.timestamp).getTime() >= cutoff);
    store.aiMemory.length = 0;
    store.aiMemory.push(...remaining);
    return before - store.aiMemory.length;
  },

  // Supabase-first APIs with fallback to local
  async append(entry: Omit<AiMemoryEntry, 'id'>, opts?: { forceFallback?: boolean }): Promise<{ source: 'db' | 'local'; row: AiMemoryEntry }>
  {
    try {
      if (!opts?.forceFallback && supabaseReady()) {
        const { data, error } = await (supabaseService as any)
          .from('ai_memory')
          .insert({
            user_id: entry.user_id,
            role: entry.role,
            type: entry.type,
            content: entry.content,
            intent: entry.intent || null,
          })
          .select('*')
          .single();
        if (!error && data) {
          const row: AiMemoryEntry = {
            id: data.id,
            user_id: data.user_id,
            role: data.role,
            timestamp: data.created_at || entry.timestamp,
            type: data.type,
            content: data.content,
            intent: data.intent || 'none',
            action: null,
            action_details: null,
          };
          // Also keep a local shadow for faster reads
          store.aiMemory.unshift(row);
          return { source: 'db', row };
        }
      }
    } catch (e) {
      // ignore
    }
    const row = AiMemoryStore.addLocal(entry);
    return { source: 'local', row };
  },

  async getRecent(user_id: string, limit = 10, opts?: { forceFallback?: boolean }): Promise<{ source: 'db' | 'local'; rows: AiMemoryEntry[] }>
  {
    try {
      if (!opts?.forceFallback && supabaseReady()) {
        const { data, error } = await (supabaseService as any)
          .from('ai_memory')
          .select('id,user_id,role,type,content,intent,created_at')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!error && Array.isArray(data)) {
          const rows: AiMemoryEntry[] = data.map((d: any) => ({
            id: d.id,
            user_id: d.user_id,
            role: d.role,
            timestamp: d.created_at,
            type: d.type,
            content: d.content,
            intent: d.intent || 'none',
            action: null,
            action_details: null,
          }));
          return { source: 'db', rows };
        }
      }
    } catch (e) {
      // ignore
    }
    return { source: 'local', rows: AiMemoryStore.listByUserLocal(user_id, limit) };
  },

  async clearUser(user_id: string, opts?: { forceFallback?: boolean }): Promise<{ source: 'db' | 'local'; deleted: number }>
  {
    try {
      if (!opts?.forceFallback && supabaseReady()) {
        const { error, count } = await (supabaseService as any)
          .from('ai_memory')
          .delete({ count: 'exact' })
          .eq('user_id', user_id);
        if (!error) {
          // also clear local shadow for this user
          const deletedLocal = AiMemoryStore.clearUserLocal(user_id);
          return { source: 'db', deleted: count ?? deletedLocal };
        }
      }
    } catch (e) {
      // ignore
    }
    const deleted = AiMemoryStore.clearUserLocal(user_id);
    return { source: 'local', deleted };
  },

  async purgeOlderThan(days: number): Promise<{ source: 'db' | 'local'; deleted: number }>
  {
    try {
      if (supabaseReady()) {
        const { error, count } = await (supabaseService as any)
          .from('ai_memory')
          .delete({ count: 'exact' })
          .lt('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
        if (!error) {
          const deletedLocal = AiMemoryStore.purgeOlderThanLocal(days);
          return { source: 'db', deleted: count ?? deletedLocal };
        }
      }
    } catch (e) {
      // ignore
    }
    return { source: 'local', deleted: AiMemoryStore.purgeOlderThanLocal(days) };
  },

  async syncFromSupabase(user_id: string, limit = 50) {
    if (!supabaseReady()) return { source: 'local', rows: [] as AiMemoryEntry[] };
    const { data, error } = await (supabaseService as any)
      .from('ai_memory')
      .select('id,user_id,role,type,content,intent,created_at')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return { source: 'db', rows: [] as AiMemoryEntry[] };
    const rows: AiMemoryEntry[] = data.map((d: any) => ({
      id: d.id,
      user_id: d.user_id,
      role: d.role,
      timestamp: d.created_at,
      type: d.type,
      content: d.content,
      intent: d.intent || 'none',
      action: null,
      action_details: null,
    }));
    // hydrate local shadow
    // remove existing entries for user and push fresh ones
    AiMemoryStore.clearUserLocal(user_id);
    rows.slice().reverse().forEach((r) => store.aiMemory.push(r));
    return { source: 'db', rows };
  },

  // Rank top intents for a user or role (local computation over shadow)
  topIntents(opts: { user_id?: string; role?: 'admin' | 'dispatcher' | 'manager' | 'agent'; limit?: number }) {
    const { user_id, role, limit = 3 } = opts;
    const src = store.aiMemory.filter((m) =>
      (user_id ? m.user_id === user_id : true) && (role ? m.role === role : true) && m.intent && m.intent !== 'none'
    );
    const counts = new Map<string, number>();
    src.forEach((m) => {
      const key = m.intent as string;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([intent]) => intent);
  },
};
