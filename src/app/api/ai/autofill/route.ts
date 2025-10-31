import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';
import { OrgStore } from '@/lib/inMemoryStore';

async function fetchUnassignedShifts(orgId: string, limit?: number) {
  try {
    // Try DB: shifts table with no assignment or status=unassigned
    let q = (supabaseService as any)
      .from('shifts')
      .select('id,date,start_time,end_time,location')
      .eq('status', 'unassigned')
      .limit(limit || 10);
    
    // If organization_id column exists
    try {
      q = q.eq('organization_id', orgId);
    } catch {}

    const { data, error } = await q;
    if (!error && Array.isArray(data) && data.length) return data;
  } catch {}

  // Fallback to in-memory
  try {
    const shifts = OrgStore.listShifts(orgId);
    // Filter for unassigned (heuristic: no assignment with this shift_id)
    const assignments = OrgStore.listAssignments(orgId);
    const assignedIds = new Set(assignments.map((a: any) => a.shift_id));
    const unassigned = shifts.filter((s: any) => !assignedIds.has(s.id)).slice(0, limit || 10);
    return unassigned;
  } catch {}

  return [];
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = await req.json();
    const organization_id = String(body.organization_id || '').trim();
    const limit = Number(body.limit || 10);
    const criteria = Array.isArray(body.criteria) ? body.criteria : ['availability', 'past_acceptance', 'credentials'];

    if (!organization_id) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Manager scope check
    if (auth.role === 'manager') {
      const myOrgId = OrgStore.myOrgId(auth.userId!);
      if (myOrgId && myOrgId !== organization_id) {
        return NextResponse.json({ error: 'Forbidden: manager can only autofill within their organization' }, { status: 403 });
      }
    }

    const unassigned = await fetchUnassignedShifts(organization_id, limit);
    const filled: Array<{ shift_id: string; agent_id: string; score: number }> = [];
    const skipped: Array<{ shift_id: string; reason: string }> = [];

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';

    for (const shift of unassigned) {
      try {
        const resp = await fetch(`${origin}/api/ai/predict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            shift_id: shift.id,
            organization_id,
            criteria,
            auto_assign: true,
          }),
        });

        if (resp.ok) {
          const json = await resp.json();
          if (json?.data?.auto_assigned && json.data.assignment_id) {
            const top = json.data.recommendations?.[0];
            filled.push({ shift_id: shift.id, agent_id: top?.agent_id || 'unknown', score: top?.score || 0 });
          } else {
            skipped.push({ shift_id: shift.id, reason: 'no_candidates' });
          }
        } else {
          skipped.push({ shift_id: shift.id, reason: 'predict_failed' });
        }
      } catch (e) {
        skipped.push({ shift_id: shift.id, reason: 'error' });
      }
    }

    // Insert autofill summary audit (optional)
    try {
      await (supabaseService as any)
        .from('ai_assignment_audit')
        .insert({
          shift_id: null,
          agent_id: null,
          score: null,
          criteria: { method: 'autofill', org: organization_id, filled: filled.length, skipped: skipped.length },
          guardrails: {},
          auto_assigned: true,
          role: auth.role,
          user_id: auth.userId,
        });
    } catch {}

    return NextResponse.json({ success: true, data: { filled, skipped } }, { status: 200 });
  } catch (err) {
    console.error('POST /api/ai/autofill error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
