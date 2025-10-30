import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { OrgStore } from '@/lib/inMemoryStore';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['manager', 'admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let orgId: string | null = null;
  if (auth.role === 'manager') orgId = OrgStore.myOrgId(auth.userId!);
  if (!orgId && (auth.role === 'admin' || auth.role === 'dispatcher')) {
    // allow admins to pass orgId via query
    const { searchParams } = new URL(req.url);
    orgId = searchParams.get('organization_id');
  }
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const members = OrgStore.listMembers(orgId).filter((m) => m.role === 'agent');
  return NextResponse.json({ success: true, data: members }, { status: 200 });
}
