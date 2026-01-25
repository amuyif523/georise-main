import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Plus,
  ShieldCheck,
  Radio,
  Wind,
  AlertTriangle,
  CheckCircle,
  Activity,
  Navigation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import TrustBadge from '../components/user/TrustBadge';
import AppLayout from '../layouts/AppLayout';
import MapWrapper from '../components/maps/IncidentMap';
import api from '../lib/api';
import { formatDistanceToNow } from 'date-fns';

// Types for the dashboard
interface DashboardIncident {
  id: number;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  severityScore: number;
}

const CitizenDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<DashboardIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await api.get('/incidents/feed');
        setIncidents(res.data || []);
      } catch (err) {
        console.error('Failed to fetch dashboard feed', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncidents();
  }, []);

  const activeIncidentsCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

  return (
    <AppLayout>
      {/* Top Status Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-base-100/50 backdrop-blur-md p-4 rounded-xl border border-base-content/5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-full animate-pulse">
            <Radio className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-base-content flex items-center gap-2">
              Command Center{' '}
              <span className="badge badge-accent badge-sm font-mono text-white">LIVE</span>
            </h1>
            <p className="text-xs text-base-content/60 font-mono tracking-wider uppercase">
              Sector: Addis Ababa • Network: Secure
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4 md:mt-0">
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <Wind className="w-4 h-4" />
            <span>22°C</span>
          </div>
          <div className="w-px h-8 bg-base-content/10 hidden md:block"></div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-base-content">{user?.fullName}</p>
              <p className="text-[10px] text-base-content/60 uppercase">Citizen Responder</p>
            </div>
            <TrustBadge trustScore={(user as any)?.trustScore ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Left Col: Actions & Stats (3 cols) */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Emergency Button */}
          <button
            className="btn btn-error w-full h-auto py-6 flex flex-col items-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:scale-[1.02] transition-all"
            onClick={() => navigate('/citizen/report')}
          >
            <div className="p-3 bg-white/20 rounded-full animate-ping absolute opacity-75"></div>
            <AlertTriangle className="w-8 h-8 relative z-10" />
            <span className="text-lg font-bold">REPORT EMERGENCY</span>
            <span className="text-xs opacity-80 font-normal">Instant Dispatch</span>
          </button>

          {/* Quick Actions */}
          <div className="card bg-base-100 shadow-lg border border-base-content/5 flex-1 p-4">
            <h3 className="text-xs font-bold uppercase text-base-content/40 tracking-widest mb-4">
              Quick Actions
            </h3>
            <div className="grid gap-3">
              <button
                onClick={() => navigate('/citizen/report')}
                className="btn btn-outline btn-primary justify-start gap-3 h-12"
              >
                <Plus className="w-5 h-5" /> New Report
              </button>
              <button
                onClick={() => navigate('/citizen/my-reports')}
                className="btn btn-outline justify-start gap-3 h-12"
              >
                <ShieldCheck className="w-5 h-5" /> My History
              </button>
              <button
                onClick={() => navigate('/citizen/verify')}
                className="btn btn-outline justify-start gap-3 h-12"
              >
                <CheckCircle className="w-5 h-5" /> Verify ID
              </button>
            </div>
          </div>

          {/* Local Stats */}
          <div className="card bg-primary text-primary-content shadow-lg p-6 relative overflow-hidden">
            <div className="relative z-10">
              <Activity className="w-8 h-8 mb-2 opacity-80" />
              <div className="text-4xl font-black mb-1">{activeIncidentsCount}</div>
              <div className="text-sm font-medium opacity-90">Active Incidents</div>
              <div className="text-xs opacity-70 mt-1">in your vicinity</div>
            </div>
            {/* Decoration */}
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          </div>
        </div>

        {/* Center: Map (6 cols) */}
        <div className="lg:col-span-6 card bg-base-200 shadow-inner border border-base-content/5 overflow-hidden relative group">
          <div className="absolute top-4 left-4 z-[1000] bg-base-100/80 backdrop-blur px-3 py-1 rounded-full text-xs font-bold border border-base-content/10 flex items-center gap-2">
            <MapPin className="w-3 h-3 text-primary" /> Live Geospatial View
          </div>
          <MapWrapper />
          {/* Overlay Gradient at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-base-100/50 to-transparent pointer-events-none z-[500]"></div>
        </div>

        {/* Right: Live Feed (3 cols) */}
        <div className="lg:col-span-3 card bg-base-100 shadow-lg border border-base-content/5 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-base-content/5 bg-base-200/30">
            <h3 className="text-xs font-bold uppercase text-base-content/40 tracking-widest flex items-center justify-between">
              <span>Incident Wire</span>
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <span className="loading loading-spinner text-primary"></span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="text-center p-8 opacity-50">
                <Navigation className="w-12 h-12 mx-auto mb-2 text-base-content/20" />
                <p className="text-sm">No recent activity.</p>
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="p-3 rounded-lg hover:bg-base-200 transition-colors cursor-pointer border border-transparent hover:border-base-content/5 group"
                  onClick={() => navigate('/citizen/my-reports')}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span
                      className={`badge badge-xs font-mono mb-1 ${
                        incident.severityScore >= 4
                          ? 'badge-error'
                          : incident.severityScore >= 3
                            ? 'badge-warning'
                            : 'badge-info'
                      }`}
                    >
                      SEV-{incident.severityScore}
                    </span>
                    <span className="text-[10px] text-base-content/40 font-mono">
                      {formatDistanceToNow(new Date(incident.createdAt))} ago
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-base-content mb-1 group-hover:text-primary transition-colors line-clamp-1">
                    {incident.title}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-base-content/60">
                    <span className="uppercase tracking-wider">{incident.category}</span>
                    <span>•</span>
                    <span className="capitalize">
                      {incident.status.replace('_', ' ').toLowerCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 border-t border-base-content/5 bg-base-50 text-center">
            <Link
              to="/citizen/my-reports"
              className="text-xs font-bold text-primary hover:underline"
            >
              View Full History
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CitizenDashboard;
