'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardRecord {
  assignment_status: string;
}

interface StatusPieChartProps {
  data: DashboardRecord[];
}

export const StatusPieChart: React.FC<StatusPieChartProps> = ({ data }) => {
  // Count assigned vs unassigned
  const assignedCount = data.filter(r => r.assignment_status === 'assigned').length;
  const unassignedCount = data.filter(r => r.assignment_status === 'unassigned').length;

  const options: ApexOptions = {
    chart: {
      type: 'donut',
      height: 350,
      background: 'transparent',
    },
    colors: ['#10B981', '#F59E0B'],
    labels: ['Assigned', 'Unassigned'],
    legend: {
      position: 'bottom',
      labels: {
        colors: '#64748B',
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '16px',
              color: '#64748B',
            },
            value: {
              show: true,
              fontSize: '24px',
              color: '#1F2937',
              formatter: function (val) {
                return val;
              },
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '16px',
              color: '#64748B',
              formatter: function (w) {
                return w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
              },
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#fff'],
      },
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function (val) {
          return val + ' agents';
        },
      },
    },
    responsive: [
      {
        breakpoint: 480,
        options: {
          chart: {
            width: 300,
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    ],
  };

  const series = [assignedCount, unassignedCount];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-black dark:text-white">
        No status data to display
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white p-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
        Status Distribution
      </h3>
      <ReactApexChart options={options} series={series} type="donut" height={350} />
    </div>
  );
};
