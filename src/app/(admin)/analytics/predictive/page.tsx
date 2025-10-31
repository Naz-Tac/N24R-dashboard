'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function PredictiveAnalyticsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any>(null);
  const [guardrails, setGuardrails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedOrg, setSelectedOrg] = useState('');
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedOrg]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/organizations');
        const json = await res.json();
        if (res.ok) setOrgs(json?.data || []);
      } catch {}
    })();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedOrg) params.set('organization_id', selectedOrg);
      if (dateRange.start && dateRange.end) {
        params.set('range', `${dateRange.start},${dateRange.end}`);
      }

      const [summaryRes, timeseriesRes, guardrailsRes] = await Promise.all([
        fetch(`/api/analytics/predictive/summary?${params.toString()}`),
        fetch(`/api/analytics/predictive/timeseries?${params.toString()}`),
        fetch(`/api/analytics/predictive/guardrails?${params.toString()}`),
      ]);

      const [summaryData, timeseriesData, guardrailsData] = await Promise.all([
        summaryRes.json(),
        timeseriesRes.json(),
        guardrailsRes.json(),
      ]);

      setSummary(summaryData.data || {});
      setTimeseries(timeseriesData.data || {});
      setGuardrails(guardrailsData.data || []);
    } catch (error) {
      console.error('Failed to fetch predictive analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  // Chart options
  const lineChartOptions: any = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    stroke: { curve: 'smooth', width: 2 },
    xaxis: {
      categories: timeseries?.dates || [],
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8' } },
    },
    colors: ['#3b82f6', '#10b981'],
    legend: {
      labels: { colors: '#94a3b8' },
    },
    grid: {
      borderColor: '#334155',
    },
  };

  const barChartOptions: any = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    plotOptions: {
      bar: { horizontal: true, columnWidth: '55%' },
    },
    xaxis: {
      categories: (summary?.top_agents || []).map((a: any) => a.agent_id.slice(0, 8)),
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: {
      labels: { style: { colors: '#94a3b8' } },
    },
    colors: ['#8b5cf6'],
    grid: {
      borderColor: '#334155',
    },
  };

  const donutChartOptions: any = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    labels: guardrails.map((g) => g.reason),
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'],
    legend: {
      labels: { colors: '#94a3b8' },
      position: 'bottom',
    },
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: '#94a3b8',
            },
          },
        },
      },
    },
  };

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <PageBreadCrumb pageTitle="Predictive Analytics" />

      <div className="mt-4 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          AI dispatch predictions, guardrails, and auto-fill performance
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-stroke bg-white p-4 shadow-sm dark:border-strokedark dark:bg-boxdark">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-black dark:text-white">
              Date Range (Start)
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-black dark:text-white">
              Date Range (End)
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="mb-2 block text-sm font-medium text-black dark:text-white">
              Organization
            </label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
              className="w-full rounded-lg border border-stroke bg-transparent px-4 py-2 text-black outline-none focus:border-primary dark:border-strokedark dark:bg-form-input dark:text-white"
            >
              <option value="">All Organizations</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchData}
              className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading analytics...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Predictions</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.total_predictions?.toLocaleString() || 0}
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Auto-Assignments</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.total_auto_assigned?.toLocaleString() || 0}
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Score</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.avg_prediction_score?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Skip Rate</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {((summary?.guardrail_skip_rate || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Top Guardrail</h3>
              <p className="mt-2 text-xl font-bold text-black dark:text-white">
                {summary?.top_guardrail_reason || 'N/A'}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Line Chart - Predictions vs Auto-Assignments */}
            <ComponentCard title="Predictions vs Auto-Assignments Over Time">
              <ReactApexChart
                options={lineChartOptions}
                series={[
                  { name: 'Predictions', data: timeseries?.predictions || [] },
                  { name: 'Auto-Assignments', data: timeseries?.auto_assignments || [] },
                ]}
                type="line"
                height={300}
              />
            </ComponentCard>

            {/* Bar Chart - Top Agents */}
            <ComponentCard title="Top Agents by Avg Score">
              <ReactApexChart
                options={barChartOptions}
                series={[{ name: 'Avg Score', data: (summary?.top_agents || []).map((a: any) => a.avg_score) }]}
                type="bar"
                height={300}
              />
            </ComponentCard>

            {/* Donut Chart - Guardrail Distribution */}
            <ComponentCard title="Guardrail Distribution">
              <ReactApexChart
                options={donutChartOptions}
                series={guardrails.map((g) => g.count)}
                type="donut"
                height={300}
              />
            </ComponentCard>

            {/* Top Agents Table */}
            <ComponentCard title="Top Agents Details">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-meta-4">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Agent ID
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                        Avg Score
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                        Assignments
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.top_agents || []).map((agent: any, idx: number) => (
                      <tr key={idx} className="border-t border-stroke dark:border-strokedark">
                        <td className="px-4 py-3 text-sm text-black dark:text-white">
                          {agent.agent_id.slice(0, 12)}...
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-black dark:text-white">
                          {agent.avg_score.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-black dark:text-white">
                          {agent.assignments}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ComponentCard>
          </div>
        </>
      )}
    </div>
  );
}
