import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { assignment_id, result, reason, responded_in } = body;

    if (!assignment_id || !result) {
      return NextResponse.json(
        { error: 'assignment_id and result are required' },
        { status: 400 }
      );
    }

    if (!['success', 'fail'].includes(result)) {
      return NextResponse.json(
        { error: 'result must be "success" or "fail"' },
        { status: 400 }
      );
    }

    // Fetch assignment to get agent_id and shift_id
    const { data: assignment, error: assignmentError } = await supabaseService
      .from('assignments')
      .select('agent_id, shift_id')
      .eq('id', assignment_id)
      .maybeSingle();

    if (assignmentError || !assignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // Insert feedback
    const { data: feedback, error: feedbackError } = await supabaseService
      .from('ai_feedback')
      .insert({
        agent_id: assignment.agent_id,
        shift_id: assignment.shift_id,
        assignment_id,
        result,
        reason: reason || null,
        responded_in: responded_in || null,
      })
      .select()
      .single();

    if (feedbackError) {
      console.error('Failed to insert feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: feedback,
    });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
