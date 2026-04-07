import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { severityBadgeClass, severityLabel } from '../utils/severity';
import { Link } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import api from '../lib/api';

type CategoryOverviewItem = {
  id: string;
  label: string;
  count: number;
  sev: number;
};

type DashboardStats = {
  totals: {
    totalIncidents: number;
    activeIncidents: number;
    resolvedIncidents: number;
    activeResponders: number;
    totalAgencies: number;
    pendingVerifications: number;
    totalUsers: number;
  };
  byCategory: CategoryOverviewItem[];
  lastUpdated: string;
};

const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/dashboard/stats');
      setStats(res.data.stats as DashboardStats);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch admin dashboard stats', err);
      setError('Unable to load live dashboard stats right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { label: 'Total Incidents', value: stats?.totals.totalIncidents ?? 0 },
    { label: 'Active Responders', value: stats?.totals.activeResponders ?? 0 },
    { label: 'Total Agencies', value: stats?.totals.totalAgencies ?? 0 },
    { label: 'Pending Verifications', value: stats?.totals.pendingVerifications ?? 0 },
  ];

  return (
    <AppLayout>
      <div className="grid gap-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-cyan-200">Admin workspace</p>
            <h1 className="text-3xl font-bold">System overview</h1>
            <p className="text-slate-400 text-sm">Monitor categories and recent severities.</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={logout}>
            Logout
          </button>
        </div>

        {stats?.lastUpdated && (
          <p className="text-xs text-slate-500">Last updated: {new Date(stats.lastUpdated).toLocaleTimeString()}</p>
        )}

        {error && <div className="alert alert-warning text-sm">{error}</div>}

        <div className="flex gap-2 mb-4">
          <Link to="/agency" className="btn btn-warning btn-sm">
            Incident Console (Live)
          </Link>
          <Link to="/admin/agencies" className="btn btn-primary btn-sm">
            Manage agencies
          </Link>
          <Link to="/admin/users" className="btn btn-secondary btn-sm">
            Manage users
          </Link>
          <Link to="/admin/audit" className="btn btn-ghost btn-sm">
            Audit logs
          </Link>
          <Link to="/admin/analytics" className="btn btn-accent btn-sm">
            Analytics
          </Link>
          <Link to="/admin/system-status" className="btn btn-info btn-sm">
            System Status
          </Link>
          <Link to="/admin/system" className="btn btn-error btn-outline btn-sm">
            System Control
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {cards.map((item) => (
            <div
              key={item.label}
              className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/10"
            >
              <p className="text-sm text-slate-400">{item.label}</p>
              {isLoading ? (
                <div className="skeleton h-8 w-20 mt-2"></div>
              ) : (
                <h3 className="text-2xl font-bold text-white">{item.value}</h3>
              )}
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {(stats?.byCategory ?? []).map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow-lg shadow-cyan-500/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{item.label}</p>
                  <h3 className="text-2xl font-bold text-white">{item.count}</h3>
                </div>
                <span className={severityBadgeClass(item.sev)}>Sev {severityLabel(item.sev)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
