import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';

export async function POST() {
  // Cron-safe mockable reminders runner
  const enabled = process.env.NOTIFY_MOCK === '1';
  if (!enabled) {
    return NextResponse.json({ success: true, message: 'Reminders disabled' });
  }

  try {
    // Heuristic: find assignments still in 'assigned' status and created ~2h ago
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

    const { data: assigns } = await supabaseService
      .from('assignments')
      .select('*')
      .eq('status', 'assigned')
      .gte('assigned_at', threeHoursAgo)
      .lte('assigned_at', twoHoursAgo)
      .limit(100);

    let sent = 0;
    for (const a of assigns || []) {
      try {
        await supabaseService.from('agent_notifications').insert({
          agent_id: a.agent_id,
          type: 'reminder',
          message: `Reminder: upcoming shift ${a.shift_id}`,
          channel: 'push',
          delivered_at: new Date().toISOString(),
        });
        sent++;
      } catch {}
    }

    return NextResponse.json({ success: true, sent });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 });
  }
}
