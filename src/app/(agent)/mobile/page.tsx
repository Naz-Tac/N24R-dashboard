'use client';

import { useEffect, useMemo, useState } from 'react';

function useInterval(callback: () => void, delay: number) {
  useEffect(() => {
    const id = setInterval(callback, delay);
    return () => clearInterval(id);
  }, [callback, delay]);
}

export default function AgentMobilePage() {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [data, setData] = useState<any>({ accepted: [], upcoming: [], notifications: [] });

  // Offline cache: last 10 assignments in localStorage
  useEffect(() => {
    const cached = localStorage.getItem('agent_mobile_cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed);
      } catch {}
    }
  }, []);

  async function ensureToken() {
    if (token) return token;
    const res = await fetch('/api/auth/token', { method: 'POST' });
    if (!res.ok) throw new Error('token failed');
    const json = await res.json();
    setToken(json.token);
    return json.token as string;
  }

  async function load() {
    try {
      setLoading(true);
      const t = await ensureToken();
      const res = await fetch('/api/agent/assignments', {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json.data || {});
        // Cache reduced payload
        const cache = {
          accepted: (json.data?.accepted || []).slice(0, 10),
          upcoming: (json.data?.upcoming || []).slice(0, 10),
          notifications: (json.data?.notifications || []).slice(0, 10),
        };
        localStorage.setItem('agent_mobile_cache', JSON.stringify(cache));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useInterval(load, 30000);

  async function respond(assignment_id: string, action: 'accept' | 'decline') {
    try {
      const res = await fetch('/api/assignments/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id, action }),
      });
      if (res.ok) {
        await load();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function formatTime(iso: string | null | undefined) {
    if (!iso) return '-';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  async function quickReply(noteId: string) {
    try {
      const t = await ensureToken();
      await fetch('/api/agent/chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ message: 'On it! 👍' }),
      });
      await load();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 space-y-4">
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-white/80 dark:bg-boxdark/80 backdrop-blur border-b border-stroke dark:border-strokedark">
        <h1 className="text-xl font-bold text-black dark:text-white">My Shifts</h1>
        <p className="text-xs text-slate-500">Mobile Portal</p>
      </div>

      {loading && (
        <div className="text-center text-slate-500">Loading…</div>
      )}

      {/* Upcoming Shifts */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Upcoming</h2>
        <div className="space-y-2">
          {(data.upcoming || []).length === 0 && (
            <div className="text-xs text-slate-500">No upcoming shifts</div>
          )}
          {(data.upcoming || []).map((a: any) => (
            <div key={a.id} className="rounded-lg border border-stroke dark:border-strokedark p-3 bg-white dark:bg-boxdark">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-black dark:text-white">Shift {a.shift_id}</div>
                  <div className="text-xs text-slate-500">Assigned: {formatTime(a.assigned_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => respond(a.id, 'accept')} className="rounded bg-green-600 px-3 py-1 text-xs text-white">Accept</button>
                  <button onClick={() => respond(a.id, 'decline')} className="rounded bg-rose-600 px-3 py-1 text-xs text-white">Decline</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accepted Shifts */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Accepted</h2>
        <div className="space-y-2">
          {(data.accepted || []).length === 0 && (
            <div className="text-xs text-slate-500">No accepted assignments yet</div>
          )}
          {(data.accepted || []).map((a: any) => (
            <div key={a.id} className="rounded-lg border border-stroke dark:border-strokedark p-3 bg-white dark:bg-boxdark">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-black dark:text-white">Shift {a.shift_id}</div>
                  <div className="text-xs text-slate-500">Responded: {formatTime(a.responded_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notifications */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Notifications</h2>
        <div className="space-y-2">
          {(data.notifications || []).length === 0 && (
            <div className="text-xs text-slate-500">No notifications</div>
          )}
          {(data.notifications || []).map((n: any) => (
            <div key={n.id} className="rounded-lg border border-stroke dark:border-strokedark p-3 bg-white dark:bg-boxdark">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-black dark:text-white">{n.type}</div>
                  <div className="text-xs text-slate-500">{n.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{formatTime(n.created_at)} · via {n.channel}</div>
                </div>
                {n.type === 'chat' && (
                  <button onClick={() => quickReply(n.id)} className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white">Reply</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="pb-20">
        <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => alert('Go to Availability')}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white">Update Availability</button>
          <button onClick={load}
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-medium text-white">Refresh</button>
          <button onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); setToken(null); }}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-medium text-white">Logout</button>
        </div>
      </section>
    </div>
  );
}
