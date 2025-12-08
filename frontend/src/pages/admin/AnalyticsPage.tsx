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

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await api.get("/admin/analytics");
      setData(res.data);
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

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-6">
      <div>
        <p className="text-sm text-cyan-200">Admin control</p>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-slate-400 text-sm">Overview of incidents and agency load.</p>
      </div>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {data ? (
        <>
          <div className="grid md:grid-cols-3 gap-3">
            <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
              <p className="text-xs text-slate-400">Total incidents</p>
              <p className="text-2xl font-bold text-white">{data.totals.total}</p>
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
          <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1117]">
            <Bar data={chartData} />
          </div>
        </>
      ) : (
        <div className="text-slate-300">Loading…</div>
      )}
    </div>
  );
};

export default AnalyticsPage;
