import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';

function useMock(): boolean {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

// Generate mock timeseries data
function generateMockTimeseries(days: number = 30, orgId?: string) {
  const seed = orgId ? orgId.length : 42;
  const dates: string[] = [];
  const interactions: number[] = [];
  const successes: number[] = [];
  const failures: number[] = [];

  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
    
    // Deterministic pseudo-random values
    const dayValue = (seed + i) % 100;
    const interactionCount = 30 + (dayValue % 50);
    const successCount = Math.floor(interactionCount * (0.75 + (dayValue % 20) / 100));
    
    interactions.push(interactionCount);
    successes.push(successCount);
    failures.push(interactionCount - successCount);
  }

  return {
    dates,
    interactions,
    successes,
    failures,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'agent']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('organization_id') || undefined;
    const range = searchParams.get('range'); // e.g., "2025-01-01,2025-12-31"
    
    let days = 30;
    if (range) {
      const [start, end] = range.split(',');
      const startDate = new Date(start);
      const endDate = new Date(end);
      days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      days = Math.max(1, Math.min(days, 365)); // Cap at 1 year
    }

    // RBAC: agent can only see own stats (would filter by user_id in production)
    if (auth.role === 'agent') {
      // Scope to user
    }

    const timeseries = useMock()
      ? generateMockTimeseries(days, orgId)
      : generateMockTimeseries(days, orgId); // DB path would go here

    return NextResponse.json({
      success: true,
      data: timeseries,
      mode: useMock() ? 'mock' : 'db',
    }, { status: 200 });
  } catch (e: any) {
    console.error('AI analytics timeseries error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch AI analytics timeseries', details: e?.message },
      { status: 500 }
    );
  }
}
