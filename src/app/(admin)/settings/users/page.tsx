"use client";

import { useEffect, useState } from 'react';
import PageBreadCrumb from '@/components/common/PageBreadCrumb';
import { showNotification } from '@/components/Notifications';

type Role = 'admin' | 'dispatcher' | 'agent' | null;
interface UserItem { id: string; email: string | null; role: Role }

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load users');
      setUsers(json.data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (userId: string, role: Exclude<Role, null>) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update role');
      showNotification(`✅ Updated role to ${role}`, 'success');
      await fetchUsers();
    } catch (e: any) {
      showNotification(`❌ ${e?.message || 'Failed to update role'}`, 'delete');
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageBreadCrumb pageTitle="User Roles" />
      <div className="rounded-sm border border-stroke bg-white p-4 shadow-default dark:border-strokedark dark:bg-boxdark md:p-6 xl:p-9">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-title-md2 font-bold text-black dark:text-white">Users & Roles</h2>
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

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-2 text-left dark:bg-meta-4">
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Email</th>
                  <th className="px-4 py-4 font-medium text-black dark:text-white">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-stroke dark:border-strokedark">
                    <td className="px-4 py-5"><p className="text-black dark:text-white">{u.email || '-'}</p></td>
                    <td className="px-4 py-5">
                      <select
                        className="rounded border border-stroke bg-transparent px-3 py-2 text-sm text-black outline-none focus:border-primary dark:border-strokedark dark:text-white"
                        value={u.role || ''}
                        onChange={(e) => updateRole(u.id, e.target.value as any)}
                      >
                        <option value="">Select role</option>
                        <option value="admin">Admin</option>
                        <option value="dispatcher">Dispatcher</option>
                        <option value="agent">Agent</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
