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

// Simple AI Memory Store helpers (per-user scoped)
export const AiMemoryStore = {
  add(entry: Omit<AiMemoryEntry, 'id'>): AiMemoryEntry {
    const row: AiMemoryEntry = { id: uuid(), ...entry };
    store.aiMemory.push(row);
    return row;
  },
  listByUser(user_id: string, limit = 10): AiMemoryEntry[] {
    // newest first
    return store.aiMemory
      .filter((m) => m.user_id === user_id)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, limit);
  },
  clearUser(user_id: string): number {
    const before = store.aiMemory.length;
    const remaining = store.aiMemory.filter((m) => m.user_id !== user_id);
    store.aiMemory.length = 0;
    store.aiMemory.push(...remaining);
    return before - store.aiMemory.length;
  },
  purgeOlderThan(days: number): number {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const before = store.aiMemory.length;
    const remaining = store.aiMemory.filter((m) => new Date(m.timestamp).getTime() >= cutoff);
    store.aiMemory.length = 0;
    store.aiMemory.push(...remaining);
    return before - store.aiMemory.length;
  },
  // Rank top intents for a user or role
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
