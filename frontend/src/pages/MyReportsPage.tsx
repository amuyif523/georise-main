import React, { useEffect, useState } from "react";
import { MapPin, Shield, Sparkles } from "lucide-react";
import api from "../lib/api";
import { severityBadgeClass, severityLabel } from "../utils/severity";

type Incident = {
  id: number;
  title: string;
  description: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  aiOutput?: {
    predictedCategory: string;
    severityScore: number;
    confidence: number;
    summary?: string | null;
  } | null;
};

const statusColor = (status: string) => {
  switch (status) {
    case "RECEIVED":
      return "badge badge-info";
    case "UNDER_REVIEW":
      return "badge badge-warning";
    case "ASSIGNED":
    case "RESPONDING":
      return "badge badge-primary";
    case "RESOLVED":
      return "badge badge-success";
    case "CANCELLED":
      return "badge badge-neutral";
    default:
      return "badge badge-ghost";
  }
};

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const MyReportsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get("/incidents/my");
        setIncidents(res.data.incidents || []);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Failed to load incidents");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 pt-16 pb-12">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-cyan-200">Citizen workspace</p>
            <h1 className="text-3xl font-bold">My Reports</h1>
            <p className="text-slate-400 text-sm">
              Recently submitted incidents with AI tags and status.
            </p>
          </div>
          <div className="flex items-center gap-2 text-cyan-200">
            <Sparkles size={18} />
            <span className="text-sm">AI-assisted categories</span>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-12 text-slate-300">Loading...</div>
        ) : incidents.length === 0 ? (
          <div className="p-8 border border-dashed border-slate-700 rounded-lg text-center text-slate-300">
            No incidents yet. Start by submitting one from the wizard.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {incidents.map((incident) => (
              <div
                key={incident.id}
                className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{incident.title}</h3>
                    <p className="text-slate-400 text-sm">
                      {new Date(incident.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={statusColor(incident.status)}>{incident.status}</span>
                    <span className={severityBadgeClass(incident.severityScore)}>
                      Sev {severityLabel(incident.severityScore)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-200 line-clamp-3">
                  {incident.description}
                </div>
                <div className="mt-3 flex items-center gap-2 text-slate-300 text-sm">
                  <MapPin size={16} className="text-cyan-300" />
                  {incident.latitude && incident.longitude
                    ? `${incident.latitude.toFixed(3)}, ${incident.longitude.toFixed(3)}`
                    : "No location set"}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
                  <Shield size={16} className="text-amber-300" />
                  <span>
                    Category: {incident.category ?? "Pending"} · AI severity:{" "}
                    {severityLabel(incident.severityScore)}
                  </span>
                </div>
                {incident.aiOutput?.summary && (
                  <div className="mt-2 text-xs text-slate-400">
                    AI summary: {incident.aiOutput.summary}
                  </div>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  ID: {incident.id} · Created: {formatDate(incident.createdAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyReportsPage;
