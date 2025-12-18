import React, { useEffect, useState } from 'react';
import { MapPin, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import AppLayout from '../layouts/AppLayout';
import type { IncidentListItem } from '../types/incidents';
import { motion } from 'framer-motion';
import IncidentMap from '../components/maps/IncidentMap';

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="cyber-card flex items-center gap-3">
    <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-300">{icon}</div>
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-bold text-cyan-100">{value}</p>
    </div>
  </div>
);

const AgencyDashboard: React.FC = () => {
  const [stats, setStats] = useState({ active: 0, resolved: 0, highSeverity: 0 });
  const [recent, setRecent] = useState<IncidentListItem[]>([]);
  const [suggestion, setSuggestion] = useState<{
    agencyId: number;
    unitId: number | null;
    distanceKm?: number | null;
    totalScore: number;
  } | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await api.get('/incidents', { params: { hours: 48 } });
      const incs: IncidentListItem[] = res.data.incidents || [];
      setRecent(incs.slice(0, 5));
      setStats({
        active: incs.filter((i) => i.status !== 'RESOLVED').length,
        resolved: incs.filter((i) => i.status === 'RESOLVED').length,
        highSeverity: incs.filter((i) => (i.severityScore ?? 0) >= 4).length,
      });

      const target = incs.find((i) => i.status !== 'RESOLVED');
      if (target) {
        setLoadingSuggest(true);
        try {
          const recRes = await api.get(`/dispatch/recommend/${target.id}`);
          setSuggestion(recRes.data?.[0] || null);
        } catch {
          setSuggestion(null);
        } finally {
          setLoadingSuggest(false);
        }
      }
    };
    load();
  }, []);

  const acceptSuggestion = async () => {
    if (!suggestion || !recent.length) return;
    const target = recent.find((i) => i.status !== 'RESOLVED');
    if (!target) return;
    try {
      await api.post('/dispatch/assign', {
        incidentId: target.id,
        agencyId: suggestion.agencyId,
        unitId: suggestion.unitId,
      });
      alert('Suggestion accepted and assignment created.');
    } catch {
      alert('Failed to assign suggestion.');
    }
  };

  return (
    <AppLayout>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Active incidents" value={stats.active} icon={<Activity size={18} />} />
        <StatCard label="Resolved (48h)" value={stats.resolved} icon={<CheckCircle size={18} />} />
        <StatCard
          label="High severity"
          value={stats.highSeverity}
          icon={<AlertCircle size={18} />}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <motion.div
          className="col-span-12 lg:col-span-8 cyber-card h-[60vh] lg:h-[calc(100vh-220px)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-cyan-300" />
              <h2 className="font-semibold">Live Map</h2>
            </div>
            <a href="/agency/map" className="btn btn-sm btn-primary">
              Open map
            </a>
          </div>
          <p className="text-sm text-slate-500">
            GIS map with incidents, responders, heat/cluster layers.
          </p>
          <div className="mt-4 h-full rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden">
            <IncidentMap />
          </div>
        </motion.div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="cyber-card">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-orange-400" />
              <h3 className="font-semibold">Recent incidents</h3>
            </div>
            <div className="space-y-3">
              {recent.map((i) => (
                <div key={i.id} className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{i.title}</p>
                    <span className="badge badge-sm">{i.status}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Severity: {i.severityScore ?? '?'} • {new Date(i.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {!recent.length && (
                <p className="text-sm text-slate-400">No incidents in the last 48h.</p>
              )}
            </div>
          </div>

          <div className="cyber-card">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={18} className="text-cyan-400" />
              <h3 className="font-semibold">Next actions</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-300">
              <p>• Open live map to assign responders and track arrival.</p>
              <p>• Watch for high severity incidents (≥ 4) in your queue.</p>
              <p>• Use Review Queue to validate low-trust reports.</p>
            </div>
            <div className="mt-3 flex gap-2">
              <a href="/agency/map" className="btn btn-primary btn-sm w-full">
                Go to map
              </a>
              <a href="/admin/review" className="btn btn-outline btn-sm w-full">
                Review queue
              </a>
            </div>
            <div className="mt-4 p-3 rounded-lg border border-cyan-500/30 bg-slate-900/60">
              <h4 className="font-semibold text-cyan-200 mb-1">Suggested dispatch</h4>
              {loadingSuggest && (
                <p className="text-xs text-slate-400">Calculating best agency/unit…</p>
              )}
              {!loadingSuggest && suggestion && (
                <>
                  <p className="text-xs text-slate-300">
                    Agency #{suggestion.agencyId} • Unit {suggestion.unitId ?? 'N/A'}
                  </p>
                  {suggestion.distanceKm !== null && suggestion.distanceKm !== undefined && (
                    <p className="text-[11px] text-slate-400">
                      Distance: {suggestion.distanceKm.toFixed(1)} km — Score{' '}
                      {(suggestion.totalScore * 100).toFixed(0)}
                    </p>
                  )}
                  <button className="btn btn-xs btn-accent mt-2" onClick={acceptSuggestion}>
                    Accept suggestion
                  </button>
                </>
              )}
              {!loadingSuggest && !suggestion && (
                <p className="text-xs text-slate-400">No recommendation available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AgencyDashboard;
