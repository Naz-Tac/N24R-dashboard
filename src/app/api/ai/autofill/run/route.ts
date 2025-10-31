import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';

// Background autofill cron endpoint (no auth for scheduled triggers; use secret instead)
export async function POST(req: NextRequest) {
  try {
    const enabled = process.env.AI_AUTOFILL_ENABLED === '1';
    if (!enabled) {
      return NextResponse.json({ success: false, message: 'autofill disabled' }, { status: 200 });
    }

    // Optional secret check for cron jobs
    const body = await req.json().catch(() => ({}));
    const cronSecret = process.env.AUTOFILL_CRON_SECRET;
    if (cronSecret && body.secret !== cronSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const limit = Number(process.env.AI_AUTOFILL_LIMIT || 5);

    // Fetch all orgs and run autofill for each
    let orgs: any[] = [];
    try {
      const { data, error } = await (supabaseService as any).from('organizations').select('id');
      if (!error && Array.isArray(data)) orgs = data;
    } catch {}

    const results: any[] = [];
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Use admin service role token for internal calls
    const internalToken = process.env.INTERNAL_AUTOFILL_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;

    for (const org of orgs) {
      try {
        const resp = await fetch(`${origin}/api/ai/autofill`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${internalToken}`,
          },
          body: JSON.stringify({ organization_id: org.id, limit }),
        });
        const json = await resp.json();
        results.push({ org_id: org.id, filled: json?.data?.filled?.length || 0, skipped: json?.data?.skipped?.length || 0 });
      } catch (e) {
        results.push({ org_id: org.id, error: String(e) });
      }
    }

    return NextResponse.json({ success: true, data: { results } }, { status: 200 });
  } catch (err) {
    console.error('POST /api/ai/autofill/run error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
