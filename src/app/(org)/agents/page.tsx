"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { showNotification } from '@/components/Notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function OrgAgentsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [email, setEmail] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setToken(data.session?.access_token ?? null);
    })();
  }, []);

  const loadRoster = async () => {
    if (!token) return;
    const res = await fetch('/api/org/roster', { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setRoster(json.data || []);
  };

  useEffect(() => {
    loadRoster();
  }, [token]);

  const invite = async () => {
    if (!token || !email) return;
    const res = await fetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      showNotification('Invite sent (or user created)', 'success');
      setEmail('');
      await loadRoster();
    } else {
      showNotification('Failed to invite', 'delete');
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">My Agents</h1>
      <div className="mb-4 flex gap-2">
        <input
          className="border rounded p-2 w-80 bg-white dark:bg-gray-900"
          placeholder="agent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={invite}>Invite</button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-gray-200 dark:border-gray-700">
            <th className="py-2">User ID</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((m) => (
            <tr key={m.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="py-2">{m.user_id?.slice(0,8)}</td>
              <td className="capitalize">{m.role}</td>
              <td>{m.joined_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
