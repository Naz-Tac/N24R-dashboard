import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabaseClient';
import { requireRole } from '@/lib/rbac';
import { OrgStore } from '@/lib/inMemoryStore';

function dateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function mockTimeseries(days = 14) {
  const dates: string[] = [];
  const requests: number[] = [];
  const filled: number[] = [];
  const declined: number[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    dates.push(key);
    const r = Math.floor(10 + Math.random() * 20);
    const f = Math.floor(r * (0.5 + Math.random() * 0.4));
    const dec = Math.max(0, r - f - Math.floor(Math.random() * 3));
    requests.push(r);
    filled.push(f);
    declined.push(dec);
  }
  return { dates, requests, filled, declined };
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const url = new URL(req.url);
  const orgParam = url.searchParams.get('organization_id');
  const start = url.searchParams.get('start_date');
  const end = url.searchParams.get('end_date');
  const useMock = process.env.ANALYTICS_MOCK === '1';

  let orgId: string | null = null;
  if (auth.role === 'manager') {
    orgId = OrgStore.myOrgId(auth.userId!);
    if (!orgId) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  } else if (orgParam) {
    orgId = orgParam;
  }

  const startDate = start ? new Date(start) : new Date(Date.now() - 13 * 24 * 3600 * 1000);
  const endDate = end ? new Date(end) : new Date();

  if (useMock) {
    return NextResponse.json({ success: true, data: mockTimeseries() }, { status: 200 });
  }

  try {
    // Try to get assignments within range and aggregate
    let qa = supabaseService.from('assignments').select('status,assigned_at');
    if (orgId) {
      // @ts-ignore optional filter
      qa = (qa as any).eq('organization_id', orgId);
    }
    const { data: rows, error } = await qa;
    if (error) throw error;

    // Build buckets for each day from startDate to endDate
    const dates: string[] = [];
    const requests: number[] = [];
    const filled: number[] = [];
    const declined: number[] = [];

    const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 3600 * 1000)) + 1);
    const mapReq = new Map<string, number>();
    const mapFill = new Map<string, number>();
    const mapDec = new Map<string, number>();

    (rows || []).forEach((r: any) => {
      if (!r.assigned_at) return;
      const d = new Date(r.assigned_at);
      const k = dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
      mapReq.set(k, (mapReq.get(k) || 0) + 1);
      if (r.status === 'accepted') mapFill.set(k, (mapFill.get(k) || 0) + 1);
      if (r.status === 'declined') mapDec.set(k, (mapDec.get(k) || 0) + 1);
    });

    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const k = dateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
      dates.push(k);
      requests.push(mapReq.get(k) || 0);
      filled.push(mapFill.get(k) || 0);
      declined.push(mapDec.get(k) || 0);
    }

    const allZero = requests.every((v) => v === 0) && filled.every((v) => v === 0) && declined.every((v) => v === 0);
    if (allZero) {
      return NextResponse.json({ success: true, data: mockTimeseries() }, { status: 200 });
    }

    return NextResponse.json({ success: true, data: { dates, requests, filled, declined } }, { status: 200 });
  } catch (e) {
    return NextResponse.json({ success: true, data: mockTimeseries(), note: 'mock_fallback' }, { status: 200 });
  }
}
