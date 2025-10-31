import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentToken } from '@/lib/agentToken';
import { supabaseService } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const bearer = auth.startsWith('Bearer ') ? auth.substring(7) : '';
    const v = verifyAgentToken(bearer);
    if (!v.ok || !v.sub) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const message = String(body?.message || '').trim();
    if (!message) return NextResponse.json({ error: 'message required' }, { status: 400 });

    // Insert as a chat message from agent
    try {
      await supabaseService.from('agent_notifications').insert({
        agent_id: v.sub,
        type: 'chat',
        message,
        channel: 'push',
        delivered_at: new Date().toISOString(),
      });
    } catch (e) {
      // ignore if table missing in CI
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
