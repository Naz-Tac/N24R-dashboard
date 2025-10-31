import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentToken, signAgentToken } from '@/lib/agentToken';
import { requireRole } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  const hdr = req.headers.get('authorization') || '';
  const token = hdr.startsWith('Bearer ') ? hdr.substring(7) : '';
  let sub: string | undefined;

  if (token) {
    const v = verifyAgentToken(token);
    if (v.ok) sub = v.sub;
  }

  if (!sub) {
    // Fallback: if logged-in agent, issue a fresh token
    const auth = await requireRole(req, ['agent']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
    sub = auth.userId!;
  }

  const ttl = parseInt(process.env.AGENT_TOKEN_TTL_SECONDS || '86400', 10);
  const newToken = signAgentToken({ sub, role: 'agent' }, ttl);
  return NextResponse.json({ success: true, token: newToken });
}
