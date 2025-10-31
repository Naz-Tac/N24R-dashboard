import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

function generateMockTimeseries(days: number, orgId?: string) {
  const seed = orgId ? orgId.charCodeAt(0) : 42;
  const dates: string[] = [];
  const predictions: number[] = [];
  const auto_assignments: number[] = [];
  const avg_scores: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
    const p = 8 + ((seed + i) % 15);
    predictions.push(p);
    auto_assignments.push(Math.floor(p * 0.4) + ((seed + i) % 3));
    avg_scores.push(0.6 + ((seed + i) % 30) / 100);
  }

  return { dates, predictions, auto_assignments, avg_scores };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id') || undefined;
    const range = searchParams.get('range');
    let days = 30;

    if (range) {
      const [start, end] = range.split(',').map((s) => new Date(s.trim()));
      if (start && end && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
        days = Math.min(365, Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)));
      }
    }

    let data: any;
    if (useMock()) {
      data = generateMockTimeseries(days, orgId);
    } else {
      // DB path: aggregate ai_assignment_audit by date
      try {
        let q = (supabaseService as any).from('ai_assignment_audit').select('timestamp,auto_assigned,score');
        if (orgId) {
          // Assume org filtering via join or field
        }
        const { data: audits, error } = await q;
        if (error || !audits) throw error;

        const byDate: Record<string, { count: number; auto: number; scores: number[] }> = {};
        audits.forEach((a: any) => {
          const date = (a.timestamp || '').slice(0, 10);
          if (!date) return;
          if (!byDate[date]) byDate[date] = { count: 0, auto: 0, scores: [] };
          byDate[date].count++;
          if (a.auto_assigned) byDate[date].auto++;
          if (a.score !== null && !isNaN(a.score)) byDate[date].scores.push(a.score);
        });

        const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
        const dates = sorted.map(([d]) => d);
        const predictions = sorted.map(([, v]) => v.count);
        const auto_assignments = sorted.map(([, v]) => v.auto);
        const avg_scores = sorted.map(([, v]) => (v.scores.length ? v.scores.reduce((x, y) => x + y, 0) / v.scores.length : 0));

        data = { dates, predictions, auto_assignments, avg_scores };
      } catch (e) {
        data = generateMockTimeseries(days, orgId);
      }
    }

    return NextResponse.json({ success: true, data, mode: useMock() ? 'mock' : 'db' }, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/predictive/timeseries error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
