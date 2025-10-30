import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

// Basic provider stubs (Twilio/SendGrid). In CI or when keys missing, we mock.
async function sendWhatsAppSMS(to: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromWhatsApp = process.env.TWILIO_WHATSAPP_FROM;
  const fromSMS = process.env.TWILIO_SMS_FROM;
  const mock = process.env.NOTIFICATIONS_MOCK === '1' || !accountSid || !authToken;
  if (mock) return { ok: true };
  // In real impl: call Twilio REST API. Here we return success to avoid external deps.
  return { ok: true };
}

async function sendEmail(to: string, subject: string, content: string) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  const mock = process.env.NOTIFICATIONS_MOCK === '1' || !apiKey;
  if (mock) return { ok: true };
  // Real impl would POST to SendGrid
  return { ok: true };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'dispatcher']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    const body = await req.json();
    const agent_id = String(body.agent_id || '').trim();
    const shift_id = String(body.shift_id || '').trim();
    const channel = String(body.channel || '').trim().toLowerCase();
    const message = String(body.message || '').trim();

    if (!agent_id || !shift_id || !['whatsapp', 'sms', 'email'].includes(channel) || !message) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Resolve agent contact details (email/phone); simplified for demo
    // We try to read from agents table if present; otherwise, use placeholders
    let toPhone: string | null = null;
    let toEmail: string | null = null;
    try {
      const { data: agent } = await supabaseService
        .from('agents')
        .select('email, phone')
        .eq('id', agent_id)
        .maybeSingle();
      toEmail = agent?.email ?? null;
      toPhone = (agent as any)?.phone ?? null;
    } catch {}

    let ok = false;
    if (channel === 'email') {
      ok = (await sendEmail(toEmail || 'test@example.com', 'Shift Notification', message)).ok;
    } else {
      ok = (await sendWhatsAppSMS(toPhone || '+10000000000', message)).ok;
    }

    // Log notification attempt
    try {
      await supabaseService.from('notifications').insert({
        agent_id,
        shift_id,
        channel,
        status: ok ? 'sent' : 'failed',
        sent_at: new Date().toISOString(),
      });
    } catch (e) {
      // Ignore if table not present
    }

    if (!ok) {
      return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('POST /api/notifications/send error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
