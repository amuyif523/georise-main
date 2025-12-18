import React from 'react';
import { useAuth } from '../context/AuthContext';
import { severityBadgeClass, severityLabel } from '../utils/severity';
import { Link } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';

const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();
  const sampleOverview = [
    { id: 'FIRE', label: 'Fire', count: 24, sev: 4 },
    { id: 'MEDICAL', label: 'Medical', count: 18, sev: 3 },
    { id: 'TRAFFIC', label: 'Traffic', count: 30, sev: 2 },
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

        <div className="flex gap-2 mb-4">
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

        <div className="grid md:grid-cols-3 gap-3">
          {sampleOverview.map((item) => (
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
