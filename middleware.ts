import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- type declarations may be missing at lint time in CI
import { createServerClient } from '@supabase/ssr';
import { supabaseService } from '@/lib/supabaseClient';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

async function getUserRole(userId: string) {
  try {
    const { data, error } = await supabaseService
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return null;
  return data?.role as 'admin' | 'dispatcher' | 'agent' | 'manager' | undefined;
  } catch {
    return undefined;
  }
}

function isApiPath(path: string) {
  return path.startsWith('/api/');
}

function isPublicPath(path: string) {
  // Public auth pages and health checks, plus static assets
  return (
    path.startsWith('/signin') ||
    path.startsWith('/signup') ||
    path.startsWith('/auth') ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/availability/health') ||
    path.startsWith('/_next') ||
    path.startsWith('/favicon') ||
    path.startsWith('/images') ||
    path.startsWith('/public')
  );
}

function checkAccess(path: string, role: string | undefined) {
  if (!role) return false;
  // Admin group: require admin or dispatcher
  if (
    path.startsWith('/dashboard') ||
    path.startsWith('/agents') ||
    path.startsWith('/shifts') ||
    path.startsWith('/assignments') ||
    path.startsWith('/settings') ||
    path.startsWith('/analytics')
  ) {
    // AI Analytics: admin and manager only
    if (path.startsWith('/analytics/ai')) {
      return role === 'admin' || role === 'manager';
    }
    // General analytics: admin, manager, dispatcher
    if (path.startsWith('/analytics')) {
      return role === 'admin' || role === 'manager' || role === 'dispatcher';
    }
    return role === 'admin' || role === 'dispatcher';
  }
  // Agent group: require agent (allow admins/dispatchers too)
  if (path.startsWith('/availability') || path.startsWith('/agent')) {
    return role === 'agent' || role === 'admin' || role === 'dispatcher';
  }
    // Org manager group
    if (path.startsWith('/org')) {
      return role === 'manager' || role === 'admin' || role === 'dispatcher';
    }
  // AI assistant API: all authenticated roles
  if (path.startsWith('/api/ai/')) {
    return role === 'admin' || role === 'dispatcher' || role === 'manager' || role === 'agent';
  }
  // API routes are handled primarily by route-level RBAC; allow here
  if (path.startsWith('/api/')) return true;
  // Default: allow
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  const role = await getUserRole(user.id);
  const allowed = checkAccess(pathname, role || undefined);
  if (!allowed) {
    if (isApiPath(pathname)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/signin';
    url.searchParams.set('error', 'forbidden');
    url.searchParams.set('next', '/availability');
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    '/dashboard',
    '/agents',
    '/shifts',
    '/assignments',
    '/settings/:path*',
    '/availability',
    '/agent/:path*',
    '/analytics/:path*',
     '/org/:path*',
    '/api/:path*',
  ],
};
