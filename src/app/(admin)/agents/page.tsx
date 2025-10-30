'use client';

import { useState, useEffect } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates';
import { showNotification } from '@/components/Notifications';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'on_leave';
  created_at: string;
}

type ModalMode = 'add' | 'edit' | 'delete' | null;

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    status: 'active' as Agent['status'],
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/agents');
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Failed to fetch agents');
      }

      setAgents(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to agents table changes
  useRealtimeUpdates<Agent>({
    table: 'agents',
    onInsert: (record) => {
      console.log('[Agents] New agent added:', record.name);
      showNotification(`✅ New agent added: ${record.name}`, 'success');
      fetchAgents();
    },
    onUpdate: (record) => {
      console.log('[Agents] Agent updated:', record.name);
      showNotification(`🔄 Agent updated: ${record.name}`, 'update');
      fetchAgents();
    },
    onDelete: (record) => {
      console.log('[Agents] Agent deleted:', record.name);
      showNotification(`🗑️ Agent deleted: ${record.name}`, 'delete');
      fetchAgents();
    },
  });

  const openAddModal = () => {
    setFormData({ name: '', email: '', role: '', status: 'active' });
    setSelectedAgent(null);
    setModalMode('add');
  };

  const openEditModal = (agent: Agent) => {
    setFormData({
      name: agent.name,
      email: agent.email,
      role: agent.role,
      status: agent.status,
    });
    setSelectedAgent(agent);
    setModalMode('edit');
  };

  const openDeleteModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedAgent(null);
    setFormData({ name: '', email: '', role: '', status: 'active' });
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (modalMode === 'add') {
        const response = await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.details || json.error || 'Failed to create agent');
        }

        await fetchAgents();
        closeModal();
      } else if (modalMode === 'edit' && selectedAgent) {
        const response = await fetch('/api/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedAgent.id, ...formData }),
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.details || json.error || 'Failed to update agent');
        }

        await fetchAgents();
        closeModal();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/agents?id=${selectedAgent.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.details || json.error || 'Failed to delete agent');
      }

      await fetchAgents();
      closeModal();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: Agent['status']) => {
    const colors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
      on_leave: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    };

    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${colors[status]}`}
      >
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageBreadCrumb pageTitle="Agents Management" />

      <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-9">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title-md2 font-bold text-black dark:text-white">
            All Agents
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
            Add Agent
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

        {!loading && !error && agents.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-body dark:text-bodydark">
              No agents found. Add your first agent to get started.
            </p>
          </div>
        )}

        {!loading && !error && agents.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Name
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Email
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Role
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Status
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Created
                  </th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id} className="border-b border-stroke dark:border-strokedark">
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">{agent.name}</p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">{agent.email}</p>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">{agent.role}</p>
                    </td>
                    <td className="px-4 py-5">{getStatusBadge(agent.status)}</td>
                    <td className="px-4 py-5">
                      <p className="text-black dark:text-white">
                        {new Date(agent.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center space-x-3.5">
                        <button
                          onClick={() => openEditModal(agent)}
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
                          onClick={() => openDeleteModal(agent)}
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
              {modalMode === 'add' && 'Add New Agent'}
              {modalMode === 'edit' && 'Edit Agent'}
              {modalMode === 'delete' && 'Delete Agent'}
            </h3>

            {modalMode === 'delete' ? (
              <>
                <p className="mb-6 text-body dark:text-bodydark">
                  Are you sure you want to delete <strong>{selectedAgent?.name}</strong>?
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
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  />
                </div>

                <div className="mb-6">
                  <label className="mb-2.5 block text-black dark:text-white">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({ ...formData, status: e.target.value as Agent['status'] })
                    }
                    required
                    className="w-full rounded border border-stroke bg-transparent px-4 py-3 text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="on_leave">On Leave</option>
                  </select>
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
                    {submitting ? 'Saving...' : modalMode === 'add' ? 'Add Agent' : 'Save Changes'}
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
