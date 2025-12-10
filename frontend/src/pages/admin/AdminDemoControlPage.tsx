import React, { useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import api from "../../lib/api";

const AdminDemoControlPage: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const append = (msg: string) => setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const resetDemo = async () => {
    if (!confirm("This will delete all demo incidents, units, and assignments. Continue?")) return;
    setBusy(true);
    try {
      await api.post("/demo/reset");
      append("Demo data cleared.");
    } catch {
      append("Failed to reset demo data.");
    } finally {
      setBusy(false);
    }
  };

  const startDemo = async () => {
    if (!confirm("Seed demo scenario ADDIS_SCENARIO_1 now?")) return;
    setBusy(true);
    try {
      await api.post("/demo/start");
      append("Demo scenario seeded (Addis Scenario 1).");
    } catch {
      append("Failed to seed scenario.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="cyber-card">
          <h2 className="text-lg font-semibold mb-2">Scenario Controls</h2>
          <p className="text-sm text-slate-400 mb-4">
            Use before your viva to reset and seed a fresh, realistic dataset.
          </p>
          <div className="space-y-3">
            <button className={`btn btn-outline btn-error w-full ${busy ? "loading" : ""}`} onClick={resetDemo} disabled={busy}>
              Reset Demo Data
            </button>
            <button className={`btn btn-primary w-full ${busy ? "loading" : ""}`} onClick={startDemo} disabled={busy}>
              Seed Addis Scenario 1
            </button>
          </div>
          <div className="mt-6 text-xs text-slate-400">
            <p>Recommended exam flow:</p>
            <ol className="list-decimal ml-4 mt-1 space-y-1">
              <li>Reset demo data.</li>
              <li>Seed Addis Scenario 1.</li>
              <li>Open Agency dashboards and map.</li>
              <li>Show dispatch suggestions and timelines.</li>
              <li>Open Analytics to show KPIs and trends.</li>
            </ol>
          </div>
        </div>
        <div className="cyber-card">
          <h2 className="text-lg font-semibold mb-2">Activity Log</h2>
          <div className="h-64 overflow-y-auto bg-slate-950/40 border border-slate-800 rounded p-2 text-xs font-mono">
            {log.length === 0 && <p className="text-slate-500">No actions yet.</p>}
            {log.map((l, i) => (
              <div key={i} className="text-slate-300 mb-1">
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDemoControlPage;
