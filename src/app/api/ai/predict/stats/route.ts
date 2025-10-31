import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const mock = process.env.AI_PREDICT_MOCK === '1' || process.env.NODE_ENV !== 'production';

  // Deterministic mock stats
  const seed = 42;
  const total_predictions = 100 + (seed % 25);
  const auto_assignments = 35 + (seed % 10);
  const avg_score = 0.72;

  return NextResponse.json({
    success: true,
    data: { total_predictions, auto_assignments, avg_score },
    mode: mock ? 'mock' : 'db',
  });
}
