import { NextResponse } from "next/server";
import { supabase, supabaseService } from "@/lib/supabaseClient";
import type { AgentAvailability, AvailabilityResponse } from "../../../app/availability/types";

// Handle GET requests
export async function GET() {
  try {
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
export async function POST(request: Request) {
  try {
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
    
    const record: Omit<AgentAvailability, 'id'> = {
      agent_name: body.agent_name,
      availability_date: body.availability_date,
      start_time: body.start_time,
      end_time: body.end_time
    };

    const { data, error } = await supabaseService
      .from("agent_availability")
      .insert([record])
      .select();

    if (error) {
      console.error("❌ Insert error:", error);
      console.error("🔍 Error details:", {
        code: error.code,
        message: error.message,
        details: error.details
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
    return NextResponse.json({ message: "Availability added", data }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}