'use client';

import { useState, FormEvent } from 'react';
import type { AgentAvailability, AvailabilityResponse } from './types';

export default function AddAvailabilityForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<Omit<AgentAvailability, 'id'>>({
    agent_name: '',
    availability_date: '',
    start_time: '',
    end_time: '',
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json() as AvailabilityResponse;

      if (!response.ok || result.error) {
        const errorMsg = result.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('❌ Form submission error:', {
          status: response.status,
          statusText: response.statusText,
          error: result.error,
          details: result
        });
        throw new Error(errorMsg);
      }

      // Clear form and show success message
      setFormData({ agent_name: '', availability_date: '', start_time: '', end_time: '' });
      setMessage({ type: 'success', text: 'Saved successfully!' });

      // Dispatch event with created record (if returned) so tables can update optimistically
      try {
        const created = Array.isArray(result.data) ? result.data[0] : result.data ?? null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('availability:added', { detail: created }));
        }
      } catch (e) {
        // ignore event dispatch failures
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to add availability' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Add Availability</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="agent_name" className="block text-sm font-medium text-gray-300 mb-1">
              Agent Name
            </label>
            <input
              id="agent_name"
              type="text"
              value={formData.agent_name}
              onChange={(e) => setFormData((p) => ({ ...p, agent_name: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label htmlFor="availability_date" className="block text-sm font-medium text-gray-300 mb-1">
              Date
            </label>
            <input
              id="availability_date"
              type="date"
              value={formData.availability_date}
              onChange={(e) => setFormData((p) => ({ ...p, availability_date: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label htmlFor="start_time" className="block text-sm font-medium text-gray-300 mb-1">
              Start Time
            </label>
            <input
              id="start_time"
              type="time"
              value={formData.start_time}
              onChange={(e) => setFormData((p) => ({ ...p, start_time: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label htmlFor="end_time" className="block text-sm font-medium text-gray-300 mb-1">
              End Time
            </label>
            <input
              id="end_time"
              type="time"
              value={formData.end_time}
              onChange={(e) => setFormData((p) => ({ ...p, end_time: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>
        </div>

        {message && (
          <div
            className={`p-3 rounded-md ${
              message.type === 'success'
                ? 'bg-emerald-900/40 border border-emerald-500 text-emerald-200'
                : 'bg-red-900/40 border border-red-500 text-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}