import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.ASSIGN_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await req.json();
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    const status = String(body?.status || 'assigned');

    if (!assignments.length) {
      return NextResponse.json({ error: 'assignments array required' }, { status: 400 });
    }

    const sanitized = assignments.map((a: any) => ({
      agent_id: String(a.agent_id || '').trim(),
      shift_id: String(a.shift_id || '').trim(),
      status,
      notes: a.notes === undefined ? null : (a.notes === null ? null : String(a.notes).trim()),
    })).filter((r: any) => r.agent_id && r.shift_id);

    if (!sanitized.length) {
      return NextResponse.json({ error: 'No valid assignment payloads' }, { status: 400 });
    }

    if (useMock()) {
      const result = sanitized.map((r: any, i: number) => ({ id: `ass-${i+1}`, ...r, assigned_at: new Date().toISOString() }));
      return NextResponse.json({ success: true, data: result });
    }

    const { data, error } = await supabaseService
      .from('assignments')
      .insert(sanitized)
      .select('*');
    if (error) {
      console.error('assign insert error', error);
      return NextResponse.json({ error: error.message || 'Insert error' }, { status: 400 });
    }

    // Fire notifications (best-effort)
    try {
      const rows = (data || []).map((d: any) => ({
        agent_id: d.agent_id,
        type: 'shift_assigned',
        message: `You have a new shift (${d.shift_id})`,
        channel: 'push',
        delivered_at: new Date().toISOString(),
      }));
      if (rows.length) await supabaseService.from('agent_notifications').insert(rows);
    } catch (e) {
      console.warn('notify after assign failed', e);
    }

    return NextResponse.json({ success: true, data });
  } catch (e) {
    console.error('manager assign error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
