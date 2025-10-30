import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { OrgStore } from '@/lib/inMemoryStore';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['manager', 'admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let orgId: string | null = null;
  if (auth.role === 'manager') orgId = OrgStore.myOrgId(auth.userId!);
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const rows = OrgStore.listShifts(orgId!);
  return NextResponse.json({ success: true, data: rows }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['manager', 'admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  let orgId: string | null = null;
  if (auth.role === 'manager') orgId = OrgStore.myOrgId(auth.userId!);
  if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  const body = await req.json();
  const date = String(body.date || '').trim();
  const start_time = String(body.start_time || '').trim();
  const end_time = String(body.end_time || '').trim();
  const location = body.location ? String(body.location) : null;
  const notes = body.notes === undefined ? null : String(body.notes);
  if (!date || !start_time || !end_time) return NextResponse.json({ error: 'date, start_time, end_time required' }, { status: 400 });
  const created = OrgStore.addShift(orgId, { organization_id: orgId!, date, start_time, end_time, location, notes } as any);
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
