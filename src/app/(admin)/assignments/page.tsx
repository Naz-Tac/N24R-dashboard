"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { showNotification } from '@/components/Notifications';

interface Assignment {
  id: string;
  agent_id: string;
  shift_id: string;
  status: string;
  assigned_at?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function AssignmentsAdminPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [channel, setChannel] = useState<'whatsapp'|'sms'|'email'>('sms');
  const [message, setMessage] = useState('You have a new shift. Please confirm.');
  // Smart Suggest UI state
  const [suggestModal, setSuggestModal] = useState(false);
  const [shiftId, setShiftId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [recs, setRecs] = useState<Array<{agent_id:string; score:number; reason:string}>>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      setAccessToken(session.session?.access_token ?? null);
    })();
  }, []);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/assignments', {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      const json = await res.json();
      if (res.ok) setRows(json.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [accessToken]);

  const openNotify = (a: Assignment) => {
    setSelected(a);
    setChannel('sms');
    setMessage(`Shift ${a.shift_id}: Reply YES to accept, NO to decline.`);
    setModalOpen(true);
  };

  const sendNotify = async () => {
    if (!selected || !accessToken) return;
    const res = await fetch('/api/notifications/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        agent_id: selected.agent_id,
        shift_id: selected.shift_id,
        channel,
        message,
      }),
    });
    const ok = res.ok;
    setModalOpen(false);
    showNotification(ok ? 'Notification sent' : 'Failed to send notification', ok ? 'success' : 'delete');
  };

  const openSuggest = () => {
    setShiftId('');
    setOrgId('');
    setRecs([]);
    setSuggestModal(true);
  };

  const fetchSuggestions = async () => {
    if (!shiftId || !orgId || !accessToken) {
      showNotification('Provide shift ID and organization ID', 'delete');
      return;
    }
    setRecsLoading(true);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ shift_id: shiftId, organization_id: orgId, criteria: ['availability','past_acceptance','credentials'] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      setRecs(json?.data?.recommendations?.slice(0,5) || []);
    } catch (e:any) {
      showNotification(e?.message || 'Failed to get recommendations', 'delete');
    } finally {
      setRecsLoading(false);
    }
  };

  const autoAssignTop = async () => {
    if (!shiftId || !orgId || !accessToken) return;
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ shift_id: shiftId, organization_id: orgId, criteria: ['availability','past_acceptance','credentials'], auto_assign: true }),
      });
      const json = await res.json();
      if (res.ok && json?.data?.auto_assigned) {
        showNotification('✅ Auto-assigned top agent', 'success');
        setSuggestModal(false);
        fetchAssignments();
      } else {
        throw new Error(json?.error || 'Auto-assign failed');
      }
    } catch (e:any) {
      showNotification(e?.message || 'Auto-assign failed', 'delete');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <div className="flex items-center gap-2">
          {/* Placeholder for existing Assign Agent button if present in future */}
          <button className="px-3 py-1 text-sm rounded bg-violet-600 text-white" onClick={openSuggest}>Smart Suggest</button>
        </div>
      </div>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-200 dark:border-gray-700">
              <th className="py-2">ID</th>
              <th>Agent</th>
              <th>Shift</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2">{a.id.slice(0,8)}</td>
                <td>{a.agent_id.slice(0,8)}</td>
                <td>{a.shift_id.slice(0,8)}</td>
                <td className="capitalize">{a.status}</td>
                <td>
                  <button
                    className="px-3 py-1 text-sm rounded bg-blue-600 text-white"
                    onClick={() => openNotify(a)}
                  >
                    Notify Agent
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4 w-full max-w-md">
            <h2 className="text-lg font-medium mb-3">Notify Agent</h2>
            <div className="mb-3">
              <label className="block text-sm mb-1">Channel</label>
              <select
                className="w-full border rounded p-2 bg-white dark:bg-gray-900"
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
              >
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1">Message</label>
              <textarea
                className="w-full border rounded p-2 bg-white dark:bg-gray-900"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 rounded border" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={sendNotify}>Send</button>
            </div>
          </div>
        </div>
      )}

      {suggestModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4 w-full max-w-lg">
            <h2 className="text-lg font-medium mb-3">Smart Suggestions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm mb-1">Shift ID</label>
                <input className="w-full border rounded p-2 bg-white dark:bg-gray-900" value={shiftId} onChange={(e)=>setShiftId(e.target.value)} placeholder="UUID" />
              </div>
              <div>
                <label className="block text-sm mb-1">Organization ID</label>
                <input className="w-full border rounded p-2 bg-white dark:bg-gray-900" value={orgId} onChange={(e)=>setOrgId(e.target.value)} placeholder="UUID" />
              </div>
            </div>
            <div className="flex justify-between items-center mb-3">
              <button className="px-3 py-1 rounded border" onClick={()=>setSuggestModal(false)}>Close</button>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={fetchSuggestions} disabled={recsLoading}>{recsLoading?'Loading…':'Smart Suggest'}</button>
                <button className="px-3 py-1 rounded bg-emerald-600 text-white" onClick={autoAssignTop} disabled={!recs.length}>Auto-Assign Top</button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {recs.length === 0 ? (
                <p className="text-sm text-gray-500">No recommendations yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2">Agent</th>
                      <th>Score</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((r)=> (
                      <tr key={r.agent_id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2">{r.agent_id.slice(0,8)}…</td>
                        <td>{r.score.toFixed(2)}</td>
                        <td>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
