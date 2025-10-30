'use client';

import { useState, useEffect } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import { showNotification } from '@/components/Notifications';

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

type ModalMode = 'add' | 'edit' | 'delete' | null;

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    location: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchShifts();
  }, []);

  const fetchShifts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/shifts');
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch shifts');
      }

      setShifts(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to shifts table changes
  useRealtimeUpdates<Shift>({
    table: 'shifts',
    onInsert: (record) => {
      const shiftDate = new Date(record.date).toLocaleDateString();
      console.log('[Shifts] New shift added:', shiftDate);
      showNotification(`✅ New shift added for ${shiftDate}`, 'success');
      fetchShifts();
    },
    onUpdate: (record) => {
      const shiftDate = new Date(record.date).toLocaleDateString();
      console.log('[Shifts] Shift updated:', shiftDate);
      showNotification(`🔄 Shift updated for ${shiftDate}`, 'update');
      fetchShifts();
    },
    onDelete: (record) => {
      const shiftDate = new Date(record.date).toLocaleDateString();
      console.log('[Shifts] Shift deleted:', shiftDate);
      showNotification(`🗑️ Shift deleted for ${shiftDate}`, 'delete');
      fetchShifts();
    },
  });

  const openAddModal = () => {
    setFormData({ date: '', start_time: '', end_time: '', location: '', notes: '' });
    setSelectedShift(null);
    setModalMode('add');
  };

  const openEditModal = (shift: Shift) => {
    setFormData({
      date: shift.date,
      start_time: shift.start_time.substring(0, 5), // HH:MM from HH:MM:SS
      end_time: shift.end_time.substring(0, 5),
      location: shift.location || '',
      notes: shift.notes || '',
    });
    setSelectedShift(shift);
    setModalMode('edit');
  };

  const openDeleteModal = (shift: Shift) => {
    setSelectedShift(shift);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedShift(null);
    setFormData({ date: '', start_time: '', end_time: '', location: '', notes: '' });
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalMode === 'add') {
        const response = await fetch('/api/shifts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.details || json.error || 'Failed to create shift');
        }

        await fetchShifts();
        closeModal();
      } else if (modalMode === 'edit' && selectedShift) {
        const response = await fetch('/api/shifts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedShift.id, ...formData }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.details || json.error || 'Failed to update shift');
        }

        await fetchShifts();
        closeModal();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedShift) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/shifts?id=${selectedShift.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.details || json.error || 'Failed to delete shift');
      }

      await fetchShifts();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (time: string) => {
    // Display HH:MM from HH:MM:SS
    return time.substring(0, 5);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageBreadCrumb pageTitle="Shifts Management" />

      <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-9">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title-md2 font-bold text-black dark:text-white">
            All Shifts
          </h2>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-3 text-center font-medium text-white hover:bg-opacity-90"
          >
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Shift
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-t-transparent"></div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && shifts.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-body dark:text-bodydark">
              No shifts found. Add your first shift to get started.
            </p>
          </div>
        )}

        {!loading && !error && shifts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Date
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Start Time
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    End Time
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Location
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Notes
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-stroke dark:border-strokedark">
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {new Date(shift.date).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {formatTime(shift.start_time)}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {formatTime(shift.end_time)}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {shift.location || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {shift.notes ? (
                          <span className="max-w-xs truncate" title={shift.notes}>
                            {shift.notes}
                          </span>
                        ) : (
                          '-'
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center space-x-3.5">
                        <button
                          onClick={() => openEditModal(shift)}
                          className="hover:text-primary"
                          title="Edit"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => openDeleteModal(shift)}
                          className="hover:text-red-500"
                          title="Delete"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-999 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-boxdark">
            <h3 className="mb-4 text-xl font-semibold text-black dark:text-white">
              {modalMode === 'add' && 'Add New Shift'}
              {modalMode === 'edit' && 'Edit Shift'}
              {modalMode === 'delete' && 'Delete Shift'}
            </h3>

            {modalMode === 'delete' ? (
              <>
                <p className="mb-6 text-body dark:text-bodydark">
                  Are you sure you want to delete this shift on{' '}
                  <strong>{selectedShift && new Date(selectedShift.date).toLocaleDateString()}</strong>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded bg-gray-200 px-4 py-2 text-black hover:bg-gray-300 dark:bg-meta-4 dark:text-white dark:hover:bg-opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    {submitting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="mb-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2.5 block text-black dark:text-white">
                      Start Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                      className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2.5 block text-black dark:text-white">
                      End Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                      className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded bg-gray-200 px-4 py-2 text-black hover:bg-gray-300 dark:bg-meta-4 dark:text-white dark:hover:bg-opacity-80"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded bg-primary px-4 py-2 text-white hover:bg-opacity-90 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : modalMode === 'add' ? 'Add Shift' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
