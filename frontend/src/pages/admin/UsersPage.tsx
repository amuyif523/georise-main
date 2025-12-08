import React, { useEffect, useState } from "react";
import api from "../../lib/api";

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  citizenVerification?: { status: string } | null;
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data.users || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggle = async (id: number) => {
    await api.patch(`/admin/users/${id}/toggle`);
    fetchUsers();
  };

  const verify = async (id: number) => {
    await api.patch(`/admin/users/${id}/verify`);
    fetchUsers();
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-4">
      <div>
        <p className="text-sm text-cyan-200">Admin control</p>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-slate-400 text-sm">Activate / deactivate accounts.</p>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verification</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>
                    <span className={`badge ${u.isActive ? "badge-success" : "badge-ghost"}`}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        u.citizenVerification?.status === "VERIFIED"
                          ? "badge-info"
                          : "badge-ghost"
                      }`}
                    >
                      {u.citizenVerification?.status || "Unverified"}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-xs" onClick={() => toggle(u.id)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {u.citizenVerification?.status !== "VERIFIED" && (
                      <button className="btn btn-xs btn-outline ml-2" onClick={() => verify(u.id)}>
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
