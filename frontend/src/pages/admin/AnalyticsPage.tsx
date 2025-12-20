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
import AppLayout from '../../layouts/AppLayout';
import api from '../../lib/api';
import { useTranslation } from 'react-i18next';

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

type ResponseTimeData = { bucket: string; count: number }[];
type HeatmapData = { day_of_week: number; hour_of_day: number; count: number }[];
type UtilizationData = {
  agency_name: string;
  incident_count: number;
  avg_handling_time_mins: number;
}[];

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

const AnalyticsPage: React.FC = () => {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [responseTimeData, setResponseTimeData] = useState<ResponseTimeData | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const rangeParams = () => {
    const now = new Date();
    const to = now.toISOString();
    const from = new Date(now.getTime() - range * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  };

  const downloadCsv = async (path: string, filename: string) => {
    try {
      const res = await api.get(path, {
        params: { ...rangeParams(), format: 'csv' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
      setError('Failed to download CSV');
    }
  };

  useEffect(() => {
    const { from, to } = rangeParams();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [overviewRes, responseRes, heatmapRes, utilRes] = await Promise.all([
          api.get('/analytics/overview/admin', { params: { from, to } }),
          api.get('/analytics/distribution/response-time', { params: { from, to } }),
          api.get('/analytics/heatmap/time-of-day', { params: { from, to } }),
          api.get('/analytics/utilization/resource', { params: { from, to } }),
        ]);

        setData(overviewRes.data);
        setResponseTimeData(responseRes.data);
        setHeatmapData(heatmapRes.data);
        setUtilizationData(utilRes.data);
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
          label: t('analytics.kpi_total'),
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
          label: t('analytics.kpi_total'),
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

  const fmtMinutes = (val: unknown) => {
    const num = typeof val === 'number' ? val : Number(val);
    if (!Number.isFinite(num)) return 'N/A';
    return `${num.toFixed(1)} min`;
  };

  const responseTimeChart = useMemo(() => {
    if (!responseTimeData?.length) return null;
    return {
      labels: responseTimeData.map((d) => d.bucket),
      datasets: [
        {
          label: t('analytics.kpi_total'),
          data: responseTimeData.map((d) => d.count),
          backgroundColor: '#10b981',
        },
      ],
    };
  }, [responseTimeData, t]);

  const heatmapChart = useMemo(() => {
    if (!heatmapData?.length) return null;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const datasets = days.map((day, dayIndex) => {
      // Create 24 hour buckets for this day
      const data = Array(24).fill(0);
      heatmapData.forEach((d) => {
        if (d.day_of_week === dayIndex) {
          data[d.hour_of_day] = d.count;
        }
      });
      return {
        label: day,
        data,
        borderColor: `hsl(${dayIndex * 50}, 70%, 50%)`,
        tension: 0.4,
      };
    });

    return {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets,
    };
  }, [heatmapData]);

  const utilizationChart = useMemo(() => {
    if (!utilizationData?.length) return null;
    return {
      labels: utilizationData.map((d) => d.agency_name),
      datasets: [
        {
          label: 'Incidents Handled',
          data: utilizationData.map((d) => d.incident_count),
          backgroundColor: '#8b5cf6',
        },
        {
          label: 'Avg Handling Time (min)',
          data: utilizationData.map((d) => d.avg_handling_time_mins),
          backgroundColor: '#f59e0b',
          yAxisID: 'y1',
        },
      ],
    };
  }, [utilizationData]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{t('analytics.title')}</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 uppercase">{t('analytics.filters.apply')}</span>
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
            <button
              className="btn btn-xs btn-outline btn-primary ml-3"
              onClick={() =>
                downloadCsv('/analytics/overview/admin', 'analytics-overview-admin.csv')
              }
            >
              {t('analytics.export_overview')}
            </button>
            <button
              className="btn btn-xs btn-outline btn-secondary"
              onClick={() =>
                downloadCsv(
                  '/analytics/distribution/response-time',
                  'response-time-distribution.csv',
                )
              }
            >
              {t('analytics.export_response_time')}
            </button>
            <button
              className="btn btn-xs btn-outline btn-accent"
              onClick={() =>
                downloadCsv('/analytics/utilization/resource', 'resource-utilization.csv')
              }
            >
              {t('analytics.export_utilization')}
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error text-sm">{error}</div>}
        {loading && (
          <div className="text-slate-400 text-sm animate-pulse">Loading analytics data...</div>
        )}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <KPICard
                label="Total Incidents"
                value={data.totalIncidents}
                subtitle="Selected range"
              />
              <KPICard
                label="Avg Response Time"
                value={fmtMinutes(data.avgResponseMinutes)}
                subtitle="Created → Arrived"
              />
              <KPICard
                label="Avg Resolution Time"
                value={fmtMinutes(data.avgResolutionMinutes)}
                subtitle="Created → Completed"
              />
            </div>

            {/* Row 1: Volume & Status */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">Incident Volume Trend</p>
                <div className="h-64">
                  {trendData ? (
                    <Line data={trendData} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">Status Distribution</p>
                <div className="h-64">
                  {statusBar ? (
                    <Bar data={statusBar} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Response Time & Heatmap */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">Response Time Distribution</p>
                <div className="h-64">
                  {responseTimeChart ? (
                    <Bar data={responseTimeChart} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">
                  Time of Day Heatmap (Incidents)
                </p>
                <div className="h-64">
                  {heatmapChart ? (
                    <Line data={heatmapChart} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Resource Utilization & Categories */}
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">Agency Resource Utilization</p>
                <div className="h-64">
                  {utilizationChart ? (
                    <Bar
                      data={utilizationChart}
                      options={{
                        maintainAspectRatio: false,
                        scales: {
                          y: { type: 'linear', display: true, position: 'left' },
                          y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            grid: { drawOnChartArea: false },
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
              <div className="cyber-card">
                <p className="text-sm text-slate-300 mb-4 font-bold">Category Breakdown</p>
                <div className="h-64 flex justify-center">
                  {categoryPie ? (
                    <Doughnut data={categoryPie} options={{ maintainAspectRatio: false }} />
                  ) : (
                    <p className="text-slate-400 text-sm">No data</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AnalyticsPage;
