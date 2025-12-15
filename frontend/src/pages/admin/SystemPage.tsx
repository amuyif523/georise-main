import React, { useState } from "react";
import AppLayout from "../../layouts/AppLayout";
import { useSystem } from "../../context/SystemContext";
import { AlertTriangle, Radio, ShieldAlert } from "lucide-react";

const SystemPage: React.FC = () => {
  const { crisisMode, toggleCrisisMode, sendBroadcast } = useSystem();
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (confirm(`Are you sure you want to ${crisisMode ? "DISABLE" : "ENABLE"} Crisis Mode?`)) {
      setLoading(true);
      await toggleCrisisMode(!crisisMode);
      setLoading(false);
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    if (confirm("Send this broadcast to ALL connected users?")) {
      setLoading(true);
      await sendBroadcast(broadcastMsg);
      setBroadcastMsg("");
      setLoading(false);
      alert("Broadcast sent.");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <ShieldAlert className="text-red-500" />
          System Control
        </h1>

        {/* Crisis Mode Toggle */}
        <div className={`p-6 rounded-xl border-2 ${crisisMode ? "border-red-500 bg-red-950/30" : "border-slate-700 bg-slate-900"}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className={crisisMode ? "text-red-500 animate-pulse" : "text-slate-500"} />
                Crisis Mode
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                When active, low-priority reporting categories are disabled and a city-wide banner is shown.
              </p>
            </div>
            <button 
              className={`btn ${crisisMode ? "btn-error" : "btn-outline"} btn-lg`}
              onClick={handleToggle}
              disabled={loading}
            >
              {crisisMode ? "DEACTIVATE CRISIS MODE" : "ACTIVATE CRISIS MODE"}
            </button>
          </div>
        </div>

        {/* Broadcast System */}
        <div className="p-6 rounded-xl border border-slate-700 bg-slate-900">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
            <Radio className="text-cyan-400" />
            Emergency Broadcast
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            Send an immediate alert to all connected users (Citizens, Agencies, Responders).
          </p>
          
          <form onSubmit={handleBroadcast} className="space-y-4">
            <textarea 
              className="textarea textarea-bordered w-full bg-slate-950 text-white font-mono"
              rows={4}
              placeholder="ATTENTION: Severe flooding reported in Bole area. Avoid lower roads..."
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
            />
            <div className="flex justify-end">
              <button 
                type="submit" 
                className="btn btn-warning"
                disabled={!broadcastMsg.trim() || loading}
              >
                Send Broadcast
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
};

export default SystemPage;
