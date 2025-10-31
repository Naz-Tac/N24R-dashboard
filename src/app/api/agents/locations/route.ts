import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.AI_ANALYTICS_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    if (useMock()) {
      const baseLat = 37.7749;
      const baseLng = -122.4194;
      const now = Date.now();
      const agents = Array.from({ length: 8 }).map((_, i) => ({
        id: `agent-${i + 1}`,
        name: `Agent ${i + 1}`,
        status: i % 3 === 0 ? 'on_duty' : i % 3 === 1 ? 'en_route' : 'idle',
        lat: baseLat + (Math.sin(i) * 0.05),
        lng: baseLng + (Math.cos(i) * 0.05),
        last_seen: new Date(now - (i + 1) * 30_000).toISOString(),
      }));
      return NextResponse.json({ success: true, data: agents });
    }

    // Try to fetch from agent_locations table with agent status; tolerate absence
    const { data: locs, error } = await supabaseService
      .from('agent_locations')
      .select('agent_id, lat, lng, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100);

    const locations = (locs || []).map((r: any, idx: number) => ({
      id: r.agent_id,
      name: `Agent ${idx + 1}`,
      status: 'on_duty',
      lat: r.lat,
      lng: r.lng,
      last_seen: r.updated_at,
    }));

    return NextResponse.json({ success: true, data: locations });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
