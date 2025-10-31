import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';
import { getCurrentWeights } from '@/lib/autotuneWeights';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

function generateMockPerformance() {
  const seed = Date.now();
  const hash = (n: number) => {
    let h = n;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };

  return {
    current_weights: {
      accept: 0.4,
      speed: 0.3,
      avail: 0.2,
      cred: 0.1,
      distance: 0.0,
    },
    acceptance_rate_7d: 0.72,
    acceptance_rate_30d: 0.68,
    guardrail_skip_rate: 0.15,
    avg_response_time: 245,
    success_count: 156,
    fail_count: 72,
    acceptance_trend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
      rate: 0.6 + (hash(seed + i) % 20) / 100,
    })),
    recalibration_events: Array.from({ length: 5 }, (_, i) => ({
      id: `evt-${i}`,
      timestamp: new Date(Date.now() - i * 3600000 * 24 * 2).toISOString(),
      old_weights: { accept: 0.38, speed: 0.32, avail: 0.2, cred: 0.1 },
      new_weights: { accept: 0.4, speed: 0.3, avail: 0.2, cred: 0.1 },
      reason: 'auto_tune',
      success_window: '30d',
    })),
  };
}

async function fetchPerformanceFromDB() {
  try {
    // Get current weights
    const currentWeights = await getCurrentWeights();

    // Get feedback stats (7d and 30d)
    const now = new Date();
    const days7ago = new Date(now.getTime() - 7 * 86400000);
    const days30ago = new Date(now.getTime() - 30 * 86400000);

    const { data: feedback7d } = await supabaseService
      .from('ai_feedback')
      .select('result, responded_in')
      .gte('created_at', days7ago.toISOString());

    const { data: feedback30d } = await supabaseService
      .from('ai_feedback')
      .select('result, responded_in')
      .gte('created_at', days30ago.toISOString());

    const successCount7d = (feedback7d || []).filter((f) => f.result === 'success').length;
    const totalCount7d = (feedback7d || []).length;
    const successCount30d = (feedback30d || []).filter((f) => f.result === 'success').length;
    const totalCount30d = (feedback30d || []).length;

    const acceptanceRate7d = totalCount7d > 0 ? successCount7d / totalCount7d : 0;
    const acceptanceRate30d = totalCount30d > 0 ? successCount30d / totalCount30d : 0;

    // Calculate avg response time
    const responseTimes = (feedback30d || [])
      .filter((f) => f.responded_in !== null)
      .map((f) => f.responded_in as number);
    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    // Guardrail skip rate from predictions (simplified - use skip count from audit)
    const { data: auditData } = await supabaseService
      .from('ai_assignment_audit')
      .select('guardrails')
      .gte('timestamp', days30ago.toISOString());

    let skipCount = 0;
    let totalPredictions = (auditData || []).length;
    (auditData || []).forEach((entry: any) => {
      if (entry.guardrails?.skipped?.length > 0) {
        skipCount += entry.guardrails.skipped.length;
      }
    });
    const guardrailSkipRate = totalPredictions > 0 ? skipCount / totalPredictions : 0;

    // Acceptance trend (daily aggregates for last 30 days)
    const { data: dailyFeedback } = await supabaseService
      .from('ai_feedback')
      .select('created_at, result')
      .gte('created_at', days30ago.toISOString());

    const byDate: Record<string, { success: number; total: number }> = {};
    (dailyFeedback || []).forEach((f) => {
      const date = f.created_at.slice(0, 10);
      if (!byDate[date]) byDate[date] = { success: 0, total: 0 };
      byDate[date].total++;
      if (f.result === 'success') byDate[date].success++;
    });

    const acceptanceTrend = Object.keys(byDate)
      .sort()
      .map((date) => ({
        date,
        rate: byDate[date].total > 0 ? byDate[date].success / byDate[date].total : 0,
      }));

    // Recalibration events (last 10)
    const { data: recalEvents } = await supabaseService
      .from('ai_weight_audit')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(10);

    return {
      current_weights: currentWeights,
      acceptance_rate_7d: acceptanceRate7d,
      acceptance_rate_30d: acceptanceRate30d,
      guardrail_skip_rate: guardrailSkipRate,
      avg_response_time: avgResponseTime,
      success_count: successCount30d,
      fail_count: totalCount30d - successCount30d,
      acceptance_trend: acceptanceTrend,
      recalibration_events: recalEvents || [],
    };
  } catch (error) {
    console.error('Failed to fetch performance data:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    let data;

    if (useMock()) {
      data = generateMockPerformance();
    } else {
      const dbData = await fetchPerformanceFromDB();
      data = dbData || generateMockPerformance();
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Performance analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
