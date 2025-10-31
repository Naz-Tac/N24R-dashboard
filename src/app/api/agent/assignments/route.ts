import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { verifyAgentToken } from '@/lib/agentToken';
import { requireRole } from '@/lib/rbac';

async function getAgentId(req: NextRequest): Promise<string | null> {
  const hdr = req.headers.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.substring(7) : '';
  if (token) {
    const v = verifyAgentToken(token);
    if (v.ok && v.sub) return v.sub;
  }
  const auth = await requireRole(req, ['agent']);
  if (auth.ok) return auth.userId!;
  return null;
}

export async function GET(req: NextRequest) {
  const agentId = await getAgentId(req);
  if (!agentId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Fetch recent assignments for this agent
    const { data: assigns, error: aerr } = await supabaseService
      .from('assignments')
      .select('*')
      .eq('agent_id', agentId)
      .order('assigned_at', { ascending: false })
      .limit(50);

    if (aerr) throw aerr;

    // Categorize
    const nowISO = new Date().toISOString();
    const accepted = (assigns || []).filter((a: any) => (a.status || '').toLowerCase() === 'accepted');
    const upcoming = (assigns || []).filter((a: any) => (a.status || '').toLowerCase() === 'assigned');

    // Notifications feed
    const { data: notes, error: nerr } = await supabaseService
      .from('agent_notifications')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(30);
    if (nerr) throw nerr;

    return NextResponse.json({
      success: true,
      data: {
        accepted,
        upcoming,
        notifications: notes || [],
        now: nowISO,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
