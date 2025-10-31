import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { AiMemoryStore, AiMemoryEntry } from '@/lib/inMemoryStore';
import { supabaseService } from '@/lib/supabaseClient';

// Helper: try to persist to Supabase if table exists; fail silently
async function persistToSupabase(row: Omit<AiMemoryEntry, 'id'>) {
  try {
    // If service client not configured, skip
    // @ts-ignore - supabaseService may be a dummy object
    if (!supabaseService || !('from' in supabaseService)) return;
    const { error } = await supabaseService.from('ai_memory').insert({
      user_id: row.user_id,
      role: row.role,
      timestamp: row.timestamp,
      type: row.type,
      content: row.content,
      intent: row.intent || null,
      action: row.action || null,
      action_details: row.action_details || null,
    });
    if (error) {
      // Table may not exist in CI; ignore
      console.warn('ai_memory insert skipped:', error.message);
    }
  } catch (e) {
    // ignore
  }
}

function canViewOthers(role: string) {
  return role === 'admin' || role === 'manager' || role === 'dispatcher';
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager', 'agent']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50);
    const user_id = searchParams.get('user_id') || auth.userId!;
    const forceFallback = searchParams.get('fallback') === '1';

    if (user_id !== auth.userId && !canViewOthers(auth.role!)) {
      return NextResponse.json({ error: 'Forbidden: cannot view other users\' memory' }, { status: 403 });
    }

    // Opportunistic purge of old records (>30 days)
    await AiMemoryStore.purgeOlderThan(30);

    const { source, rows } = await AiMemoryStore.getRecent(user_id, limit, { forceFallback });
    return NextResponse.json({ success: true, data: rows, source }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to fetch memory', details: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager', 'agent']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const body = await req.json();
    const entry: Omit<AiMemoryEntry, 'id'> = {
      user_id: auth.userId!,
      role: auth.role!,
      timestamp: new Date().toISOString(),
      type: (body.type || 'user_message') as AiMemoryEntry['type'],
      content: String(body.content || ''),
      intent: body.intent || 'none',
      action: body.action || null,
      action_details: body.action_details || null,
    };
    const { source, row } = await AiMemoryStore.append(entry, { forceFallback: !!body?.force_fallback });
    // Opportunistic purge
    await AiMemoryStore.purgeOlderThan(30);
    return NextResponse.json({ success: true, data: row, source }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to write memory', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager', 'agent']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get('user_id') || auth.userId!;
  const forceFallback = searchParams.get('fallback') === '1';

    if (targetUserId !== auth.userId) {
      // Only admin can clear others' memory
      if (auth.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden: only admin can clear other users\' memory' }, { status: 403 });
      }
    }

    const { source, deleted } = await AiMemoryStore.clearUser(targetUserId, { forceFallback });
    return NextResponse.json({ success: true, deleted, source }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to clear memory', details: e?.message }, { status: 500 });
  }
}
