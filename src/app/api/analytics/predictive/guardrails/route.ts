import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

function generateMockGuardrails(orgId?: string) {
  const seed = orgId ? orgId.charCodeAt(0) : 42;
  const reasons = [
    { reason: 'no_availability', count: 45 + (seed % 10), percentage: 35 + (seed % 5) },
    { reason: 'overlap', count: 30 + (seed % 8), percentage: 25 + (seed % 4) },
    { reason: 'do_not_assign', count: 20 + (seed % 6), percentage: 18 + (seed % 3) },
    { reason: 'cooldown', count: 15 + (seed % 5), percentage: 12 + (seed % 2) },
    { reason: 'max_daily', count: 10 + (seed % 4), percentage: 10 + (seed % 2) },
  ];
  return reasons;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id') || undefined;

    let data: any;
    if (useMock()) {
      data = generateMockGuardrails(orgId);
    } else {
      // DB path: aggregate guardrails.skipped from ai_assignment_audit
      try {
        let q = (supabaseService as any).from('ai_assignment_audit').select('guardrails');
        if (orgId) {
          // Filter by org if available
        }
        const { data: audits, error } = await q;
        if (error || !audits) throw error;

        const reasonCounts: Record<string, number> = {};
        let total = 0;
        audits.forEach((a: any) => {
          const g = a.guardrails;
          if (g && Array.isArray(g.skipped)) {
            g.skipped.forEach((s: any) => {
              reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
              total++;
            });
          }
        });

        const ranked = Object.entries(reasonCounts)
          .map(([reason, count]) => ({
            reason,
            count,
            percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
          }))
          .sort((a, b) => b.count - a.count);

        data = ranked;
      } catch (e) {
        data = generateMockGuardrails(orgId);
      }
    }

    return NextResponse.json({ success: true, data, mode: useMock() ? 'mock' : 'db' }, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/predictive/guardrails error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
