import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { data: usersPage, error: usersError } = await supabaseService.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      console.error('List users error:', usersError);
      return NextResponse.json({ error: 'Failed to list users', code: usersError.name }, { status: 500 });
    }

    const userIds = (usersPage?.users || []).map((u: any) => u.id);
    let rolesMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: roles, error: rolesError } = await supabaseService
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      if (!rolesError && roles) {
        for (const r of roles) {
          rolesMap[r.user_id] = r.role;
        }
      }
    }

    const result = (usersPage?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      role: rolesMap[u.id] || null,
    }));

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (e: any) {
    console.error('GET /api/admin/users error', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { user_id, role } = body as { user_id?: string; role?: 'admin' | 'dispatcher' | 'agent' };
    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing user_id or role' }, { status: 400 });
    }

    const { data, error } = await supabaseService
      .from('user_roles')
      .upsert({ user_id, role }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) {
      console.error('Upsert role error:', error);
      return NextResponse.json({ error: 'Failed to update role', code: error.code, details: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (e: any) {
    console.error('PUT /api/admin/users error', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
