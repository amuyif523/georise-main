/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import AppLayout from '../../layouts/AppLayout';
import { useAuth } from '../../context/AuthContext';

type User = {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  citizenVerification?: { status: string } | null;
};

const badge = (text: string, tone: 'blue' | 'green' | 'gray') => {
  const map: Record<string, string> = {
    blue: 'bg-blue-500/20 text-blue-200 border-blue-400/30',
    green: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
    gray: 'bg-slate-700/40 text-slate-200 border-slate-500/30',
  };
  return <span className={`badge badge-sm border ${map[tone]}`}>{text}</span>;
};

const UsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);

  const [createModal, setCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'AGENCY_STAFF',
  });
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const isAgencyAdmin = useMemo(() => user?.role === 'AGENCY_STAFF', [user?.role]);
  const roleOptions = useMemo(
    () => (isAgencyAdmin ? ['AGENCY_STAFF'] : ['ADMIN', 'AGENCY_STAFF', 'CITIZEN']),
    [isAgencyAdmin],
  );

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (roleFilter !== 'ALL') params.role = roleFilter;
      const url = isAgencyAdmin ? '/admin/agency/users' : '/admin/users';
      const res = await api.get(url, { params });
      setUsers(res.data.users || []);
      setTotal(res.data.total ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, roleFilter, page, isAgencyAdmin]);

  const setStatus = async (id: number, next: boolean) => {
    if (!window.confirm(`${next ? 'Activate' : 'Deactivate'} this user?`)) return;
    const url = isAgencyAdmin ? `/admin/agency/users/${id}` : `/admin/users/${id}/status`;
    const body = isAgencyAdmin ? { isActive: next } : { isActive: next };
    await api.patch(url, body);
    fetchUsers();
  };

  const verify = async (id: number) => {
    if (!window.confirm('Mark this user as VERIFIED?')) return;
    await api.patch(`/admin/users/${id}/verify`);
    fetchUsers();
  };

  const invite = async () => {
    const payload = {
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone || undefined,
      role: newUser.role,
    };
    const url = isAgencyAdmin ? '/admin/agency/users' : '/admin/users';
    const res = await api.post(url, payload);
    setTempPassword(res.data?.user?.tempPassword ?? null);
    setCreateModal(false);
    setNewUser({
      fullName: '',
      email: '',
      phone: '',
      role: isAgencyAdmin ? 'AGENCY_STAFF' : 'CITIZEN',
    });
    fetchUsers();
  };

  const forceReset = async (id: number) => {
    const url = isAgencyAdmin
      ? `/admin/agency/users/${id}/force-reset`
      : `/admin/users/${id}/force-reset`;
    const res = await api.post(url);
    const temp = res.data?.tempPassword;
    if (temp) {
      setTempPassword(temp);
      alert(`Temporary password: ${temp}`);
    }
  };

  const filtered = users.filter((u) => {
    if (statusFilter === 'ACTIVE' && !u.isActive) return false;
    if (statusFilter === 'INACTIVE' && u.isActive) return false;
    return (
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <AppLayout>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="input input-sm input-bordered bg-slate-900 border-slate-700 text-white"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select select-sm select-bordered bg-slate-900 border-slate-700 text-white"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="ALL">All roles</option>
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="select select-sm select-bordered bg-slate-900 border-slate-700 text-white"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={() => setCreateModal(true)}>
          Invite user
        </button>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <div className="overflow-x-auto cyber-card">
          <table className="table table-sm text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verification</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.phone ?? '—'}</td>
                  <td>{badge(u.role, 'blue')}</td>
                  <td>
                    {badge(u.isActive ? 'Active' : 'Inactive', u.isActive ? 'green' : 'gray')}
                  </td>
                  <td>
                    {badge(
                      u.citizenVerification?.status === 'VERIFIED' ? 'Verified' : 'Unverified',
                      u.citizenVerification?.status === 'VERIFIED' ? 'green' : 'gray',
                    )}
                  </td>
                  <td className="space-x-2">
                    <button className="btn btn-xs" onClick={() => setStatus(u.id, !u.isActive)}>
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    {!isAgencyAdmin && u.citizenVerification?.status !== 'VERIFIED' && (
                      <button className="btn btn-xs btn-outline" onClick={() => verify(u.id)}>
                        Verify
                      </button>
                    )}
                    <button className="btn btn-xs btn-ghost" onClick={() => forceReset(u.id)}>
                      Force reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between text-sm text-slate-300 mt-3">
            <div>
              Page {page}, showing {filtered.length} of {total} users
            </div>
            <div className="space-x-2">
              <button
                className="btn btn-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="btn btn-xs"
                disabled={page * limit >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {createModal && (
        <div className="modal modal-open">
          <div className="modal-box space-y-3">
            <h3 className="font-bold text-lg">Invite user</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Full name</span>
              </label>
              <input
                className="input input-bordered"
                value={newUser.fullName}
                onChange={(e) => setNewUser((p) => ({ ...p, fullName: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                className="input input-bordered"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Phone</span>
              </label>
              <input
                className="input input-bordered"
                value={newUser.phone}
                onChange={(e) => setNewUser((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Role</span>
              </label>
              <select
                className="select select-bordered"
                value={newUser.role}
                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              >
                {roleOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            {tempPassword && (
              <div className="alert alert-info text-sm">
                Temporary password: <strong>{tempPassword}</strong>
              </div>
            )}
            <div className="modal-action">
              <button className="btn" onClick={() => setCreateModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={invite}>
                Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default UsersPage;
