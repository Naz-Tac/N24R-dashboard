import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function useMock() {
  return process.env.NOTIFY_MOCK === '1' || process.env.NODE_ENV !== 'production';
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await req.json();
    const { agent_ids, message, channel = 'push', type = 'chat' } = body || {};

    if (!message || !['push', 'sms', 'whatsapp'].includes(channel)) {
      return NextResponse.json({ error: 'Invalid payload: message and valid channel required' }, { status: 400 });
    }

    let targets: string[] = [];
    if (agent_ids === 'all') {
      try {
        const { data } = await supabaseService.from('agents').select('id');
        targets = (data || []).map((r: any) => r.id);
      } catch {
        // fallback: no agents
        targets = [];
      }
    } else if (Array.isArray(agent_ids)) {
      targets = agent_ids.filter((id: any) => typeof id === 'string' && id.trim().length > 0);
    }

    if (!targets.length && !useMock()) {
      return NextResponse.json({ error: 'No valid target agents' }, { status: 400 });
    }

    if (useMock()) {
      const count = targets.length || 10; // pretend 10 for broadcast in mock
      return NextResponse.json({ success: true, delivered: count });
    }

    const rows = targets.map((agentId) => ({
      agent_id: agentId,
      type,
      message,
      channel,
      delivered_at: new Date().toISOString(),
    }));
    if (rows.length) {
      await supabaseService.from('agent_notifications').insert(rows);
    }
    return NextResponse.json({ success: true, delivered: rows.length });
  } catch (e) {
    console.error('manager notify error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
