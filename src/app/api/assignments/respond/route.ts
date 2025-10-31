import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { requireRole, getUserFromRequest } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const webhookSecret = process.env.WEBHOOK_SECRET;
    const providedSecret = String(body.webhook_secret || '').trim();

    // Determine mode: webhook (no auth) vs. authenticated agent/admin
    let mode: 'webhook' | 'auth' = 'auth';
    if (providedSecret && webhookSecret && providedSecret === webhookSecret) {
      mode = 'webhook';
    }

    let userId: string | null = null;
    let role: 'agent' | 'admin' | 'dispatcher' | null = null;
    if (mode === 'auth') {
      const auth = await requireRole(req, ['agent', 'admin', 'dispatcher']);
      if (!auth.ok) {
        return NextResponse.json({ error: auth.message }, { status: auth.status });
      }
  userId = auth.userId ?? null;
      role = auth.role as any;
    }

    const assignment_id = String(body.assignment_id || '').trim();
    // Action mapping: if webhook, map from body/body_text; else use explicit action
    let action = String(body.action || '').trim().toLowerCase();
    if (!action && mode === 'webhook') {
      const text = String(body.body || body.message || '').trim().toLowerCase();
      if (['yes', 'y', 'confirm', 'accepted', 'accept'].includes(text)) action = 'accept';
      if (['no', 'n', 'decline', 'declined', 'reject'].includes(text)) action = 'decline';
    }

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
    if (mode === 'auth' && role === 'agent') {
      if (!userId || existing.agent_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';
    // Try to set responded_at; if column missing, fall back to status-only update
    let updated: any = null;
    let updErr: any = null;
    try {
      const resp = await supabaseService
        .from('assignments')
        .update({ status: newStatus, responded_at: new Date().toISOString() })
        .eq('id', assignment_id)
        .select('*')
        .maybeSingle();
      updated = resp.data; updErr = resp.error;
      if (updErr && /column .*responded_at.* does not exist/i.test(updErr.message || '')) {
        const resp2 = await supabaseService
          .from('assignments')
          .update({ status: newStatus })
          .eq('id', assignment_id)
          .select('*')
          .maybeSingle();
        updated = resp2.data; updErr = resp2.error;
      }
    } catch (e: any) {
      updErr = e;
    }

    if (updErr) {
      return NextResponse.json({ error: updErr.message, code: updErr.code }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (err) {
    console.error('POST /api/assignments/respond error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
