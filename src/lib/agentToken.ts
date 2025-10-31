// Lightweight HMAC token for agent API
// Structure: base64url(payload).base64url(exp).base64url(sig)
// sig = HMACSHA256(secret, payload + '.' + exp)

import crypto from 'crypto';

export type AgentTokenPayload = {
  sub: string; // agent user id
  role: 'agent';
  scope?: string[]; // optional scopes
};

function base64url(input: Buffer | string) {
  return (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64');
}

function getSecret(): string {
  return (
    process.env.AGENT_TOKEN_SECRET ||
    process.env.INTERNAL_AUTOFILL_TOKEN ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'dev-secret'
  );
}

export function signAgentToken(payload: AgentTokenPayload, ttlSeconds?: number) {
  const ttl = ttlSeconds ?? parseInt(process.env.AGENT_TOKEN_TTL_SECONDS || '86400', 10);
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const header = JSON.stringify(payload);
  const payloadB64 = base64url(header);
  const expB64 = base64url(Buffer.from(String(exp)));
  const data = `${payloadB64}.${expB64}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(data).digest();
  const sigB64 = base64url(sig);
  return `${payloadB64}.${expB64}.${sigB64}`;
}

export function verifyAgentToken(token: string): { ok: boolean; sub?: string; exp?: number; error?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { ok: false, error: 'malformed' };
    const [payloadB64, expB64, sigB64] = parts;
    const data = `${payloadB64}.${expB64}`;
    const expected = base64url(crypto.createHmac('sha256', getSecret()).update(data).digest());
    if (expected !== sigB64) return { ok: false, error: 'bad_signature' };
    const exp = parseInt(fromBase64url(expB64).toString('utf8'), 10);
    if (!Number.isFinite(exp)) return { ok: false, error: 'bad_exp' };
    if (Date.now() / 1000 > exp) return { ok: false, error: 'expired' };
    const payload = JSON.parse(fromBase64url(payloadB64).toString('utf8')) as AgentTokenPayload;
    if (payload.role !== 'agent' || !payload.sub) return { ok: false, error: 'bad_payload' };
    return { ok: true, sub: payload.sub, exp };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'error' };
  }
}
