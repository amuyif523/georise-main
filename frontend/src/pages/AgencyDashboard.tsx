import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { severityBadgeClass, severityLabel } from "../utils/severity";
import { useEffect, useState } from "react";
import { getSocket } from "../lib/socket";
import IncidentCard from "../components/incident/IncidentCard";
import AppLayout from "../layouts/AppLayout";

const AgencyDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const sampleQueue = [
    { id: 101, title: "Fire near market", severity: 4 },
    { id: 102, title: "Traffic crash at Ring Road", severity: 3 },
    { id: 103, title: "Power line down", severity: 2 },
  ];
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (inc: any) => {
      setEvents((prev) => [{ ...inc, createdAt: new Date().toISOString() }, ...prev].slice(0, 5));
    };
    socket.on("incident:created", handler);
    socket.on("incident:updated", handler);
    return () => {
      socket?.off("incident:created", handler);
      socket?.off("incident:updated", handler);
    };
  }, []);

  return (
    <AppLayout>
      <div className="min-h-full bg-[#0A0F1A] text-slate-100 pt-16 pb-12">
      <div className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-sm text-cyan-200">Agency workspace</p>
            <h1 className="text-3xl font-bold">Incident queue</h1>
            <p className="text-slate-400 text-sm">
              Incoming incidents with severity badges.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="flex justify-end">
          <Link to="/agency/map" className="btn btn-primary btn-sm">
            Open dispatch map
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {sampleQueue.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/10"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <span className={severityBadgeClass(item.severity)}>
                  Sev {severityLabel(item.severity)}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-2">ID: {item.id}</div>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-sm text-cyan-200 mb-2">Live events</p>
          <div className="space-y-2">
            {events.map((e) => (
              <IncidentCard
                key={e.id}
                title={e.title || "Incident"}
                category={e.category}
                severity={e.severityScore}
                status={e.status}
                timestamp={e.createdAt}
              />
            ))}
            {events.length === 0 && (
              <div className="text-sm text-slate-400">No recent events yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
    </AppLayout>
  );
};

export default AgencyDashboard;
