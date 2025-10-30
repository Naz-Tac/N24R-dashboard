import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { OrgStore, OrgRole } from '@/lib/inMemoryStore';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await req.json();
  const organization_id = String(body.organization_id || '').trim();
  const user_id = String(body.user_id || '').trim();
  const role = String(body.role || '').trim() as OrgRole;
  if (!organization_id || !user_id || !['manager', 'agent'].includes(role)) {
    return NextResponse.json({ error: 'organization_id, user_id, and role required' }, { status: 400 });
  }
  // Managers can only add members to their own org
  if (auth.role === 'manager') {
    const myOrgId = OrgStore.myOrgId(auth.userId!);
    if (myOrgId !== organization_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const mem = OrgStore.addMember(organization_id, user_id, role);
  return NextResponse.json({ success: true, data: mem }, { status: 201 });
}
