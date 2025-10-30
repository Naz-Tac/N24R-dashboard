import { NextRequest, NextResponse } from "next/server";
import { supabase, supabaseService } from "@/lib/supabaseClient";
import type { AgentAvailability, AvailabilityResponse } from "../../../app/availability/types";
import { requireRole } from "@/lib/rbac";

// Handle GET requests
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'agent']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    const { data, error } = await supabaseService
      .from("agent_availability")
      .select("*")
      .order('availability_date', { ascending: false });

    if (error) {
      console.error("GET error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data, error: null }, { status: 200 });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Handle POST requests
export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(request, ['admin', 'agent']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    console.log('📝 POST request to /api/availability');
    // Runtime env validation to avoid silent failures in CI
    const srkPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const urlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    const clientUsable = typeof (supabaseService as any)?.from === 'function';
    console.log('🔧 Supabase runtime check:', {
      srkPresent,
      urlPresent,
      clientUsable,
    });
    if (!srkPresent || !urlPresent || !clientUsable) {
      console.error('❌ Supabase client not properly configured at runtime');
      return NextResponse.json({
        error: 'Supabase not configured at runtime',
        details: {
          srkPresent,
          urlPresent,
          clientUsable,
        }
      }, { status: 500 });
    }
  const body = await request.json();

    // Normalize time strings to HH:mm:ss (Postgres time type friendly)
    const normalizeTime = (t: unknown): string => {
      if (typeof t !== 'string') return '';
      // If already has seconds, return as-is
      if (/^\d{2}:\d{2}:\d{2}$/.test(t)) return t;
      // If HH:mm, append :00
      if (/^\d{2}:\d{2}$/.test(t)) return `${t}:00`;
      // Fallback: try to coerce, else empty
      const m = /^\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*$/.exec(t);
      if (m) {
        const hh = String(Math.min(23, parseInt(m[1], 10))).padStart(2, '0');
        const mm = String(Math.min(59, parseInt(m[2], 10))).padStart(2, '0');
        const ss = String(Math.min(59, m[3] ? parseInt(m[3], 10) : 0)).padStart(2, '0');
        return `${hh}:${mm}:${ss}`;
      }
      return '';
    };

    const record: Omit<AgentAvailability, 'id'> & { notes?: string | null } = {
      agent_name: String(body.agent_name ?? '').trim(),
      availability_date: String(body.availability_date ?? '').trim(),
      start_time: normalizeTime(body.start_time).trim(),
      end_time: normalizeTime(body.end_time).trim(),
      // Ensure explicit null handling for notes
      notes: body.notes === undefined ? null : (body.notes === null ? null : String(body.notes).trim())
    };

    console.log('🧾 Sanitized payload:', record);

    const { data, error } = await supabaseService
      .from("agent_availability")
      .insert([record])
      .select();

    if (error) {
      // Log error details for debugging
      console.error("❌ Insert error:", error);
      console.error("🔍 Error details:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      return NextResponse.json(
        {
          error: error.message || error.details || "Unknown error",
          code: error.code,
          details: error.details,
        },
        { status: 400 }
      );
    }

    console.log('✅ Inserted availability:', data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
