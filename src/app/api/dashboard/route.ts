import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseClient";

/**
 * Dashboard API endpoint
 * Combines agent_availability and assignments data
 * Supports filtering by date and status via query params
 */

interface DashboardRecord {
  agent_id?: string;
  agent_name: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  assignment_status: string;
  notes?: string | null;
}

export async function GET(request: Request) {
  try {
    console.log('📊 GET request to /api/dashboard');
    
    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url);
    const dateFilter = searchParams.get('date');
    const statusFilter = searchParams.get('status');

    console.log('🔍 Filters:', { date: dateFilter, status: statusFilter });

    // For this implementation, we'll fetch availability and assignments separately
    // then merge them in-memory. In production, you might use a database view or more complex JOIN.
    
    // Fetch availability records
    let availabilityQuery = supabaseService
      .from('agent_availability')
      .select('*')
      .order('availability_date', { ascending: false });

    if (dateFilter) {
      availabilityQuery = availabilityQuery.eq('availability_date', dateFilter);
    }

    const { data: availabilityData, error: availError } = await availabilityQuery;

    if (availError) {
      console.error('❌ Availability query error:', availError);
      return NextResponse.json({
        error: availError.message,
        code: availError.code,
        details: availError.details
      }, { status: 500 });
    }

    // Fetch assignments records
    const { data: assignmentsData, error: assignError } = await supabaseService
      .from('assignments')
      .select('*');

    if (assignError) {
      console.error('❌ Assignments query error:', assignError);
      return NextResponse.json({
        error: assignError.message,
        code: assignError.code,
        details: assignError.details
      }, { status: 500 });
    }

    // Create a map of agent assignments by agent_name (simplified; in production use agent_id)
    const assignmentMap = new Map<string, any>();
    if (assignmentsData) {
      assignmentsData.forEach((assignment: any) => {
        // In a real implementation, you'd JOIN on agent_id
        // For now, we'll use a simplified approach
        assignmentMap.set(assignment.agent_id, assignment);
      });
    }

    // Merge availability with assignment status
    const dashboardData: DashboardRecord[] = (availabilityData || []).map((avail: any) => {
      const assignment = assignmentMap.get(avail.agent_name); // Simplified: should use agent_id
      
      return {
        agent_id: avail.agent_name, // In production, this would be a UUID
        agent_name: avail.agent_name,
        availability_date: avail.availability_date,
        start_time: avail.start_time,
        end_time: avail.end_time,
        assignment_status: assignment ? assignment.status : 'unassigned',
        notes: assignment ? assignment.notes : avail.notes
      };
    });

    // Apply status filter if provided
    let filteredData = dashboardData;
    if (statusFilter) {
      filteredData = dashboardData.filter(
        record => record.assignment_status === statusFilter
      );
    }

    console.log(`✅ Returning ${filteredData.length} dashboard records`);
    return NextResponse.json({ success: true, data: filteredData }, { status: 200 });

  } catch (err) {
    console.error('Dashboard API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
