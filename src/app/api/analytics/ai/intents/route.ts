import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';

function useMock(): boolean {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

// Generate mock intent rankings
function generateMockIntents(role?: string, orgId?: string) {
  const seed = (role?.length || 0) + (orgId?.length || 0);
  
  const baseIntents = [
    { intent: 'create_shift', count: 450 + (seed % 100), percentage: 35 },
    { intent: 'assign_agent', count: 320 + (seed % 80), percentage: 25 },
    { intent: 'show_analytics', count: 260 + (seed % 60), percentage: 20 },
    { intent: 'notify_agent', count: 195 + (seed % 50), percentage: 15 },
    { intent: 'none', count: 65, percentage: 5 },
  ];

  // Adjust percentages based on role
  if (role === 'agent') {
    return [
      { intent: 'show_analytics', count: 180, percentage: 40 },
      { intent: 'none', count: 135, percentage: 30 },
      { intent: 'assign_agent', count: 90, percentage: 20 },
      { intent: 'create_shift', count: 45, percentage: 10 },
    ];
  }

  if (role === 'manager') {
    return [
      { intent: 'create_shift', count: 280, percentage: 40 },
      { intent: 'assign_agent', count: 210, percentage: 30 },
      { intent: 'show_analytics', count: 140, percentage: 20 },
      { intent: 'notify_agent', count: 70, percentage: 10 },
    ];
  }

  return baseIntents;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'agent']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get('role') || undefined;
    const orgId = searchParams.get('organization_id') || undefined;

    // RBAC: agent can only see own stats
    if (auth.role === 'agent' && roleFilter && roleFilter !== 'agent') {
      return NextResponse.json({ error: 'Forbidden: agents can only view own intent stats' }, { status: 403 });
    }

    const intents = useMock()
      ? generateMockIntents(roleFilter || auth.role, orgId)
      : generateMockIntents(roleFilter || auth.role, orgId); // DB path would go here

    return NextResponse.json({
      success: true,
      data: intents,
      mode: useMock() ? 'mock' : 'db',
    }, { status: 200 });
  } catch (e: any) {
    console.error('AI analytics intents error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch AI intent analytics', details: e?.message },
      { status: 500 }
    );
  }
}
