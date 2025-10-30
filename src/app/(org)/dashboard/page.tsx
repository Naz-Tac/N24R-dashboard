"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function OrgDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ roster: number; shifts: number; fillRate: number }>({ roster: 0, shifts: 0, fillRate: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
    })();
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${token}` } as any;
        const rosterRes = await fetch('/api/org/roster', { headers });
        const rosterJson = await rosterRes.json();
        const shiftsRes = await fetch('/api/org/shifts', { headers });
        const shiftsJson = await shiftsRes.json();
        const roster = Array.isArray(rosterJson.data) ? rosterJson.data.length : 0;
        const shifts = Array.isArray(shiftsJson.data) ? shiftsJson.data.length : 0;
        const fillRate = shifts === 0 ? 0 : Math.round((shifts / Math.max(shifts, 1)) * 100);
        setSummary({ roster, shifts, fillRate });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Organization Dashboard</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded p-4 shadow">
            <div className="text-sm text-gray-500">Roster Size</div>
            <div className="text-2xl font-semibold">{summary.roster}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-4 shadow">
            <div className="text-sm text-gray-500">Open Shifts</div>
            <div className="text-2xl font-semibold">{summary.shifts}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded p-4 shadow">
            <div className="text-sm text-gray-500">Fill Rate</div>
            <div className="text-2xl font-semibold">{summary.fillRate}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
