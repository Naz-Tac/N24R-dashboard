'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { AvailabilityLineChart } from './components/AvailabilityLineChart';
import { AssignmentBarChart } from './components/AssignmentBarChart';
import { StatusPieChart } from './components/StatusPieChart';
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import { showNotification } from '@/components/Notifications';

interface DashboardRecord {
  agent_id?: string;
  agent_name: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  assignment_status: string;
  notes?: string | null;
}

type ViewMode = 'table' | 'charts';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.append('date', dateFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const url = `/api/dashboard${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

    // Debounced refresh to prevent excessive re-renders
    const debouncedRefresh = useCallback(() => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    
      debounceTimerRef.current = setTimeout(() => {
        fetchDashboardData();
      }, 2000); // 2 second debounce
    }, [dateFilter, statusFilter]);

    // Subscribe to agent_availability changes
    useRealtimeUpdates({
      table: 'agent_availability',
      onChange: (payload) => {
        console.log('[Dashboard] Availability change detected:', payload.eventType);
        showNotification(
          '🔄 Dashboard updated — new availability data received',
          'update'
        );
        debouncedRefresh();
      },
    });

    // Subscribe to assignments changes
    useRealtimeUpdates({
      table: 'assignments',
      onChange: (payload) => {
        console.log('[Dashboard] Assignment change detected:', payload.eventType);
        showNotification(
          '🔄 Dashboard updated — assignment data changed',
          'update'
        );
        debouncedRefresh();
      },
    });

  useEffect(() => {
    fetchDashboardData();
  }, [dateFilter, statusFilter]);

  const exportToCSV = () => {
    if (data.length === 0) return;
    
    const headers = ['Agent Name', 'Availability Date', 'Start Time', 'End Time', 'Assignment Status', 'Notes'];
    const csvData = data.map(record => [
      record.agent_name,
      record.availability_date,
      record.start_time,
      record.end_time,
      record.assignment_status,
      record.notes || '-'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `dashboard-data-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <PageBreadCrumb pageTitle="Dashboard" />
      
      <div className="rounded-sm border border-stroke bg-white px-7.5 py-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-black dark:text-white">
              Agent Availability & Assignments
            </h2>
            
            <div className="flex gap-3">
              {/* View Toggle */}
              <button
                onClick={() => setViewMode(viewMode === 'table' ? 'charts' : 'table')}
                className="rounded bg-primary py-2 px-4 font-medium text-white hover:shadow-1 flex items-center gap-2"
              >
                {viewMode === 'table' ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Show Charts
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Show Table
                  </>
                )}
              </button>
              
              {/* Export CSV */}
              <button
                onClick={exportToCSV}
                disabled={data.length === 0}
                className="rounded bg-success py-2 px-4 font-medium text-white hover:shadow-1 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            </div>
          </div>
          
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Filter by Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              />
            </div>
            
            <div>
              <label className="mb-2.5 block text-black dark:text-white">
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded border-[1.5px] border-stroke bg-transparent py-3 px-5 font-medium outline-none transition focus:border-primary active:border-primary disabled:cursor-default disabled:bg-whiter dark:border-form-strokedark dark:bg-form-input dark:focus:border-primary"
              >
                <option value="">All Statuses</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>
            
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFilter('');
                  setStatusFilter('');
                }}
                className="rounded bg-meta-5 py-3 px-6 font-medium text-white hover:shadow-1"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-10">
            <p className="text-black dark:text-white">Loading dashboard data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-sm border border-danger bg-danger/10 px-7.5 py-4 mb-4">
            <p className="text-danger">Error: {error}</p>
          </div>
        )}

        {/* Charts View */}
        {!loading && !error && viewMode === 'charts' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-2 2xl:gap-7.5">
            <AvailabilityLineChart data={data} />
            <AssignmentBarChart data={data} />
            <div className="md:col-span-2">
              <StatusPieChart data={data} />
            </div>
          </div>
        )}

        {/* Data Table */}
        {!loading && !error && viewMode === 'table' && (
          <div className="max-w-full overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                    Agent Name
                  </th>
                  <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                    Availability Date
                  </th>
                  <th className="min-w-[150px] py-4 px-4 font-medium text-black dark:text-white">
                    Shift Window
                  </th>
                  <th className="min-w-[120px] py-4 px-4 font-medium text-black dark:text-white">
                    Assignment Status
                  </th>
                  <th className="py-4 px-4 font-medium text-black dark:text-white">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-black dark:text-white">
                      No records found
                    </td>
                  </tr>
                ) : (
                  data.map((record, index) => (
                    <tr key={index} className="border-b border-stroke dark:border-strokedark">
                      <td className="py-4 px-4 text-black dark:text-white">
                        {record.agent_name}
                      </td>
                      <td className="py-4 px-4 text-black dark:text-white">
                        {new Date(record.availability_date).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-black dark:text-white">
                        {record.start_time} - {record.end_time}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex rounded-full bg-opacity-10 py-1 px-3 text-sm font-medium ${
                            record.assignment_status === 'assigned'
                              ? 'bg-success text-success'
                              : 'bg-warning text-warning'
                          }`}
                        >
                          {record.assignment_status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-black dark:text-white">
                        {record.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
