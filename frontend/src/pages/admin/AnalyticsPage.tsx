import React, { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import api from "../../lib/api";

ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PointElement);

type IncidentMetrics = {
  total: number;
  active: number;
  resolved: number;
  avgSeverity: number | null;
  byDay: { day: string; count: number }[];
};

type AgencyMetric = {
  agencyId: number;
  name: string;
  type: string;
  isActive: boolean;
  total: number;
  resolved: number;
};

type AgenciesResponse = { agencies: AgencyMetric[] };

const KPICard: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow shadow-cyan-500/5">
    <p className="text-xs text-slate-400">{label}</p>
    <p className="text-2xl font-bold text-cyan-200">{value}</p>
  </div>
);

const AnalyticsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentMetrics | null>(null);
  const [agencies, setAgencies] = useState<AgencyMetric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incRes, agRes] = await Promise.all([
          api.get("/admin/metrics/incidents"),
          api.get("/admin/metrics/agencies"),
        ]);
        setIncidents(incRes.data);
        setAgencies((agRes.data as AgenciesResponse).agencies || []);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || "Failed to load analytics");
      }
    };
    fetchData();
  }, []);

  const trendData = incidents
    ? {
        labels: incidents.byDay.map((d) => new Date(d.day).toLocaleDateString()),
        datasets: [
          {
            label: "Incidents per day",
            data: incidents.byDay.map((d) => d.count),
            borderColor: "#22d3ee",
            backgroundColor: "rgba(34,211,238,0.2)",
          },
        ],
      }
    : null;

  const agencyBar =
    agencies.length > 0
      ? {
          labels: agencies.map((a) => a.name),
          datasets: [
            {
              label: "Total",
              data: agencies.map((a) => a.total),
              backgroundColor: "rgba(94,234,212,0.6)",
            },
            {
              label: "Resolved",
              data: agencies.map((a) => a.resolved),
              backgroundColor: "rgba(251,191,36,0.6)",
            },
          ],
        }
      : null;

  const exportCsv = () => {
    window.open(`${api.defaults.baseURL?.replace("/api", "")}/api/admin/export/incidents`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-cyan-200">Admin dashboard</p>
          <h1 className="text-3xl font-bold">Operational Analytics</h1>
          <p className="text-slate-400 text-sm">Live KPIs across incidents and agencies.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export Incidents CSV
        </button>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {incidents ? (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <KPICard label="Total incidents" value={incidents.total} />
            <KPICard label="Active" value={incidents.active} />
            <KPICard label="Resolved" value={incidents.resolved} />
            <KPICard label="Avg severity" value={(incidents.avgSeverity ?? 0).toFixed(2)} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
              <p className="text-sm text-slate-300 mb-2">Incidents over time</p>
              {trendData ? <Line data={trendData} /> : <p className="text-slate-400 text-sm">No data</p>}
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
              <p className="text-sm text-slate-300 mb-2">Agency load</p>
              {agencyBar ? <Bar data={agencyBar} /> : <p className="text-slate-400 text-sm">No data</p>}
            </div>
          </div>
        </>
      ) : (
        <div className="text-slate-300">Loading…</div>
      )}
    </div>
  );
};

export default AnalyticsPage;
