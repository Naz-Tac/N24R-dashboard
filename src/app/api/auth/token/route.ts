import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { signAgentToken, verifyAgentToken } from '@/lib/agentToken';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['agent']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const ttl = parseInt(process.env.AGENT_TOKEN_TTL_SECONDS || '86400', 10);
  const token = signAgentToken({ sub: auth.userId!, role: 'agent' }, ttl);
  const parsed = verifyAgentToken(token);
  return NextResponse.json({ success: true, token, exp: parsed.exp });
}
