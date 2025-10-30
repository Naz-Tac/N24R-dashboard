"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { showNotification } from '@/components/Notifications';
import { supabase as realtimeClient, useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import { createClient } from '@supabase/supabase-js';

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  notes?: string | null;
}

interface Assignment {
  id: string;
  agent_id: string;
  shift_id: string;
  status: string;
  notes?: string | null;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const browserClient = createClient(supabaseUrl, supabaseAnonKey);

export default function AgentDashboardPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch current user/session
  useEffect(() => {
    (async () => {
      const { data: userData } = await browserClient.auth.getUser();
      const { data: sessionData } = await browserClient.auth.getSession();
      setUserId(userData.user?.id ?? null);
      setAccessToken(sessionData.session?.access_token ?? null);
    })();
  }, []);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch this agent's assignments
      const { data: myAssignments, error: aErr } = await realtimeClient
        .from('assignments')
        .select('*')
        .eq('agent_id', userId)
        .order('assigned_at', { ascending: false });
      if (aErr) throw aErr;

      setAssignments(myAssignments || []);

      // Fetch all assignments (to determine which shifts are taken)
      const { data: allAssignments, error: allErr } = await realtimeClient
        .from('assignments')
        .select('shift_id,status');
      if (allErr) throw allErr;

      // Fetch all shifts
      const { data: allShifts, error: sErr } = await realtimeClient
        .from('shifts')
        .select('*')
        .order('date', { ascending: true });
      if (sErr) throw sErr;

      // Compute available: not assigned or declined only
      const takenShiftIds = new Set(
        (allAssignments || [])
          .filter((a) => ['assigned', 'accepted'].includes((a as any).status))
          .map((a) => (a as any).shift_id)
      );
      const available = (allShifts || []).filter((s) => !takenShiftIds.has(s.id));
      setShifts(available);
    } catch (e: any) {
      console.error('[AgentDashboard] fetch error', e);
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime changes on assignments relevant to this agent
  useRealtimeUpdates<Assignment>({
    table: 'assignments',
    enabled: !!userId,
    onChange: () => {
      // Brief debounce; refresh data
      const t = setTimeout(fetchData, 500);
      return () => clearTimeout(t);
    },
  });

  const respond = async (assignmentId: string, action: 'accept' | 'decline') => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/assignments/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Request failed: ${res.status} ${body}`);
      }
      // optimistic update
      setAssignments((prev) => prev.map((a) => (a.id === assignmentId ? { ...a, status: action === 'accept' ? 'accepted' : 'declined' } : a)));
    } catch (e) {
      console.error('respond error', e);
      showNotification('Failed to update assignment status', 'delete');
      return;
    }
    showNotification(`Shift ${action === 'accept' ? 'accepted' : 'declined'}`, 'success');
  };

  const assigned = useMemo(() => assignments, [assignments]);
  const available = useMemo(() => shifts, [shifts]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Agent Dashboard</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
            <h2 className="text-lg font-medium mb-3">My Assignments</h2>
            {assigned.length === 0 ? (
              <div className="text-sm text-gray-500">No assignments yet.</div>
            ) : (
              <ul className="space-y-3">
                {assigned.map((a) => (
                  <li key={a.id} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm">Assignment ID: {a.id}</div>
                        <div className="text-xs text-gray-500">Shift: {a.shift_id}</div>
                        <div className="text-xs mt-1">Status: <span className="font-medium">{a.status}</span></div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="px-3 py-1 text-sm rounded bg-emerald-600 text-white disabled:opacity-50"
                          disabled={a.status === 'accepted'}
                          onClick={() => respond(a.id, 'accept')}
                        >
                          Accept
                        </button>
                        <button
                          className="px-3 py-1 text-sm rounded bg-rose-600 text-white disabled:opacity-50"
                          disabled={a.status === 'declined'}
                          onClick={() => respond(a.id, 'decline')}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4">
            <h2 className="text-lg font-medium mb-3">Available Shifts</h2>
            {available.length === 0 ? (
              <div className="text-sm text-gray-500">No available shifts at the moment.</div>
            ) : (
              <ul className="space-y-3">
                {available.map((s) => (
                  <li key={s.id} className="border border-gray-200 dark:border-gray-700 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{s.date} • {s.start_time}–{s.end_time}</div>
                        {s.location && <div className="text-xs text-gray-500">{s.location}</div>}
                      </div>
                      <div className="text-xs text-gray-400">#{s.id.slice(0,8)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
