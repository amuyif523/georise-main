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

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await api.get("/admin/audit");
      setLogs(res.data.logs || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

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
        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-lg border border-slate-800 bg-[#0D1117] shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {log.action} → {log.targetType} #{log.targetId ?? "—"}
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
      )}
    </div>
  );
};

export default AuditLogsPage;
