import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

function logMock(channel: string, payload: any) {
  const ts = new Date().toISOString();
  console.log(`[MOCK:${channel}] ${ts}`, JSON.stringify(payload));
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await req.json();
    const { to, channel, message, shift_id, type } = body || {};

    if (!to || !channel || !message) {
      return NextResponse.json({ error: 'to, channel, and message are required' }, { status: 400 });
    }

    const notifyMock = process.env.NOTIFY_MOCK === '1';
    const channelMock =
      channel === 'whatsapp' ? process.env.WHATSAPP_MOCK === '1' :
      channel === 'sms' ? process.env.SMS_MOCK === '1' :
      process.env.PUSH_MOCK === '1';

    if (notifyMock || channelMock) {
      logMock(channel, { to, type: type || 'generic', message, shift_id });
    }

    // Insert into agent_notifications
    try {
      await supabaseService.from('agent_notifications').insert({
        agent_id: to,
        type: type || 'generic',
        message,
        channel,
        delivered_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to insert agent_notifications', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('push error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
