'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';

// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function AIAnalyticsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any>(null);
  const [intents, setIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedOrg, setSelectedOrg] = useState('');

  useEffect(() => {
    fetchData();
  }, [dateRange, selectedOrg]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Build query params
      const params = new URLSearchParams();
      if (selectedOrg) params.set('organization_id', selectedOrg);
      if (dateRange.start && dateRange.end) {
        params.set('range', `${dateRange.start},${dateRange.end}`);
      }

      const [summaryRes, timeseriesRes, intentsRes] = await Promise.all([
        fetch(`/api/analytics/ai/summary?${params.toString()}`),
        fetch(`/api/analytics/ai/timeseries?${params.toString()}`),
        fetch(`/api/analytics/ai/intents?${params.toString()}`),
      ]);

      const [summaryData, timeseriesData, intentsData] = await Promise.all([
        summaryRes.json(),
        timeseriesRes.json(),
        intentsRes.json(),
      ]);

      setSummary(summaryData.data || {});
      setTimeseries(timeseriesData.data || {});
      setIntents(intentsData.data || []);
    } catch (error) {
      console.error('Failed to fetch AI analytics:', error);
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
    colors: ['#3b82f6', '#10b981', '#ef4444'],
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
      bar: { horizontal: false, columnWidth: '55%' },
    },
    xaxis: {
      categories: intents.map((i) => i.intent),
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
    labels: intents.map((i) => i.intent),
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
      <PageBreadCrumb pageTitle="AI Analytics" />

      <div className="mt-4 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Track assistant activity, intent patterns, and action success rates
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
              <option value="org-1">Operations Team</option>
              <option value="org-2">Dispatch Unit</option>
              <option value="org-3">Night Shift</option>
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
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Interactions</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.total_interactions?.toLocaleString() || 0}
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Unique Users</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.unique_users || 0}
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg Response Time</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.avg_response_time?.toFixed(1) || 0}s
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Action Success Rate</h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {summary?.action_success_rate || 0}%
              </p>
            </div>
          </div>

          {/* Top Intent */}
          <div className="mb-6">
            <ComponentCard title="Top Intent">
              <div className="py-6 text-center">
                <p className="text-4xl font-bold text-primary">
                  {summary?.top_intent || 'N/A'}
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  Most frequently detected user intent
                </p>
              </div>
            </ComponentCard>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Line Chart - Queries Over Time */}
            <ComponentCard title="AI Queries Over Time">
              <ReactApexChart
                options={lineChartOptions}
                series={[
                  { name: 'Interactions', data: timeseries?.interactions || [] },
                  { name: 'Successes', data: timeseries?.successes || [] },
                  { name: 'Failures', data: timeseries?.failures || [] },
                ]}
                type="line"
                height={300}
              />
            </ComponentCard>

            {/* Bar Chart - Intents by Count */}
            <ComponentCard title="Intent Breakdown">
              <ReactApexChart
                options={barChartOptions}
                series={[{ name: 'Count', data: intents.map((i) => i.count) }]}
                type="bar"
                height={300}
              />
            </ComponentCard>

            {/* Donut Chart - Intent Distribution */}
            <ComponentCard title="Intent Distribution (%)">
              <ReactApexChart
                options={donutChartOptions}
                series={intents.map((i) => i.percentage)}
                type="donut"
                height={300}
              />
            </ComponentCard>

            {/* Org Breakdown Table */}
            {summary?.org_breakdown && (
              <ComponentCard title="Organization Breakdown">
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-meta-4">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                          Organization
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                          Interactions
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                          Success Rate
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.org_breakdown.map((org: any, idx: number) => (
                        <tr key={idx} className="border-t border-stroke dark:border-strokedark">
                          <td className="px-4 py-3 text-sm text-black dark:text-white">
                            {org.org_name}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-black dark:text-white">
                            {org.interactions.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-black dark:text-white">
                            {org.success_rate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ComponentCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
