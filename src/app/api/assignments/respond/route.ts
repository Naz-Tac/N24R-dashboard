import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { requireRole, getUserFromRequest } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    // Allow agents to respond; admins/dispatchers may also simulate
    const auth = await requireRole(req, ['agent', 'admin', 'dispatcher']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

  const user = await getUserFromRequest(req);
    const body = await req.json();
    const assignment_id = String(body.assignment_id || '').trim();
    const action = String(body.action || '').trim().toLowerCase();

    if (!assignment_id || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({
        error: 'Invalid payload',
        details: 'assignment_id and action (accept|decline) are required'
      }, { status: 400 });
    }

    // Fetch assignment to verify ownership if agent role
    const { data: existing, error: fetchErr } = await supabaseService
      .from('assignments')
      .select('id, agent_id, status')
      .eq('id', assignment_id)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message, code: fetchErr.code }, { status: 400 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    // If the requester is an agent, ensure they own the assignment
    if (auth.role === 'agent') {
      if (!user || existing.agent_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    const { data: updated, error: updErr } = await supabaseService
      .from('assignments')
      .update({ status: newStatus })
      .eq('id', assignment_id)
      .select('*')
      .maybeSingle();

    if (updErr) {
      return NextResponse.json({ error: updErr.message, code: updErr.code }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error('POST /api/assignments/respond error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
