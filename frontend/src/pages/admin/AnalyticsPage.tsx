import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import api from "../../lib/api";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type AnalyticsResponse = {
  totals: { total: number; active: number; resolved: number };
  byAgency: { agencyId: number | null; agencyName: string | null; count: number }[];
};

type StatsResponse = {
  total: number;
  highSeverity: number;
  weekIncidents: number;
  perCategory: { category: string | null; _count: { _all: number } }[];
};

type ClusterPoint = { cluster_id: number; lat: number; lng: number; id: number };

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [clusters, setClusters] = useState<ClusterPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [adminRes, statsRes, clustersRes] = await Promise.all([
        api.get("/admin/analytics"),
        api.get("/analytics/stats"),
        api.get("/analytics/clusters"),
      ]);
      setData(adminRes.data);
      setStats(statsRes.data);
      setClusters(clustersRes.data.clusters || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load analytics");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const chartData = {
    labels: data?.byAgency.map((a) => a.agencyName || "Unassigned") || [],
    datasets: [
      {
        label: "Incidents per agency",
        data: data?.byAgency.map((a) => a.count) || [],
        backgroundColor: "#0ea5e9",
      },
    ],
  };

  const categoryChart = {
    labels: stats?.perCategory.map((c) => c.category || "Uncategorized") || [],
    datasets: [
      {
        label: "By category",
        data: stats?.perCategory.map((c) => c._count._all) || [],
        backgroundColor: "#8b5cf6",
      },
    ],
  };

  const clusterSummary = Object.values(
    clusters.reduce((acc: Record<number, number>, cur) => {
      acc[cur.cluster_id] = (acc[cur.cluster_id] || 0) + 1;
      return acc;
    }, {})
  );

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-6">
      <div>
        <p className="text-sm text-cyan-200">Admin control</p>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-slate-400 text-sm">Overview of incidents, load, and hotspots.</p>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {data ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <p className="text-xs text-slate-400">Total incidents</p>
              <p className="text-2xl font-bold text-white">{stats?.total ?? data.totals.total}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <p className="text-xs text-slate-400">Active</p>
              <p className="text-2xl font-bold text-white">{data.totals.active}</p>
            </div>
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <p className="text-xs text-slate-400">Resolved</p>
              <p className="text-2xl font-bold text-white">{data.totals.resolved}</p>
            </div>
          </div>
          {stats && (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
                <p className="text-xs text-slate-400">High severity (4-5)</p>
                <p className="text-2xl font-bold text-white">{stats.highSeverity}</p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
                <p className="text-xs text-slate-400">Incidents last 7 days</p>
                <p className="text-2xl font-bold text-white">{stats.weekIncidents}</p>
              </div>
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
                <p className="text-xs text-slate-400">Hotspot clusters</p>
                <p className="text-2xl font-bold text-white">{clusterSummary.length || 0}</p>
              </div>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <Bar data={chartData} />
            </div>
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <Bar data={categoryChart} />
            </div>
          </div>
          {clusterSummary.length > 0 && (
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <h3 className="text-lg font-semibold mb-2">Cluster sizes</h3>
              <div className="flex flex-wrap gap-2">
                {clusterSummary.map((count, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm"
                  >
                    Cluster {idx + 1}: <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-slate-300">Loading…</div>
      )}
    </div>
  );
};

export default AnalyticsPage;
