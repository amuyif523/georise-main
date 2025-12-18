import React, { useEffect, useMemo, useState } from 'react';
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
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import AppLayout from '../layouts/AppLayout';
import api from '../lib/api';

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement,
  ArcElement,
);

type OverviewResponse = {
  totalIncidents: number;
  byCategory: { category: string; count: number }[];
  byStatus: { status: string; count: number }[];
  byDay: { day: string; count: number }[];
  avgResponseMinutes: number | null;
  avgResolutionMinutes: number | null;
};

const ranges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const KPICard: React.FC<{ label: string; value: string | number; subtitle?: string }> = ({
  label,
  value,
  subtitle,
}) => (
  <div className="cyber-card">
    <p className="text-xs text-slate-400 uppercase">{label}</p>
    <p className="text-2xl font-bold text-cyan-200">{value}</p>
    {subtitle && <p className="text-[11px] text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

const AgencyAnalyticsPage: React.FC = () => {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [heatCount, setHeatCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - range * 24 * 60 * 60 * 1000).toISOString();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, heatRes] = await Promise.all([
          api.get('/analytics/overview/agency', { params: { from, to } }),
          api.get('/analytics/heatmap', { params: { from, to } }),
        ]);
        setData(overviewRes.data);
        setHeatCount((heatRes.data || []).length);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [range]);

  const trendData = useMemo(() => {
    if (!data?.byDay?.length) return null;
    return {
      labels: data.byDay.map((d) => new Date(d.day).toLocaleDateString()),
      datasets: [
        {
          label: 'Incidents per day',
          data: data.byDay.map((d) => d.count),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.2)',
          tension: 0.35,
        },
      ],
    };
  }, [data?.byDay]);

  const statusBar = useMemo(() => {
    if (!data?.byStatus?.length) return null;
    return {
      labels: data.byStatus.map((s) => s.status),
      datasets: [
        {
          label: 'Incidents',
          data: data.byStatus.map((s) => s.count),
          backgroundColor: 'rgba(244,114,182,0.6)',
        },
      ],
    };
  }, [data?.byStatus]);

  const categoryPie = useMemo(() => {
    if (!data?.byCategory?.length) return null;
    return {
      labels: data.byCategory.map((c) => c.category),
      datasets: [
        {
          data: data.byCategory.map((c) => c.count),
          backgroundColor: ['#3B82F6', '#F97316', '#22C55E', '#E11D48', '#A855F7', '#0EA5E9'],
        },
      ],
    };
  }, [data?.byCategory]);

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-slate-400 uppercase">Range</span>
        {ranges.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-3 py-1 rounded text-sm ${
              range === r.days ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="alert alert-error text-sm mb-3">{error}</div>}
      {loading && <div className="text-slate-400 text-sm mb-3">Loading analytics…</div>}

      {data && (
        <>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <KPICard label="Incidents" value={data.totalIncidents} subtitle="Your agency scope" />
            <KPICard
              label="Avg response time"
              value={data.avgResponseMinutes ? `${data.avgResponseMinutes.toFixed(1)} min` : 'N/A'}
              subtitle="Created → Arrived"
            />
            <KPICard
              label="Avg resolution time"
              value={
                data.avgResolutionMinutes ? `${data.avgResolutionMinutes.toFixed(1)} min` : 'N/A'
              }
              subtitle="Created → Completed"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div className="cyber-card">
              <p className="text-sm text-slate-300 mb-2">Incident volume over time</p>
              {trendData ? (
                <Line data={trendData} />
              ) : (
                <p className="text-slate-400 text-sm">No data</p>
              )}
            </div>
            <div className="cyber-card">
              <p className="text-sm text-slate-300 mb-2">Incidents by status</p>
              {statusBar ? (
                <Bar data={statusBar} />
              ) : (
                <p className="text-slate-400 text-sm">No data</p>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="cyber-card">
              <p className="text-sm text-slate-300 mb-2">Incidents by category</p>
              {categoryPie ? (
                <Doughnut data={categoryPie} />
              ) : (
                <p className="text-slate-400 text-sm">No data</p>
              )}
            </div>
            <div className="cyber-card">
              <p className="text-sm text-slate-300 mb-2">Heatmap points</p>
              <p className="text-3xl font-bold text-cyan-200">{heatCount}</p>
              <p className="text-xs text-slate-500">
                Severity-weighted points for the selected range.
              </p>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
};

export default AgencyAnalyticsPage;
