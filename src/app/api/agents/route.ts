import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// GET - List all agents
export async function GET() {
  try {
    const { data, error } = await supabaseService
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch agents',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('GET /api/agents error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// POST - Create new agent
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role, status } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'name is required',
        },
        { status: 400 }
      );
    }

    if (!email?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'email is required',
        },
        { status: 400 }
      );
    }

    if (!role?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'role is required',
        },
        { status: 400 }
      );
    }

    if (!status?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'status is required',
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'INVALID_EMAIL',
          details: 'email must be a valid email address',
        },
        { status: 400 }
      );
    }

    // Validate status enum
    const validStatuses = ['active', 'inactive', 'on_leave'];
    if (!validStatuses.includes(status.trim().toLowerCase())) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'INVALID_STATUS',
          details: `status must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseService
      .from('agents')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role.trim(),
        status: status.trim().toLowerCase(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase POST error:', error);
      return NextResponse.json(
        {
          error: 'Failed to create agent',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/agents error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// PUT - Update agent
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, email, role, status } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'id is required',
        },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};

    if (name !== undefined) {
      if (!name?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'name cannot be empty',
          },
          { status: 400 }
        );
      }
      updates.name = name.trim();
    }

    if (email !== undefined) {
      if (!email?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'email cannot be empty',
          },
          { status: 400 }
        );
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_EMAIL',
            details: 'email must be a valid email address',
          },
          { status: 400 }
        );
      }
      updates.email = email.trim().toLowerCase();
    }

    if (role !== undefined) {
      if (!role?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'role cannot be empty',
          },
          { status: 400 }
        );
      }
      updates.role = role.trim();
    }

    if (status !== undefined) {
      if (!status?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'status cannot be empty',
          },
          { status: 400 }
        );
      }
      const validStatuses = ['active', 'inactive', 'on_leave'];
      if (!validStatuses.includes(status.trim().toLowerCase())) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_STATUS',
            details: `status must be one of: ${validStatuses.join(', ')}`,
          },
          { status: 400 }
        );
      }
      updates.status = status.trim().toLowerCase();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'NO_UPDATES',
          details: 'No valid fields to update',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseService
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase PUT error:', error);
      return NextResponse.json(
        {
          error: 'Failed to update agent',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('PUT /api/agents error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove agent
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'id parameter is required',
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseService
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase DELETE error:', error);
      return NextResponse.json(
        {
          error: 'Failed to delete agent',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/agents error:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
