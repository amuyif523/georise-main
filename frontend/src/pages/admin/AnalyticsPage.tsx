import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  ArcElement,
} from "chart.js";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import api from "../../lib/api";

ChartJS.register(LineElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, PointElement, ArcElement);

type KpiResponse = {
  avgDispatch: number | null;
  avgArrival: number | null;
  resolutionRate: number | null;
};

type TimelineRow = { day: string; count: number };
type HeatPoint = { lat: number; lng: number; severity: number };
type ClusterRow = { cluster_id: number; severity: number };

const KPICard: React.FC<{ label: string; value: string | number; accent?: string }> = ({ label, value, accent }) => (
  <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow shadow-cyan-500/5">
    <p className="text-xs text-slate-400">{label}</p>
    <p className={`text-2xl font-bold ${accent || "text-cyan-200"}`}>{value}</p>
  </div>
);

const AnalyticsPage: React.FC = () => {
  const [kpi, setKpi] = useState<KpiResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [heat, setHeat] = useState<HeatPoint[]>([]);
  const [clusters, setClusters] = useState<ClusterRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpiRes, timelineRes, heatRes, clusterRes] = await Promise.all([
          api.get("/analytics/kpi"),
          api.get("/analytics/timeline"),
          api.get("/analytics/heatmap"),
          api.get("/analytics/clusters"),
        ]);
        setKpi(kpiRes.data);
        setTimeline(timelineRes.data || []);
        setHeat(heatRes.data || []);
        setClusters(clusterRes.data || []);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg || "Failed to load analytics");
      }
    };
    fetchData();
  }, []);

  const trendData = useMemo(() => {
    if (!timeline.length) return null;
    return {
      labels: timeline.map((d) => new Date(d.day).toLocaleDateString()),
      datasets: [
        {
          label: "Incidents per day",
          data: timeline.map((d) => d.count),
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34,211,238,0.2)",
          tension: 0.35,
        },
      ],
    };
  }, [timeline]);

  const severityBuckets = useMemo(() => {
    const low = heat.filter((p) => p.severity <= 2).length;
    const med = heat.filter((p) => p.severity > 2 && p.severity < 4).length;
    const high = heat.filter((p) => p.severity >= 4).length;
    return { low, med, high };
  }, [heat]);

  const severityDonut =
    heat.length > 0
      ? {
          labels: ["Low (0-2)", "Medium (3-3.9)", "High (4-5)"],
          datasets: [
            {
              data: [severityBuckets.low, severityBuckets.med, severityBuckets.high],
              backgroundColor: ["#22c55e", "#f97316", "#ef4444"],
            },
          ],
        }
      : null;

  const clusterAgg = useMemo(() => {
    const counts: Record<number, number> = {};
    clusters.forEach((c) => {
      counts[c.cluster_id] = (counts[c.cluster_id] || 0) + 1;
    });
    const labels = Object.keys(counts);
    return labels.length
      ? {
          labels: labels.map((l) => `Cluster ${l}`),
          datasets: [
            {
              label: "Incidents",
              data: labels.map((l) => counts[Number(l)]),
              backgroundColor: "rgba(129,140,248,0.6)",
            },
          ],
        }
      : null;
  }, [clusters]);

  const exportCsv = () => {
    window.open(`${api.defaults.baseURL?.replace("/api", "")}/api/admin/export/incidents`, "_blank");
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-cyan-200">Admin dashboard</p>
          <h1 className="text-3xl font-bold">Operational Analytics</h1>
          <p className="text-slate-400 text-sm">Live KPIs, heatmaps, clusters, and trends.</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={exportCsv}>
          Export Incidents CSV
        </button>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {kpi ? (
        <>
          <div className="grid md:grid-cols-4 gap-3">
            <KPICard label="Avg dispatch (min)" value={kpi.avgDispatch !== null ? kpi.avgDispatch.toFixed(1) : "—"} />
            <KPICard label="Avg arrival (min)" value={kpi.avgArrival !== null ? kpi.avgArrival.toFixed(1) : "—"} />
            <KPICard
              label="Resolution rate (%)"
              value={kpi.resolutionRate !== null ? kpi.resolutionRate.toFixed(1) : "—"}
            />
            <KPICard label="Heatmap points" value={heat.length} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
              <p className="text-sm text-slate-300 mb-2">Incidents over time</p>
              {trendData ? <Line data={trendData} /> : <p className="text-slate-400 text-sm">No data</p>}
            </div>
            <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
              <p className="text-sm text-slate-300 mb-2">Severity distribution</p>
              {severityDonut ? <Doughnut data={severityDonut} /> : <p className="text-slate-400 text-sm">No data</p>}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-[#0D1117]">
            <p className="text-sm text-slate-300 mb-2">Hotspot clusters (count per cluster)</p>
            {clusterAgg ? <Bar data={clusterAgg} /> : <p className="text-slate-400 text-sm">No clusters yet</p>}
          </div>
        </>
      ) : (
        <div className="text-slate-300">Loading…</div>
      )}
    </div>
  );
};

export default AnalyticsPage;
