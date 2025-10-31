"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { ManagerChatOverlay } from '@/components/manager/ManagerChatOverlay';

type Overview = {
  active_shifts: number;
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

export default function ManagerConsolePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [locations, setLocations] = useState<AgentLoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatAgent, setChatAgent] = useState<{ id: string; name?: string } | null>(null);

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
    { label: 'On Duty', value: overview?.on_duty ?? 0 },
    { label: 'En Route', value: overview?.en_route ?? 0 },
    { label: 'Idle', value: overview?.idle ?? 0 },
    { label: 'Avg Response (s)', value: overview?.avg_response_time ?? 0 },
  ]), [overview]);

  async function notifyAll() {
    const message = 'Heads up: high-priority shift incoming. Stand by.';
    await fetch('/api/manager/console/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_ids: 'all', channel: 'push', type: 'broadcast', message }),
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manager Command Center</h1>
        <div className="flex gap-2">
          <button className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Smart Suggest</button>
          <button className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700">Auto-Assign</button>
          <button onClick={notifyAll} className="px-3 py-2 rounded bg-blue-600 text-white">Notify All</button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 h-[420px] flex items-center justify-center text-gray-500">
            <div>
              <div className="text-lg font-medium mb-1">Live Map (mock)</div>
              <div className="text-sm">Locations update every 10s. Integrate JVectorMap here later.</div>
            </div>
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
                    <button className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm">Dispatch</button>
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
    </div>
  );
}
