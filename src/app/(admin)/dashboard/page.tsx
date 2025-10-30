'use client';

import { useState, useEffect } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';

interface DashboardRecord {
  agent_id?: string;
  agent_name: string;
  availability_date: string;
  start_time: string;
  end_time: string;
  assignment_status: string;
  notes?: string | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  useEffect(() => {
    fetchDashboardData();
  }, [dateFilter, statusFilter]);

  return (
    <>
      <PageBreadCrumb pageTitle="Dashboard" />
      
      <div className="rounded-sm border border-stroke bg-white px-7.5 py-6 shadow-default dark:border-strokedark dark:bg-boxdark">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-black dark:text-white mb-4">
            Agent Availability & Assignments
          </h2>
          
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

        {/* Data Table */}
        {!loading && !error && (
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
