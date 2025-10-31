"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { ManagerChatOverlay } from '@/components/manager/ManagerChatOverlay';
import { ManagerLiveMap } from '@/components/manager/ManagerLiveMap';

type Overview = {
  active_shifts: number;
  total_shifts: number;
  unassigned_shifts: number;
  on_duty: number;
  en_route: number;
  idle: number;
  avg_response_time: number; // seconds
};

type AgentLoc = {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  last_seen?: string;
};

type Candidate = {
  agent_id: string;
  agent_name?: string;
  score: number;
  reason: string;
};

export default function ManagerConsolePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [locations, setLocations] = useState<AgentLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAgent, setChatAgent] = useState<{ id: string; name?: string } | null>(null);
  const [suggestModal, setSuggestModal] = useState<{ open: boolean; candidates: Candidate[] }>({ open: false, candidates: [] });
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    try {
      const [o, l] = await Promise.all([
        fetch('/api/manager/console/overview').then((r) => r.json()),
        fetch('/api/agents/locations').then((r) => r.json()),
      ]);
      if (o?.data) setOverview(o.data);
      if (l?.data) setLocations(l.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, []);

  const kpis = useMemo(() => ([
    { label: 'Active Shifts', value: overview?.active_shifts ?? 0 },
    { label: 'Total Shifts', value: overview?.total_shifts ?? 0 },
    { label: 'Unassigned', value: overview?.unassigned_shifts ?? 0 },
    { label: 'On Duty', value: overview?.on_duty ?? 0 },
    { label: 'En Route', value: overview?.en_route ?? 0 },
    { label: 'Idle', value: overview?.idle ?? 0 },
    { label: 'Avg Response (s)', value: overview?.avg_response_time ?? 0 },
  ]), [overview]);

  async function smartSuggest() {
    try {
      const shiftId = 'demo-shift-1'; // In real UI, let user select from unassigned shifts
      const orgId = 'default-org';
      const r = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shift_id: shiftId, organization_id: orgId }),
      });
      const j = await r.json();
      const cands: Candidate[] = (j?.data?.candidates || []).slice(0, 5).map((c: any) => ({
        agent_id: c.agent_id,
        agent_name: c.agent_name,
        score: c.score,
        reason: c.reason,
      }));
      setSuggestModal({ open: true, candidates: cands });
    } catch (e) {
      showToast('Predict failed');
    }
  }

  async function autoAssignTop() {
    if (!suggestModal.candidates.length) return;
    const top = suggestModal.candidates[0];
    try {
      await fetch('/api/manager/console/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          assignments: [{ agent_id: top.agent_id, shift_id: 'demo-shift-1', notes: `AI top pick (${top.score.toFixed(2)})` }],
        }),
      });
      showToast(`Assigned to ${top.agent_name || top.agent_id}`);
      setSuggestModal({ open: false, candidates: [] });
      await load();
    } catch (e) {
      showToast('Assign failed');
    }
  }

  async function autoAssignAll() {
    try {
      const r = await fetch('/api/manager/console/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'auto', organization_id: 'default-org' }),
      });
      const j = await r.json();
      showToast(`Auto-assigned ${j?.count || 0} shifts`);
      await load();
    } catch (e) {
      showToast('Auto-assign failed');
    }
  }

  async function notifyAll() {
    const message = 'Heads up: high-priority shift incoming. Stand by.';
    await fetch('/api/manager/console/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_ids: 'all', channel: 'push', type: 'broadcast', message }),
    });
    showToast('Broadcast sent to all agents');
  }

  async function dispatchAgent(agentId: string, agentName: string) {
    const shiftId = 'demo-shift-dispatch'; // In real UI, prompt or select shift
    try {
      await fetch('/api/manager/console/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', assignments: [{ agent_id: agentId, shift_id: shiftId }] }),
      });
      showToast(`Dispatched ${agentName} to shift`);
      await load();
    } catch (e) {
      showToast('Dispatch failed');
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manager Command Center</h1>
        <div className="flex gap-2">
          <button onClick={smartSuggest} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Smart Suggest</button>
          <button onClick={autoAssignAll} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Auto-Assign</button>
          <button onClick={notifyAll} className="px-3 py-2 rounded bg-blue-600 text-white">Notify All</button>
          <button onClick={load} className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Refresh</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border border-gray-200 dark:border-gray-800 p-4 bg-white dark:bg-gray-900">
            <div className="text-sm text-gray-500">{k.label}</div>
            <div className="text-2xl font-semibold mt-1">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Map + Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-[420px]">
            <ManagerLiveMap agents={locations} onMarkerClick={(id, name) => setChatAgent({ id, name })} />
          </div>
        </div>
        <div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 font-medium">Roster</div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {locations.map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-gray-500">{a.status} · {a.last_seen ? new Date(a.last_seen).toLocaleTimeString() : '—'}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setChatAgent({ id: a.id, name: a.name })} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm">Chat</button>
                    <button onClick={() => dispatchAgent(a.id, a.name)} className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm">Dispatch</button>
                  </div>
                </div>
              ))}
              {locations.length === 0 && (
                <div className="p-4 text-sm text-gray-500">{loading ? 'Loading…' : 'No agents found'}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {chatAgent && (
        <ManagerChatOverlay
          agentId={chatAgent.id}
          agentName={chatAgent.name}
          open={true}
          onClose={() => setChatAgent(null)}
        />
      )}

      {suggestModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">AI Recommendations</h3>
              <button onClick={() => setSuggestModal({ open: false, candidates: [] })} className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
            </div>
            <div className="p-4 space-y-3">
              {suggestModal.candidates.length === 0 && <div className="text-sm text-gray-500">No candidates found</div>}
              {suggestModal.candidates.map((c, i) => (
                <div key={c.agent_id} className="flex items-center justify-between p-3 rounded border border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="font-medium">#{i + 1} {c.agent_name || c.agent_id}</div>
                    <div className="text-sm text-gray-500">Score: {c.score.toFixed(3)} • {c.reason}</div>
                  </div>
                  {i === 0 && (
                    <button onClick={autoAssignTop} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Assign Top</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
