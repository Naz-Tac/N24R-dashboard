'use client';

import { useEffect, useState } from 'react';
import type { AgentAvailability, AvailabilityResponse } from './types';

export default function AvailabilityTable() {
  const [data, setData] = useState<AgentAvailability[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/availability');
      if (!res.ok) throw new Error('Failed to load availability');
      
      const json = await res.json() as AvailabilityResponse;
      if (json.error) throw new Error(json.error);
      
      setData(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleNewRecord = (event: Event) => {
      const customEvent = event as CustomEvent<AgentAvailability>;
      if (customEvent.detail) {
        setData((prev) => 
          prev ? [customEvent.detail, ...prev] : [customEvent.detail]
        );
      } else {
        fetchData(); // Fallback to re-fetch if no detail provided
      }
    };

    window.addEventListener('availability:added', handleNewRecord);
    return () => window.removeEventListener('availability:added', handleNewRecord);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-gray-300">Loading availability...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/40 border border-red-500 rounded-lg p-6 text-center">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-gray-400 text-lg">No availability records found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Agent Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Start Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">End Time</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {data.map((row, i) => (
              <tr key={row.id ?? i} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.agent_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{new Date(row.availability_date).toLocaleDateString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.start_time}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{row.end_time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-400">{data.length} {data.length === 1 ? 'record' : 'records'} found</div>
    </>
  );
}
