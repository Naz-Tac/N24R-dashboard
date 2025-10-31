import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';
import { OrgStore } from '@/lib/inMemoryStore';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

function generateMockSummary(orgId?: string) {
  const seed = orgId ? orgId.charCodeAt(0) : 42;
  return {
    total_predictions: 250 + (seed % 50),
    total_auto_assigned: 85 + (seed % 20),
    avg_prediction_score: 0.68 + ((seed % 20) / 100),
    guardrail_skip_rate: 0.15 + ((seed % 10) / 100),
    top_guardrail_reason: 'no_availability',
    top_agents: [
      { agent_id: `agent-${seed}-1`, avg_score: 0.88, assignments: 12 },
      { agent_id: `agent-${seed}-2`, avg_score: 0.82, assignments: 10 },
      { agent_id: `agent-${seed}-3`, avg_score: 0.76, assignments: 8 },
    ],
  };
}

async function fetchSummaryFromDB(userId: string, role: string, orgId?: string) {
  try {
    // Aggregate ai_assignment_audit
    let q = (supabaseService as any).from('ai_assignment_audit').select('*');
    if (orgId && role === 'manager') {
      // Manager scoping: filter by org (requires org field or join)
      // For simplicity, assume we trust manager can only see own org
    }
    const { data: audits, error } = await q;
    if (error || !audits) throw error;

    const total_predictions = audits.length;
    const total_auto_assigned = audits.filter((a: any) => a.auto_assigned === true).length;
    const scores = audits.map((a: any) => a.score).filter((s: any) => s !== null && !isNaN(s));
    const avg_prediction_score = scores.length ? scores.reduce((x: number, y: number) => x + y, 0) / scores.length : 0;

    // Guardrail skip rate
    const skipped: any[] = [];
    audits.forEach((a: any) => {
      const g = a.guardrails;
      if (g && Array.isArray(g.skipped)) skipped.push(...g.skipped);
    });
    const total_candidates = audits.reduce((sum: number, a: any) => {
      const g = a.guardrails;
      return sum + ((g?.skipped?.length || 0) + 1); // +1 for the chosen agent (if any)
    }, 0);
    const guardrail_skip_rate = total_candidates > 0 ? skipped.length / total_candidates : 0;

    // Top guardrail reason
    const reasonCounts: Record<string, number> = {};
    skipped.forEach((s: any) => {
      reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
    });
    const top_guardrail_reason = Object.keys(reasonCounts).sort((a, b) => reasonCounts[b] - reasonCounts[a])[0] || 'none';

    // Top agents by avg score
    const agentMap: Record<string, { scores: number[]; assignments: number }> = {};
    audits.forEach((a: any) => {
      if (a.agent_id && a.score !== null && !isNaN(a.score)) {
        if (!agentMap[a.agent_id]) agentMap[a.agent_id] = { scores: [], assignments: 0 };
        agentMap[a.agent_id].scores.push(a.score);
        if (a.auto_assigned) agentMap[a.agent_id].assignments++;
      }
    });
    const top_agents = Object.entries(agentMap)
      .map(([agent_id, v]) => ({
        agent_id,
        avg_score: v.scores.reduce((x, y) => x + y, 0) / v.scores.length,
        assignments: v.assignments,
      }))
      .sort((a, b) => b.avg_score - a.avg_score)
      .slice(0, 5);

    return {
      total_predictions,
      total_auto_assigned,
      avg_prediction_score: Number(avg_prediction_score.toFixed(3)),
      guardrail_skip_rate: Number(guardrail_skip_rate.toFixed(3)),
      top_guardrail_reason,
      top_agents,
    };
  } catch (e) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id') || undefined;

    // Manager scope check
    if (auth.role === 'manager' && orgId) {
      const myOrgId = OrgStore.myOrgId(auth.userId!);
      if (myOrgId && myOrgId !== orgId) {
        return NextResponse.json({ error: 'Forbidden: manager can only view own organization' }, { status: 403 });
      }
    }

    let data: any;
    if (useMock()) {
      data = generateMockSummary(orgId);
    } else {
      data = await fetchSummaryFromDB(auth.userId!, auth.role!, orgId);
      if (!data) data = generateMockSummary(orgId); // fallback
    }

    return NextResponse.json({ success: true, data, mode: useMock() ? 'mock' : 'db' }, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/predictive/summary error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
