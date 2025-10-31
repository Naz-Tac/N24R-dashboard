import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { supabaseService } from '@/lib/supabaseClient';
import { OrgStore } from '@/lib/inMemoryStore';

// Deterministic pseudo-random from string
function hashSeed(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function norm01(n: number) {
  return (n % 1000) / 1000; // 0..0.999
}

function componentScores(agentId: string, shiftId: string, orgId: string) {
  const base = `${agentId}|${shiftId}|${orgId}`;
  const a = norm01(hashSeed('A:' + base)); // acceptance
  const r = norm01(hashSeed('R:' + base)); // response
  const v = norm01(hashSeed('V:' + base)); // availability
  const c = norm01(hashSeed('C:' + base)); // credentials
  return { acceptance: a, response: r, availability: v, credentials: c };
}

function getEnvNumber(name: string, def: number) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function weightedScore(cs: {acceptance:number;response:number;availability:number;credentials:number; distance?: number}) {
  const WA = getEnvNumber('AI_WEIGHT_ACCEPT', 0.4);
  const WS = getEnvNumber('AI_WEIGHT_SPEED', 0.3);
  const WV = getEnvNumber('AI_WEIGHT_AVAIL', 0.2);
  const WC = getEnvNumber('AI_WEIGHT_CRED', 0.1);
  const WD = getEnvNumber('AI_DISTANCE_WEIGHT', 0);
  return cs.acceptance * WA + cs.response * WS + cs.availability * WV + cs.credentials * WC + (cs.distance || 0) * WD;
}

function buildReason(cs: {acceptance:number;response:number;availability:number;credentials:number;}) {
  const parts: string[] = [];
  if (cs.response > 0.7) parts.push('Fast response');
  if (cs.acceptance > 0.7) parts.push('High acceptance');
  if (cs.availability > 0.7) parts.push('Good availability');
  if (cs.credentials > 0.7) parts.push('Matching credentials');
  if (parts.length === 0) parts.push('Balanced metrics');
  return parts.join(' + ');
}

async function fetchAgentsByOrg(orgId: string): Promise<string[]> {
  try {
    // Try supabase table `organization_members` with role agent
    const { data, error } = await (supabaseService as any)
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', orgId)
      .eq('role', 'agent');
    if (!error && Array.isArray(data) && data.length) {
      return data.map((r: any) => r.user_id);
    }
  } catch {}
  // Fallback to OrgStore in-memory membership (used in CI/dev)
  const members = OrgStore.listMembers(orgId);
  const agents = members.filter((m: any) => m.role === 'agent').map((m: any) => m.user_id);
  if (agents.length) return agents;
  // Final fallback: generate synthetic agents deterministically
  return Array.from({ length: 8 }, (_, i) => `agent-${orgId}-${i + 1}`);
}

type ShiftWin = { date: string; start_time: string; end_time: string; location?: string | null };
async function getShiftWindow(shiftId: string, orgId: string): Promise<ShiftWin> {
  // Try DB 'shifts'
  try {
    const { data, error } = await (supabaseService as any)
      .from('shifts')
      .select('date,start_time,end_time,location')
      .eq('id', shiftId)
      .maybeSingle();
    if (!error && data) return data as ShiftWin;
  } catch {}
  // Fallback to in-memory
  try {
    const s = OrgStore.listShifts(orgId).find((ss: any) => ss.id === shiftId);
    if (s) return { date: s.date, start_time: s.start_time, end_time: s.end_time, location: s.location ?? null };
  } catch {}
  // Default placeholder: today 09:00–17:00
  const today = new Date().toISOString().slice(0, 10);
  return { date: today, start_time: '09:00', end_time: '17:00', location: null };
}

async function fetchAgentRecords(agentIds: string[]) {
  try {
    const { data, error } = await (supabaseService as any)
      .from('agents')
      .select('id,status,do_not_assign,home_base,credentials')
      .in('id', agentIds);
    if (!error && Array.isArray(data)) return data;
  } catch {}
  return [] as any[];
}

async function fetchAvailability(agentIds: string[], date: string) {
  try {
    const { data, error } = await (supabaseService as any)
      .from('agent_availability')
      .select('agent_id,date,start_time,end_time')
      .in('agent_id', agentIds)
      .eq('date', date);
    if (!error && Array.isArray(data)) return data;
  } catch {}
  return [] as any[];
}

async function fetchAssignments(agentIds: string[]) {
  try {
    const { data, error } = await (supabaseService as any)
      .from('assignments')
      .select('id,agent_id,shift_id,status,assigned_at,responded_at,updated_at')
      .in('agent_id', agentIds);
    if (!error && Array.isArray(data)) return data;
  } catch {}
  return [] as any[];
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function overlaps(winA: { start_time: string; end_time: string }, winB: { start_time: string; end_time: string }) {
  const a1 = hhmmToMinutes(winA.start_time);
  const a2 = hhmmToMinutes(winA.end_time);
  const b1 = hhmmToMinutes(winB.start_time);
  const b2 = hhmmToMinutes(winB.end_time);
  return Math.max(a1, b1) < Math.min(a2, b2);
}

function within(availability: { start_time: string; end_time: string } | undefined, win: { start_time: string; end_time: string }) {
  if (!availability) return false;
  return hhmmToMinutes(availability.start_time) <= hhmmToMinutes(win.start_time) && hhmmToMinutes(availability.end_time) >= hhmmToMinutes(win.end_time);
}

function mockBlend(dbScore: number | null | undefined, mockScore: number) {
  if (dbScore === null || dbScore === undefined || Number.isNaN(dbScore)) return mockScore;
  // Blend 70% db, 30% mock for stability
  return 0.7 * dbScore + 0.3 * mockScore;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['admin', 'manager', 'dispatcher']);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = await req.json();
    const shift_id = String(body.shift_id || '').trim();
    const organization_id = String(body.organization_id || '').trim();
  const criteria = Array.isArray(body.criteria) ? body.criteria : ['availability','past_acceptance','credentials'];
  const autoAssign = Boolean(body.auto_assign);
  const dryRun = Boolean(body.dry_run);

    if (!shift_id || !organization_id) {
      return NextResponse.json({ error: 'shift_id and organization_id are required' }, { status: 400 });
    }

    // Manager scope check: managers can only act within their own org
    if (auth.role === 'manager') {
      const myOrgId = OrgStore.myOrgId(auth.userId!);
      if (myOrgId && myOrgId !== organization_id) {
        return NextResponse.json({ error: 'Forbidden: manager can only predict within their organization' }, { status: 403 });
      }
    }

    const mock = process.env.AI_PREDICT_MOCK === '1' || process.env.NODE_ENV !== 'production';

    const agentIds = await fetchAgentsByOrg(organization_id);
    const shiftWin = await getShiftWindow(shift_id, organization_id);
    const agentsMeta = await fetchAgentRecords(agentIds);
    const availability = await fetchAvailability(agentIds, shiftWin.date);
    const history = await fetchAssignments(agentIds);

    // Build recommendations with DB-first components
    let recs = agentIds.map((agent_id) => {
      const mockCs = componentScores(agent_id, shift_id, organization_id);

      // Acceptance rate
      const hist = history.filter((h: any) => h.agent_id === agent_id);
      const accepted = hist.filter((h: any) => (h.status || '').toLowerCase() === 'accepted').length;
      const declined = hist.filter((h: any) => (h.status || '').toLowerCase() === 'declined').length;
      const total = accepted + declined;
      const dbAccept = total > 0 ? accepted / total : null;

      // Response speed (lower is better): convert to 0..1 with simple mapping
      const speeds: number[] = [];
      hist.forEach((h: any) => {
        const a = h.assigned_at ? Date.parse(h.assigned_at) : NaN;
        const r = h.responded_at ? Date.parse(h.responded_at) : NaN;
        if (!Number.isNaN(a) && !Number.isNaN(r) && r >= a) {
          const minutes = (r - a) / 60000;
          // Map: 0 min => 1, 60 min => ~0, clamp
          const s = Math.max(0, Math.min(1, 1 - minutes / 60));
          speeds.push(s);
        }
      });
      const dbSpeed = speeds.length ? speeds.reduce((x, y) => x + y, 0) / speeds.length : null;

      // Availability match: find availability covering shift window
      const av = availability.find((av: any) => av.agent_id === agent_id);
      const availOk = within(av, shiftWin);
      const dbAvail = availOk ? 1 : 0; // if we have record

      // Credentials: if agent has credentials array and shift requires? Fallback to mock
      const agentMeta = agentsMeta.find((a: any) => a.id === agent_id) || {};
      const credDb = Array.isArray(agentMeta.credentials) ? Math.min(1, (agentMeta.credentials.length || 0) / 5) : null;

      // Distance: placeholder 0..1 based on strings
      let distanceScore: number | undefined;
      const shiftLoc = (shiftWin.location || '') as string;
      const home = (agentMeta.home_base || '') as string;
      if (shiftLoc && home) {
        // Simple similarity proxy
        distanceScore = home === shiftLoc ? 1 : home && shiftLoc && home[0] === shiftLoc[0] ? 0.6 : 0.3;
      }

      const cs = {
        acceptance: mockBlend(dbAccept, mockCs.acceptance),
        response: mockBlend(dbSpeed, mockCs.response),
        availability: av ? mockBlend(dbAvail, mockCs.availability) : mockCs.availability,
        credentials: mockBlend(credDb, mockCs.credentials),
        distance: distanceScore,
      };

      const score = weightedScore(cs);
      return {
        agent_id,
        score: Number(score.toFixed(4)),
        reason: buildReason(cs),
        components: cs,
        meta: agentMeta,
      };
    });

    // Guardrails evaluation
    const cooldownMin = getEnvNumber('AI_COOLDOWN_MINUTES', 30);
    const maxDaily = getEnvNumber('AI_MAX_DAILY_SHIFTS', 2);
    const guardrails = { skipped: [] as Array<{ agent_id: string; reason: string }>, applied: [] as string[] };

    const dateStr = shiftWin.date;
    const sameDateShifts = async (shiftIds: string[]) => {
      // Map shift_id -> window for overlap checks
      const map = new Map<string, ShiftWin>();
      for (const sid of shiftIds) {
        const win = await getShiftWindow(sid, organization_id);
        if (win.date === dateStr) map.set(sid, win);
      }
      return map;
    };

    // Preload shift windows for existing assignments on this date per agent
    const byAgent: Record<string, any[]> = {};
    history.forEach((h: any) => {
      (byAgent[h.agent_id] ||= []).push(h);
    });
    const allShiftIds = Array.from(new Set(history.map((h: any) => h.shift_id).filter(Boolean)));
    const shiftMap = await sameDateShifts(allShiftIds);

    const filtered: typeof recs = [];
    for (const r of recs) {
      const meta = r.meta || {};
      // DND
      if (meta.do_not_assign === true) {
        guardrails.skipped.push({ agent_id: r.agent_id, reason: 'do_not_assign' });
        continue;
      }
      // Inactive
      if (meta.status && meta.status !== 'active') {
        guardrails.skipped.push({ agent_id: r.agent_id, reason: 'inactive' });
        continue;
      }
      const histA = (byAgent[r.agent_id] || []) as any[];
      // Max daily and overlap require windows of same date
      const todays = histA.filter((h) => {
        const w = shiftMap.get(h.shift_id);
        return w && w.date === dateStr && ['accepted', 'assigned'].includes((h.status || '').toLowerCase());
      });
      if (todays.length >= maxDaily) {
        guardrails.skipped.push({ agent_id: r.agent_id, reason: 'max_daily' });
        continue;
      }
      // Overlap
      let overlap = false;
      for (const t of todays) {
        const w = shiftMap.get(t.shift_id)!;
        if (overlaps({ start_time: shiftWin.start_time, end_time: shiftWin.end_time }, w)) {
          overlap = true; break;
        }
      }
      if (overlap) {
        guardrails.skipped.push({ agent_id: r.agent_id, reason: 'overlap' });
        continue;
      }
      // Cooldown since last decline
      const declines = histA
        .filter((h) => (h.status || '').toLowerCase() === 'declined')
        .map((h) => Date.parse(h.responded_at || h.updated_at || ''))
        .filter((t) => Number.isFinite(t));
      if (declines.length) {
        const last = Math.max(...declines);
        const minsAgo = (Date.now() - last) / 60000;
        if (minsAgo < cooldownMin) {
          guardrails.skipped.push({ agent_id: r.agent_id, reason: 'cooldown' });
          continue;
        }
      }
      // Availability fit (must cover window)
      const av = availability.find((a: any) => a.agent_id === r.agent_id);
      if (!within(av, shiftWin)) {
        guardrails.skipped.push({ agent_id: r.agent_id, reason: 'no_availability' });
        continue;
      }

      // Passed all guardrails; annotate badges
      (r as any).badges = ['No overlaps', 'Cooldown OK', 'Availability OK'];
      filtered.push(r);
    }

    // Apply criteria: slight boost for credentials if requested
    if (criteria.includes('credentials')) {
      filtered.forEach((r) => {
        r.score = Number(Math.min(1, r.score * 0.95 + (r as any).components.credentials * 0.05).toFixed(4));
      });
    }

    filtered.sort((a, b) => b.score - a.score);

    // Auto-assign top 1 via existing /api/assignments
    let assignment:
      | { id: string; status: string } | null = null;
    let assignedAgent: string | null = null;
    if (!dryRun && autoAssign && filtered.length) {
      const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const top = filtered[0];
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
      try {
        const resp = await fetch(`${origin}/api/assignments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authHeader,
          },
          body: JSON.stringify({
            agent_id: top.agent_id,
            shift_id,
            status: 'assigned',
            notes: 'auto-assigned by AI predict',
          }),
        });
        if (resp.ok) {
          const json = await resp.json();
          const row = Array.isArray(json?.data) ? json.data[0] : json?.data?.[0] || json?.data;
          if (row?.id) { assignment = { id: row.id, status: row.status }; assignedAgent = top.agent_id; }
        }
      } catch (e) {
        // ignore in mock
      }
    }

    // Insert audit when auto_assign or dry_run
    if ((autoAssign || dryRun)) {
      try {
        await (supabaseService as any)
          .from('ai_assignment_audit')
          .insert({
            shift_id,
            agent_id: assignedAgent || (filtered[0]?.agent_id || null),
            score: filtered[0]?.score || null,
            criteria: { criteria },
            guardrails,
            auto_assigned: Boolean(assignment),
            role: auth.role,
            user_id: auth.userId,
          });
      } catch {}
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          shift_id,
          organization_id,
          recommendations: filtered,
          auto_assigned: Boolean(assignment),
          assignment_id: assignment?.id || null,
          guardrails,
          dry_run: dryRun,
        },
        mode: mock ? 'mock' : 'db',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('POST /api/ai/predict error', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
