import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseClient";
import type { Assignment } from "../../assignments/types";
import { requireRole } from "@/lib/rbac";

// Handle GET requests - fetch assignments with optional joins
export async function GET(req: NextRequest) {
  try {
    console.log('📝 GET request to /api/assignments');
  const auth = await requireRole(req, ['admin', 'dispatcher', 'manager']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    // Fetch assignments ordered by assigned_at descending
    // In production, you might want to join with agents and shift_requests tables
    const { data, error } = await supabaseService
      .from("assignments")
      .select("*")
      .order('assigned_at', { ascending: false });

    if (error) {
      console.error("GET error:", error);
      return NextResponse.json({ 
        error: error.message,
        code: error.code,
        details: error.details
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Handle POST requests - insert new assignment
export async function POST(request: NextRequest) {
  try {
    console.log('📝 POST request to /api/assignments');
  const auth = await requireRole(request, ['admin', 'dispatcher', 'manager']);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    // Runtime env validation
    const srkPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const urlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
    const clientUsable = typeof (supabaseService as any)?.from === 'function';
    
    if (!srkPresent || !urlPresent || !clientUsable) {
      console.error('❌ Supabase client not properly configured at runtime');
      return NextResponse.json({
        error: 'Supabase not configured at runtime',
        details: { srkPresent, urlPresent, clientUsable }
      }, { status: 500 });
    }

  const body = await request.json();

    // Validate required fields
    if (!body.agent_id || !body.shift_id || !body.status) {
      return NextResponse.json({
        error: 'Missing required fields: agent_id, shift_id, and status are required',
        details: {
          agent_id: !!body.agent_id,
          shift_id: !!body.shift_id,
          status: !!body.status
        }
      }, { status: 400 });
    }

    // Build sanitized record with trimmed strings and explicit null handling
    const record: Omit<Assignment, 'id' | 'assigned_at'> = {
      agent_id: String(body.agent_id ?? '').trim(),
      shift_id: String(body.shift_id ?? '').trim(),
      status: String(body.status ?? '').trim(),
      // Ensure explicit null handling for notes
      notes: body.notes === undefined ? null : (body.notes === null ? null : String(body.notes).trim())
    };

    console.log('🧾 Sanitized payload:', record);

    const { data, error } = await supabaseService
      .from("assignments")
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

    console.log('✅ Inserted assignment:', data);
    // Fire-and-forget: log a notification for the agent (mock-friendly)
    try {
      const created = Array.isArray(data) ? data[0] : data;
      if (created && created.agent_id) {
        await supabaseService.from('agent_notifications').insert({
          agent_id: created.agent_id,
          type: 'shift_assigned',
          message: `You have a new shift (${created.shift_id})`,
          channel: 'push',
          delivered_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('Notification insert failed (non-blocking)', e);
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
