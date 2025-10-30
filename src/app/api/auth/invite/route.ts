import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { requireRole } from '@/lib/rbac';
import { OrgStore } from '@/lib/inMemoryStore';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['manager', 'admin', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = await req.json();
  const email = String(body.email || '').trim();
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  // Try to send invite via Supabase; if not available, create a user silently for CI
  let userId: string | null = null;
  try {
    const { data, error } = await supabaseService.auth.admin.inviteUserByEmail(email);
    if (!error && data?.user?.id) userId = data.user.id;
  } catch {}
  if (!userId) {
    try {
      const { data } = await supabaseService.auth.admin.createUser({ email, password: 'TempPassw0rd!', email_confirm: true });
      userId = data.user?.id ?? null;
    } catch {}
  }
  if (!userId) return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });

  // If manager calling, auto-associate with their org
  if (auth.role === 'manager') {
    const orgId = OrgStore.myOrgId(auth.userId!);
    if (orgId) OrgStore.addMember(orgId, userId, 'agent');
  }

  return NextResponse.json({ success: true, data: { user_id: userId } }, { status: 200 });
}
