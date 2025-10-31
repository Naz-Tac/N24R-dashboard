import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Require any authenticated role; agents can only mark their own
    const auth = await requireRole(req, ['admin', 'manager', 'dispatcher', 'agent']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    // If agent, verify ownership
    if (auth.role === 'agent') {
      const { data: note, error } = await supabaseService
        .from('agent_notifications')
        .select('agent_id')
        .eq('id', id)
        .maybeSingle();
      if (error || !note || note.agent_id !== auth.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const { error: updErr } = await supabaseService
      .from('agent_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    if (updErr) throw updErr;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
