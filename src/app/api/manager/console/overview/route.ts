import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  try {
    if (useMock()) {
      return NextResponse.json({
        success: true,
        data: {
          active_shifts: 12,
          total_shifts: 25,
          unassigned_shifts: 4,
          on_duty: 28,
          en_route: 7,
          idle: 14,
          avg_response_time: 212,
        },
      });
    }

    const [shiftsResp, unassignedResp, agentsResp, feedbackResp] = await Promise.all([
      supabaseService.from('assignments').select('id').eq('status', 'assigned'),
      supabaseService.from('shifts').select('id').is('assigned_agent_id', null),
      supabaseService.from('agents').select('id,status'),
      supabaseService.from('ai_feedback').select('responded_in').gte('created_at', new Date(Date.now() - 30*864e5).toISOString()),
    ]);

    const active_shifts = shiftsResp.data?.length || 0;
    const total_shifts = (shiftsResp.data?.length || 0) + (unassignedResp.data?.length || 0);
    const unassigned_shifts = unassignedResp.data?.length || 0;
    const on_duty = (agentsResp.data || []).filter((a: any) => (a.status||'').toLowerCase() === 'on_duty').length;
    const en_route = (agentsResp.data || []).filter((a: any) => (a.status||'').toLowerCase() === 'en_route').length;
    const idle = (agentsResp.data || []).filter((a: any) => (a.status||'').toLowerCase() === 'idle').length;

    const rts = (feedbackResp.data || []).map((f: any) => f.responded_in).filter((n: any) => typeof n === 'number');
    const avg_response_time = rts.length ? Math.round(rts.reduce((a:number,b:number)=>a+b,0)/rts.length) : 0;

    return NextResponse.json({ success: true, data: { active_shifts, total_shifts, unassigned_shifts, on_duty, en_route, idle, avg_response_time } });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
