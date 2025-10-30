import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseService } from '@/lib/supabaseClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

export type Role = 'admin' | 'dispatcher' | 'agent' | null;

export async function getUserFromRequest(req: NextRequest) {
  // Try Authorization: Bearer <access_token>
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring('Bearer '.length);
    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        return data.user;
      }
    }
  }
  return null;
}

export async function getUserRole(userId: string): Promise<Role> {
  try {
    const { data, error } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('RBAC: error fetching role', error);
      return null;
    }
    return (data?.role as Role) ?? null;
  } catch (e) {
    console.error('RBAC: fatal error fetching role', e);
    return null;
  }
}

export async function requireRole(req: NextRequest, allowed: Role[]) {
  // Get user from Authorization header (CI-friendly)
  const user = await getUserFromRequest(req);
  if (!user) {
    return { ok: false, status: 401 as const, message: 'Unauthorized' };
  }
  const role = await getUserRole(user.id);
  if (!role) {
    return { ok: false, status: 403 as const, message: 'Forbidden: no role' };
  }
  if (!allowed.includes(role)) {
    return { ok: false, status: 403 as const, message: `Forbidden: requires ${allowed.join(' or ')}` };
  }
  return { ok: true as const, userId: user.id, role };
}
