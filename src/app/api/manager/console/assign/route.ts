import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.ASSIGN_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

type AssignmentPayload = { agent_id: string; shift_id: string; status?: string; notes?: string | null };

async function getUnassignedShifts(orgId: string): Promise<string[]> {
  try {
    const { data } = await supabaseService
      .from('shifts')
      .select('id')
      .eq('organization_id', orgId)
      .is('assigned_agent_id', null);
    if (data && data.length) return data.map((s: any) => s.id);
  } catch {}
  // Mock fallback
  return ['shift-1', 'shift-2', 'shift-3'];
}

async function predictAndAssign(shiftId: string, orgId: string): Promise<AssignmentPayload | null> {
  try {
    const r = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/ai/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shift_id: shiftId, organization_id: orgId }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const top = (j?.data?.candidates || [])[0];
    if (!top?.agent_id) return null;
    return {
      agent_id: top.agent_id,
      shift_id: shiftId,
      status: 'assigned',
      notes: `AI auto-assign (score=${top.score?.toFixed(2) || 'N/A'})`,
    };
  } catch {
    return null;
  }
}

async function logAudit(entries: Array<{shift_id:string;agent_id:string;score?:number;reason?:string;}>) {
  try {
    const rows = entries.map((e) => ({
      shift_id: e.shift_id,
      agent_id: e.agent_id,
      score: e.score ?? 0,
      reason: e.reason || 'auto',
      assigned_at: new Date().toISOString(),
    }));
    await supabaseService.from('ai_assignment_audit').insert(rows);
  } catch {}
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await req.json();
    const mode = String(body?.mode || 'batch').toLowerCase();
    const assignments = Array.isArray(body?.assignments) ? body.assignments : [];
    const status = String(body?.status || 'assigned');
    const orgId = String(body?.organization_id || 'default-org');

    let sanitized: AssignmentPayload[] = [];

    if (mode === 'auto') {
      // Auto mode: fetch unassigned shifts, predict, assign
      const shifts = await getUnassignedShifts(orgId);
      const predicted = await Promise.all(shifts.map((sid) => predictAndAssign(sid, orgId)));
      sanitized = predicted.filter((p): p is AssignmentPayload => p !== null);
    } else if (mode === 'single' || mode === 'batch') {
      // Single/batch: use provided assignments
      sanitized = assignments.map((a: any) => ({
        agent_id: String(a.agent_id || '').trim(),
        shift_id: String(a.shift_id || '').trim(),
        status: a.status || status,
        notes: a.notes === undefined ? null : (a.notes === null ? null : String(a.notes).trim()),
      })).filter((r: any) => r.agent_id && r.shift_id);
    } else {
      return NextResponse.json({ error: 'Invalid mode; must be single|batch|auto' }, { status: 400 });
    }

    if (!sanitized.length) {
      return NextResponse.json({ error: 'No valid assignment payloads' }, { status: 400 });
    }

    if (useMock()) {
      const result = sanitized.map((r: any, i: number) => ({ id: `ass-${i+1}`, ...r, assigned_at: new Date().toISOString() }));
      await logAudit(sanitized.map((s,i) => ({ shift_id: s.shift_id, agent_id: s.agent_id, score: 0.8 + i*0.01, reason: s.notes || 'mock' })));
      return NextResponse.json({ success: true, data: result, mode, count: result.length });
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

    // Audit log
    await logAudit((data || []).map((d: any) => ({ shift_id: d.shift_id, agent_id: d.agent_id, score: 0.85, reason: d.notes || 'manual' })));

    return NextResponse.json({ success: true, data, mode, count: (data || []).length });
  } catch (e) {
    console.error('manager assign error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
