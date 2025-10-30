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

const g: any = globalThis as any;
if (!g.__ORG_STORE__) {
  g.__ORG_STORE__ = {
    organizations: [] as Organization[],
    members: [] as OrganizationMember[],
    shifts: [] as OrgShift[],
    assignments: [] as OrgAssignment[],
  };
}

const store = g.__ORG_STORE__ as {
  organizations: Organization[];
  members: OrganizationMember[];
  shifts: OrgShift[];
  assignments: OrgAssignment[];
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
