import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }
    const { data, error } = await supabaseService.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) {
      console.error('Create user error:', error);
      return NextResponse.json({ error: 'Failed to create user', code: error.name }, { status: 400 });
    }
    return NextResponse.json({ success: true, data: { id: data.user?.id, email: data.user?.email } }, { status: 201 });
  } catch (e: any) {
    console.error('POST /api/auth/create-test-user error', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
