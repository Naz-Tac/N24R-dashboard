import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { OrgStore } from '@/lib/inMemoryStore';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const userId = auth.userId!;
  // Admin/dispatcher: list all
  if (auth.role === 'admin' || auth.role === 'dispatcher') {
    return NextResponse.json({ success: true, data: OrgStore.listOrganizations() });
  }
  // Manager: list only own org
  const myOrgId = OrgStore.myOrgId(userId);
  const all = OrgStore.listOrganizations();
  const mine = myOrgId ? all.filter((o) => o.id === myOrgId) : [];
  return NextResponse.json({ success: true, data: mine });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await req.json();
  const name = String(body.name || '').trim();
  const manager_user_id = String(body.manager_user_id || '').trim();
  if (!name || !manager_user_id) {
    return NextResponse.json({ error: 'name and manager_user_id are required' }, { status: 400 });
  }

  // Try DB insert; fallback to in-memory
  let created: any = null;
  try {
    const { data, error } = await supabaseService
      .from('organizations')
      .insert({ name, manager_user_id })
      .select('*')
      .maybeSingle();
    if (!error && data) created = data;
  } catch {}
  if (!created) {
    created = OrgStore.addOrganization(name, manager_user_id);
  }
  // Ensure manager membership exists in memory
  OrgStore.addMember(created.id, manager_user_id, 'manager');

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
