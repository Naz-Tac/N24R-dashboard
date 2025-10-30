import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- type declarations may be missing at lint time in CI
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Server-side (Node runtime) client using next/headers cookies
export function createSupabaseServerClient() {
  const cookieStore: any = cookies() as any;
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get?.(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // In server components and route handlers, cookies() may be read-only
        // Wrap in try/catch and use the object form to satisfy Next types
        try {
          (cookieStore as unknown as { set: (init: any) => void }).set({ name, value, ...options });
        } catch {
          // ignore when setting isn't allowed in this context
        }
      },
      remove(name: string, options: any) {
        try {
          (cookieStore as unknown as { set: (init: any) => void }).set({ name, value: '', ...options, maxAge: 0 });
        } catch {
          // ignore when setting isn't allowed
        }
      },
    },
  });
  return client;
}

// Edge/Middleware runtime client using NextRequest/NextResponse cookies
export function createSupabaseMiddlewareClient(req: NextRequest, res: NextResponse) {
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        // Reflect set on the response so the browser stores updated session cookies
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: '', ...options, maxAge: 0 });
      },
    },
  });
  return client;
}

// Helper: fetch current session on the server
export async function getSession() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return { session: null, error } as const;
  return { session: data.session, error: null } as const;
}

// Helper: fetch current user on the server
export async function getUser() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error } as const;
  return { user: data.user, error: null } as const;
}
