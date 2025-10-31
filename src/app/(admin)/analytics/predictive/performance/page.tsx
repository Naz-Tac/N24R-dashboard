'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import ComponentCard from '@/components/common/ComponentCard';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function PerformancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics/predictive/performance');
      const json = await res.json();
      if (res.ok) {
        setData(json.data || {});
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Chart options
  const acceptanceTrendOptions: any = {
    chart: {
      type: 'line',
      toolbar: { show: false },
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    stroke: { curve: 'smooth', width: 3 },
    xaxis: {
      categories: (data?.acceptance_trend || []).map((d: any) => d.date),
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: {
      labels: {
        style: { colors: '#94a3b8' },
        formatter: (val: number) => (val * 100).toFixed(0) + '%',
      },
      min: 0,
      max: 1,
    },
    colors: ['#3b82f6'],
    legend: {
      labels: { colors: '#94a3b8' },
    },
    grid: {
      borderColor: '#334155',
    },
  };

  const weightContributionOptions: any = {
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
      categories: ['Accept', 'Speed', 'Availability', 'Credentials', 'Distance'],
      labels: { style: { colors: '#94a3b8' } },
    },
    yaxis: {
      labels: {
        style: { colors: '#94a3b8' },
        formatter: (val: number) => val.toFixed(2),
      },
    },
    colors: ['#8b5cf6'],
    grid: {
      borderColor: '#334155',
    },
  };

  const successFailOptions: any = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    theme: { mode: 'dark' },
    labels: ['Success', 'Fail'],
    colors: ['#10b981', '#ef4444'],
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

  const weights = data?.current_weights || {};
  const weightValues = [
    weights.accept || 0,
    weights.speed || 0,
    weights.avail || 0,
    weights.cred || 0,
    weights.distance || 0,
  ];

  return (
    <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <PageBreadCrumb pageTitle="AI Performance & Auto-Tuning" />

      <div className="mt-4 mb-6">
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Model weight optimization, acceptance trends, and recalibration history
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading performance data...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Acceptance Rate (7d)
              </h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {((data?.acceptance_rate_7d || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Acceptance Rate (30d)
              </h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {((data?.acceptance_rate_30d || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Guardrail Skip Rate
              </h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {((data?.guardrail_skip_rate || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg border border-stroke bg-white p-6 shadow-sm dark:border-strokedark dark:bg-boxdark">
              <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Avg Response Time
              </h3>
              <p className="mt-2 text-3xl font-bold text-black dark:text-white">
                {Math.round(data?.avg_response_time || 0)}s
              </p>
            </div>
          </div>

          {/* Current Weights Card */}
          <div className="mb-6">
            <ComponentCard title="Current Model Weights">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-meta-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Accept
                  </div>
                  <div className="mt-1 text-2xl font-bold text-black dark:text-white">
                    {(weights.accept || 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-meta-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Speed
                  </div>
                  <div className="mt-1 text-2xl font-bold text-black dark:text-white">
                    {(weights.speed || 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-meta-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Availability
                  </div>
                  <div className="mt-1 text-2xl font-bold text-black dark:text-white">
                    {(weights.avail || 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-meta-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Credentials
                  </div>
                  <div className="mt-1 text-2xl font-bold text-black dark:text-white">
                    {(weights.cred || 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-center p-4 rounded-lg bg-slate-50 dark:bg-meta-4">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Distance
                  </div>
                  <div className="mt-1 text-2xl font-bold text-black dark:text-white">
                    {(weights.distance || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </ComponentCard>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 mb-6">
            {/* Acceptance Trend */}
            <ComponentCard title="Acceptance Rate Trend (30d)">
              <ReactApexChart
                options={acceptanceTrendOptions}
                series={[
                  {
                    name: 'Acceptance Rate',
                    data: (data?.acceptance_trend || []).map((d: any) => d.rate),
                  },
                ]}
                type="line"
                height={300}
              />
            </ComponentCard>

            {/* Weight Contribution */}
            <ComponentCard title="Weight Contribution per Criterion">
              <ReactApexChart
                options={weightContributionOptions}
                series={[{ name: 'Weight', data: weightValues }]}
                type="bar"
                height={300}
              />
            </ComponentCard>

            {/* Success/Fail Breakdown */}
            <ComponentCard title="Success vs Fail (30d)">
              <ReactApexChart
                options={successFailOptions}
                series={[data?.success_count || 0, data?.fail_count || 0]}
                type="donut"
                height={300}
              />
            </ComponentCard>

            {/* Recalibration Events Table */}
            <ComponentCard title="Recent Recalibration Events">
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-meta-4">
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Timestamp
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Reason
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Window
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recalibration_events || []).slice(0, 10).map((evt: any, idx: number) => (
                      <tr key={idx} className="border-t border-stroke dark:border-strokedark">
                        <td className="px-4 py-3 text-sm text-black dark:text-white">
                          {new Date(evt.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-black dark:text-white">
                          {evt.reason}
                        </td>
                        <td className="px-4 py-3 text-sm text-black dark:text-white">
                          {evt.success_window || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ComponentCard>
          </div>

          {/* Refresh Button */}
          <div className="text-center">
            <button
              onClick={fetchData}
              className="rounded-lg bg-primary px-6 py-2 font-medium text-white hover:bg-opacity-90"
            >
              Refresh Data
            </button>
          </div>
        </>
      )}
    </div>
  );
}
