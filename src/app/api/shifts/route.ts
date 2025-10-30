import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to normalize time format to HH:MM:SS
function normalizeTime(time: string): string {
  const trimmed = time.trim();
  // If already HH:MM:SS, return as-is
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // If HH:MM, append :00
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  // If H:MM, prepend 0
  if (/^\d{1}:\d{2}$/.test(trimmed)) {
    return `0${trimmed}:00`;
  }
  return trimmed; // Return as-is and let validation catch invalid formats
}

// GET - List all shifts
export async function GET() {
  try {
    const { data, error } = await supabaseService
      .from('shifts')
      .select('*')
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Supabase GET error:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch shifts',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('GET /api/shifts error:', err);
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

// POST - Create new shift
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, start_time, end_time, location, notes } = body;

    // Validate required fields
    if (!date?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'date is required',
        },
        { status: 400 }
      );
    }

    if (!start_time?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'start_time is required',
        },
        { status: 400 }
      );
    }

    if (!end_time?.trim()) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'MISSING_FIELD',
          details: 'end_time is required',
        },
        { status: 400 }
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          code: 'INVALID_DATE',
          details: 'date must be in YYYY-MM-DD format',
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseService
      .from('shifts')
      .insert({
        date: date.trim(),
        start_time: normalizeTime(start_time),
        end_time: normalizeTime(end_time),
        location: location?.trim() || null,
        notes: notes?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase POST error:', error);
      return NextResponse.json(
        {
          error: 'Failed to create shift',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err) {
    console.error('POST /api/shifts error:', err);
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

// PUT - Update shift
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, date, start_time, end_time, location, notes } = body;

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

    if (date !== undefined) {
      if (!date?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'date cannot be empty',
          },
          { status: 400 }
        );
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date.trim())) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_DATE',
            details: 'date must be in YYYY-MM-DD format',
          },
          { status: 400 }
        );
      }
      updates.date = date.trim();
    }

    if (start_time !== undefined) {
      if (!start_time?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'start_time cannot be empty',
          },
          { status: 400 }
        );
      }
      updates.start_time = normalizeTime(start_time);
    }

    if (end_time !== undefined) {
      if (!end_time?.trim()) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            code: 'INVALID_FIELD',
            details: 'end_time cannot be empty',
          },
          { status: 400 }
        );
      }
      updates.end_time = normalizeTime(end_time);
    }

    if (location !== undefined) {
      updates.location = location?.trim() || null;
    }

    if (notes !== undefined) {
      updates.notes = notes?.trim() || null;
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
      .from('shifts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase PUT error:', error);
      return NextResponse.json(
        {
          error: 'Failed to update shift',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (err) {
    console.error('PUT /api/shifts error:', err);
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

// DELETE - Remove shift
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
      .from('shifts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase DELETE error:', error);
      return NextResponse.json(
        {
          error: 'Failed to delete shift',
          code: error.code,
          details: error.message,
        },
        { status: 400 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/shifts error:', err);
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
