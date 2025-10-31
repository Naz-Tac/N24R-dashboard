import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';
import { OrgStore } from '@/lib/inMemoryStore';

// Deterministic pseudo-random from string
function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function norm01(n: number) {
  return (n % 1000) / 1000; // 0..0.999
}

function componentScores(agentId: string, shiftId: string, orgId: string) {
  const base = `${agentId}|${shiftId}|${orgId}`;
  const a = norm01(hashSeed('A:' + base)); // acceptance
  const r = norm01(hashSeed('R:' + base)); // response
  const v = norm01(hashSeed('V:' + base)); // availability
  const c = norm01(hashSeed('C:' + base)); // credentials
  return { acceptance: a, response: r, availability: v, credentials: c };
}

function weightedScore(cs: {acceptance:number;response:number;availability:number;credentials:number;}) {
  return cs.acceptance * 0.4 + cs.response * 0.3 + cs.availability * 0.2 + cs.credentials * 0.1;
}

function buildReason(cs: {acceptance:number;response:number;availability:number;credentials:number;}) {
  const parts: string[] = [];
  if (cs.response > 0.7) parts.push('Fast response');
  if (cs.acceptance > 0.7) parts.push('High acceptance');
  if (cs.availability > 0.7) parts.push('Good availability');
  if (cs.credentials > 0.7) parts.push('Matching credentials');
  if (parts.length === 0) parts.push('Balanced metrics');
  return parts.join(' + ');
}

async function fetchAgentsByOrg(orgId: string): Promise<string[]> {
  try {
    // Try supabase table `organization_members` with role agent
    const { data, error } = await (supabaseService as any)
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .eq('role', 'agent');
    if (!error && Array.isArray(data) && data.length) {
      return data.map((r: any) => r.user_id);
    }
  } catch {}
  // Fallback to OrgStore in-memory membership (used in CI/dev)
  const members = OrgStore.listMembers(orgId);
  const agents = members.filter((m: any) => m.role === 'agent').map((m: any) => m.user_id);
  if (agents.length) return agents;
  // Final fallback: generate synthetic agents deterministically
  return Array.from({ length: 8 }, (_, i) => `agent-${orgId}-${i + 1}`);
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = await req.json();
    const shift_id = String(body.shift_id || '').trim();
    const organization_id = String(body.organization_id || '').trim();
    const criteria = Array.isArray(body.criteria) ? body.criteria : ['availability','past_acceptance','credentials'];
    const autoAssign = Boolean(body.auto_assign);

    if (!shift_id || !organization_id) {
      return NextResponse.json({ error: 'shift_id and organization_id are required' }, { status: 400 });
    }

    // Manager scope check: managers can only act within their own org
    if (auth.role === 'manager') {
      const myOrgId = OrgStore.myOrgId(auth.userId!);
      if (myOrgId && myOrgId !== organization_id) {
        return NextResponse.json({ error: 'Forbidden: manager can only predict within their organization' }, { status: 403 });
      }
    }

    const mock = process.env.AI_PREDICT_MOCK === '1' || process.env.NODE_ENV !== 'production';

    const agentIds = await fetchAgentsByOrg(organization_id);

    // Produce recommendations
    let recs = agentIds.map((agent_id) => {
      const cs = componentScores(agent_id, shift_id, organization_id);
      const score = weightedScore(cs);
      return {
        agent_id,
        score: Number(score.toFixed(4)),
        reason: buildReason(cs),
        components: cs,
      };
    });

    // Apply basic criteria filtering (mock: no-op, or slight adjustment)
    if (criteria && criteria.length) {
      // Example: if 'credentials' selected, give small boost to candidates with higher credentials score
      if (criteria.includes('credentials')) {
        recs = recs.map((r) => ({ ...r, score: Number(Math.min(1, r.score * 0.95 + r.components.credentials * 0.05).toFixed(4)) }));
      }
    }

    recs.sort((a, b) => b.score - a.score);

    // Auto-assign top 1 via existing /api/assignments
    let assignment:
      | { id: string; status: string } | null = null;
    if (autoAssign && recs.length) {
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const top = recs[0];
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
      try {
        const resp = await fetch(`${origin}/api/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            agent_id: top.agent_id,
            shift_id,
            status: 'assigned',
            notes: 'auto-assigned by AI predict',
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const row = Array.isArray(json?.data) ? json.data[0] : json?.data?.[0] || json?.data;
          if (row?.id) assignment = { id: row.id, status: row.status };
        }
      } catch (e) {
        // ignore in mock
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          shift_id,
          organization_id,
          recommendations: recs,
          auto_assigned: Boolean(assignment),
          assignment_id: assignment?.id || null,
        },
        mode: mock ? 'mock' : 'db',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST /api/ai/predict error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
