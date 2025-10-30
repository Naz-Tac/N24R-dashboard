'use client';

import { useEffect, useMemo, useState } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

type Summary = {
  total_agents: number;
  total_shifts: number;
  filled_shifts: number;
  fill_rate: number;
  avg_response_time: number;
  accepted_vs_declined: { accepted: number; declined: number };
  top_agents: Array<{ agent_id: string; name?: string; count: number }>;
};

type Timeseries = {
  dates: string[];
  requests: number[];
  filled: number[];
  declined: number[];
};

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ts, setTs] = useState<Timeseries | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [orgId, setOrgId] = useState<string>('');
  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 13);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  });
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgId) params.set('organization_id', orgId);
      params.set('start_date', range.start);
      params.set('end_date', range.end);

      const [sRes, tRes] = await Promise.all([
        fetch(`/api/analytics/summary${params.toString() ? `?${params.toString()}` : ''}`),
        fetch(`/api/analytics/timeseries${params.toString() ? `?${params.toString()}` : ''}`),
      ]);

      if (!sRes.ok) throw new Error(`Summary HTTP ${sRes.status}`);
      if (!tRes.ok) throw new Error(`Timeseries HTTP ${tRes.status}`);
      const sJson = await sRes.json();
      const tJson = await tRes.json();
      setSummary(sJson.data as Summary);
      setTs(tJson.data as Timeseries);
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load orgs for selector (admins only; managers will get just their org)
    (async () => {
      try {
        const res = await fetch('/api/organizations');
        if (res.ok) {
          const json = await res.json();
          const list = (json.data || []) as Array<{ id: string; name: string }>;
          setOrgs(list);
          if (list.length === 1) setOrgId(list[0].id);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    fetchData();
  }, [orgId, range.start, range.end]);

  const kpis = useMemo(() => {
    if (!summary) return [] as Array<{ title: string; value: string; accent: string }>;
    return [
      { title: 'Fill Rate', value: `${Math.round((summary.fill_rate || 0) * 100) / 100}`, accent: 'text-primary' },
      { title: 'Total Shifts', value: String(summary.total_shifts || 0), accent: 'text-success' },
      { title: 'Filled Shifts', value: String(summary.filled_shifts || 0), accent: 'text-green-500' },
      { title: 'Avg Response (min)', value: String(summary.avg_response_time || 0), accent: 'text-yellow-500' },
    ];
  }, [summary]);

  const lineOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'line', height: 320, background: 'transparent', toolbar: { show: true } },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: { categories: ts?.dates?.map((d) => new Date(d).toLocaleDateString()) || [] },
    colors: ['#60A5FA', '#34D399'],
    theme: { mode: 'light' },
    grid: { borderColor: '#E2E8F0' },
    legend: { position: 'top', horizontalAlign: 'left' },
  }), [ts]);

  const barOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: 320, background: 'transparent', toolbar: { show: true } },
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
    xaxis: { categories: ['Accepted', 'Declined'] },
    colors: ['#10B981', '#EF4444'],
    grid: { borderColor: '#E2E8F0' },
  }), []);

  const pieOptions: ApexOptions = useMemo(() => ({
    chart: { type: 'donut', height: 320, background: 'transparent' },
    labels: (summary?.top_agents || []).map((a) => a.name || a.agent_id.slice(0, 6)),
    legend: { position: 'bottom' },
    colors: ['#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#06B6D4'],
  }), [summary]);

  return (
    <>
      <PageBreadCrumb pageTitle="Analytics" />

      {/* Filters */}
      <div className="mb-6 rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div>
            <label className="mb-2 block text-black dark:text-white">Organization</label>
            <select
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              className="w-60 rounded border border-stroke bg-transparent py-2.5 px-3 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="">All</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-black dark:text-white">Start Date</label>
            <input
              type="date"
              value={range.start}
              onChange={(e) => setRange((r) => ({ ...r, start: e.target.value }))}
              className="rounded border border-stroke bg-transparent py-2.5 px-3 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            />
          </div>

          <div>
            <label className="mb-2 block text-black dark:text-white">End Date</label>
            <input
              type="date"
              value={range.end}
              onChange={(e) => setRange((r) => ({ ...r, end: e.target.value }))}
              className="rounded border border-stroke bg-transparent py-2.5 px-3 text-black outline-none focus:border-primary dark:border-form-strokedark dark:bg-form-input dark:text-white"
            />
          </div>

          <button
            onClick={fetchData}
            className="ml-auto rounded bg-primary py-2.5 px-4 font-medium text-white hover:shadow-1"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-800/50 dark:bg-rose-950 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        {kpis.map((k) => (
          <div key={k.title} className="rounded-sm border border-stroke bg-white p-5 shadow-default dark:border-strokedark dark:bg-boxdark">
            <p className="text-sm text-slate-500 dark:text-slate-400">{k.title}</p>
            <p className={`mt-2 text-2xl font-semibold ${k.accent}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Line chart */}
        <div className="xl:col-span-2 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">Shift requests vs. fills</h3>
          <ReactApexChart
            options={lineOptions}
            series={[
              { name: 'Requests', data: ts?.requests || [] },
              { name: 'Filled', data: ts?.filled || [] },
            ]}
            type="line"
            height={320}
          />
        </div>

        {/* Bar chart */}
        <div className="rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
          <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">Accepted vs Declined</h3>
          <ReactApexChart
            options={barOptions}
            series={[{ name: 'Accepted', data: [summary?.accepted_vs_declined.accepted || 0] }, { name: 'Declined', data: [summary?.accepted_vs_declined.declined || 0] }]}
            type="bar"
            height={320}
          />
        </div>
      </div>

      {/* Pie chart */}
      <div className="mt-6 rounded-sm border border-stroke bg-white p-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <h3 className="mb-4 text-lg font-semibold text-black dark:text-white">Top Agents</h3>
        <ReactApexChart
          options={pieOptions}
          series={(summary?.top_agents || []).map((a) => a.count)}
          type="donut"
          height={320}
        />
      </div>
    </>
  );
}
