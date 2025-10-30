'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';

// Dynamic import to avoid SSR issues with ApexCharts
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface DashboardRecord {
  agent_name: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  assignment_status: string;
}

interface AvailabilityLineChartProps {
  data: DashboardRecord[];
}

export const AvailabilityLineChart: React.FC<AvailabilityLineChartProps> = ({ data }) => {
  // Group data by date and count availability
  const dateMap = new Map<string, number>();
  
  data.forEach(record => {
    const date = record.availability_date;
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  });

  // Sort dates and create series data
  const sortedDates = Array.from(dateMap.keys()).sort();
  const counts = sortedDates.map(date => dateMap.get(date) || 0);

  const options: ApexOptions = {
    chart: {
      type: 'line',
      height: 350,
      toolbar: {
        show: true,
      },
      background: 'transparent',
    },
    colors: ['#3C50E0'],
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 3,
    },
    xaxis: {
      categories: sortedDates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      labels: {
        style: {
          colors: '#64748B',
        },
      },
    },
    yaxis: {
      title: {
        text: 'Available Agents',
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
    grid: {
      borderColor: '#E2E8F0',
    },
    tooltip: {
      theme: 'dark',
      x: {
        show: true,
      },
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left',
      labels: {
        colors: '#64748B',
      },
    },
  };

  const series = [
    {
      name: 'Available Agents',
      data: counts,
    },
  ];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-black dark:text-white">
        No availability data to display
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-stroke bg-white p-7.5 shadow-default dark:border-strokedark dark:bg-boxdark">
      <h3 className="text-xl font-semibold text-black dark:text-white mb-4">
        Availability Trends
      </h3>
      <ReactApexChart options={options} series={series} type="line" height={350} />
    </div>
  );
};
