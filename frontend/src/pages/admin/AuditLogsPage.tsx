import React, { useEffect, useState } from "react";
import api from "../../lib/api";

type AuditLog = {
  id: number;
  actor: { id: number; fullName: string; email: string };
  action: string;
  targetType: string;
  targetId?: number | null;
  note?: string | null;
  createdAt: string;
};

const PAGE_SIZE = 50;

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (nextPage = 1) => {
    try {
      setLoading(true);
      const res = await api.get("/admin/audit", { params: { page: nextPage, pageSize: PAGE_SIZE } });
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
      setPage(nextPage);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-4">
      <div>
        <p className="text-sm text-cyan-200">Admin control</p>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-slate-400 text-sm">Recent sensitive actions.</p>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-800 bg-[#0D1117] shadow"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">
                      {log.action} → {log.targetType} #{log.targetId ?? "N/A"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {log.actor.fullName} ({log.actor.email})
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
                {log.note && <p className="text-xs text-slate-400 mt-1">Note: {log.note}</p>}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-3">
            <button className="btn btn-xs" disabled={page <= 1} onClick={() => fetchLogs(page - 1)}>
              Prev
            </button>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages} ({total} records)
            </span>
            <button
              className="btn btn-xs"
              disabled={page >= totalPages}
              onClick={() => fetchLogs(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogsPage;
