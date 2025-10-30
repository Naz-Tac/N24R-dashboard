import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { OrgStore } from '@/lib/inMemoryStore';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['manager', 'admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let orgId: string | null = null;
  if (auth.role === 'manager') orgId = OrgStore.myOrgId(auth.userId!);
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

  const body = await req.json();
  const shift_id = String(body.shift_id || '').trim();
  const agent_id = String(body.agent_id || '').trim(); // choose shared agent id
  if (!shift_id || !agent_id) return NextResponse.json({ error: 'shift_id and agent_id required' }, { status: 400 });

  const created = OrgStore.addAssignment({ organization_id: orgId, agent_id, shift_id, status: 'requested', shared: true });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
