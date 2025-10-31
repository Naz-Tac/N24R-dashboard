import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.CHAT_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const { searchParams } = new URL(req.url);
  const agentId = String(searchParams.get('agent_id') || '').trim();
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });

  try {
    if (useMock()) {
      const now = Date.now();
      const msgs = [
        { id: 'm1', agent_id: agentId, type: 'chat', from: 'manager', message: 'Hello, status update?', created_at: new Date(now - 60_000).toISOString() },
        { id: 'm2', agent_id: agentId, type: 'chat', from: 'agent', message: 'En route. ETA 10m.', created_at: new Date(now - 30_000).toISOString() },
      ];
      return NextResponse.json({ success: true, data: msgs });
    }

    const { data, error } = await supabaseService
      .from('agent_notifications')
      .select('id, agent_id, type, message, created_at, delivered_at, read_at')
      .eq('agent_id', agentId)
      .eq('type', 'chat')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const msgs = (data || []).map((d: any) => ({
      id: d.id,
      agent_id: d.agent_id,
      type: d.type,
      from: 'agent',
      message: d.message,
      created_at: d.created_at || d.delivered_at,
      read_at: d.read_at,
    }));
    return NextResponse.json({ success: true, data: msgs });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
