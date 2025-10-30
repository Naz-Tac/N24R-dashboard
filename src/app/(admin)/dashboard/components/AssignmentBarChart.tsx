'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardRecord {
  agent_name: string;
  availability_date: string;
  assignment_status: string;
}

interface AssignmentBarChartProps {
  data: DashboardRecord[];
}

export const AssignmentBarChart: React.FC<AssignmentBarChartProps> = ({ data }) => {
  // Count assigned vs unassigned
  const assignedCount = data.filter(r => r.assignment_status === 'assigned').length;
  const unassignedCount = data.filter(r => r.assignment_status === 'unassigned').length;

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      height: 350,
      toolbar: {
        show: true,
      },
      background: 'transparent',
    },
    colors: ['#10B981', '#F59E0B'],
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '55%',
        borderRadius: 4,
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#fff'],
      },
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent'],
    },
    xaxis: {
      categories: ['Assignment Status'],
      labels: {
        style: {
          colors: '#64748B',
        },
      },
    },
    yaxis: {
      title: {
        text: 'Count',
        style: {
          color: '#64748B',
        },
      },
      labels: {
        style: {
          colors: '#64748B',
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      theme: 'dark',
      y: {
        formatter: function (val) {
          return val + ' agents';
        },
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      labels: {
        colors: '#64748B',
      },
    },
    grid: {
      borderColor: '#E2E8F0',
    },
  };

  const series = [
    {
      name: 'Assigned',
      data: [assignedCount],
    },
    {
      name: 'Unassigned',
      data: [unassignedCount],
    },
  ];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-black dark:text-white">
        No assignment data to display
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white p-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
        Assignment Distribution
      </h3>
      <ReactApexChart options={options} series={series} type="bar" height={350} />
    </div>
  );
};
