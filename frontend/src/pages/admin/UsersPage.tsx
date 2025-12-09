/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import PageWrapper from "../../components/layout/PageWrapper";

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  citizenVerification?: { status: string } | null;
};

const badge = (text: string, tone: "blue" | "green" | "gray") => {
  const map: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-200 border-blue-400/30",
    green: "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    gray: "bg-slate-700/40 text-slate-200 border-slate-500/30",
  };
  return <span className={`badge badge-sm border ${map[tone]}`}>{text}</span>;
};

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  const setStatus = async (id: number, next: boolean) => {
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} this user?`)) return;
    await api.patch(`/admin/users/${id}/status`, { isActive: next });
    fetchUsers();
  };

  const verify = async (id: number) => {
    if (!window.confirm("Mark this user as VERIFIED?")) return;
    await api.patch(`/admin/users/${id}/verify`);
    fetchUsers();
  };

  const filtered = users.filter(
    (u) =>
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageWrapper title="Users">
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          className="input input-sm input-bordered bg-slate-900 border-slate-700 text-white"
          placeholder="Search name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  <td>{badge(u.role, "blue")}</td>
                  <td>{badge(u.isActive ? "Active" : "Inactive", u.isActive ? "green" : "gray")}</td>
                  <td>
                    {badge(
                      u.citizenVerification?.status === "VERIFIED" ? "Verified" : "Unverified",
                      u.citizenVerification?.status === "VERIFIED" ? "green" : "gray"
                    )}
                  </td>
                  <td className="space-x-2">
                    <button className="btn btn-xs" onClick={() => setStatus(u.id, !u.isActive)}>
                      {u.isActive ? "Deactivate" : "Activate"}
                    </button>
                    {u.citizenVerification?.status !== "VERIFIED" && (
                      <button className="btn btn-xs btn-outline" onClick={() => verify(u.id)}>
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
    </PageWrapper>
  );
};

export default UsersPage;
