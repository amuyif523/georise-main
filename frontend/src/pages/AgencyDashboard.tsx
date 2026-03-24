import React, { useEffect, useState } from 'react';
import { MapPin, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../lib/api';
import AppLayout from '../layouts/AppLayout';
import type { IncidentListItem } from '../types/incidents';
import { motion } from 'framer-motion';
import IncidentMap from '../components/maps/IncidentMap';
import Skeleton from '../components/ui/Skeleton';

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => (
  <div className="cyber-card flex items-center gap-3">
    <div className="p-3 rounded-full bg-cyan-500/10 text-cyan-300">{icon}</div>
    <div>
      <p className="text-xs text-slate-300">{label}</p>
      <p className="text-2xl font-bold text-cyan-100">{value}</p>
    </div>
  </div>
);

import { getSocket } from '../lib/socket';

const AgencyDashboard: React.FC = () => {
  const [stats, setStats] = useState({ active: 0, resolved: 0, highSeverity: 0 });
  const [view, setView] = useState<'live' | 'history'>('live');
  const [recent, setRecent] = useState<IncidentListItem[] | null>(null);
  const [suggestion, setSuggestion] = useState<{
    agencyId: number;
    unitId: number | null;
    distanceKm?: number | null;
    totalScore: number;
  } | null>(null);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const [jurisdiction, setJurisdiction] = useState<any>(null);
  const [agencyCenter, setAgencyCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingSuggest(true);
      setProfileLoading(true);
      try {
        // Fetch User Agency to get Jurisdiction
        try {
          const agencyRes = await api.get('/agency/profile');
          if (agencyRes.data) {
            if (agencyRes.data.jurisdiction) {
              setJurisdiction(agencyRes.data.jurisdiction);
            }
            if (
              agencyRes.data.centerLatitude !== null &&
              agencyRes.data.centerLatitude !== undefined &&
              agencyRes.data.centerLongitude !== null &&
              agencyRes.data.centerLongitude !== undefined
            ) {
              setAgencyCenter({
                lat: Number(agencyRes.data.centerLatitude),
                lng: Number(agencyRes.data.centerLongitude),
              });
            }
          }
        } catch (err) {
          console.error('Failed to load agency profile:', err);
          // Non-blocking, continue to load incidents
        } finally {
          setProfileLoading(false);
        }

        // Let's assume we get incidents first as before
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
          try {
            const recRes = await api.get(`/dispatch/recommend/${target.id}`);
            setSuggestion(recRes.data?.[0] || null);
          } catch (err: any) {
            if (err?.response?.status === 403) {
              setSuggestion({
                agencyId: 0,
                unitId: null,
                totalScore: 0,
                _placeholderMsg: 'Calculating best responders...',
              } as any);
            } else {
              console.error('Failed to get suggestions:', err);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSuggest(false);
      }
    };
    load();
    // ... socket listeners ...
    const socket = getSocket();
    if (socket) {
      const handleCreated = (newIncident: IncidentListItem) => {
        setRecent((prev) => [newIncident, ...(prev ?? [])].slice(0, 5));
        setStats((s) => ({
          ...s,
          active: s.active + 1,
          highSeverity: (newIncident.severityScore ?? 0) >= 4 ? s.highSeverity + 1 : s.highSeverity,
        }));
      };

      const handleUpdated = (updated: IncidentListItem) => {
        setRecent((prev) => (prev ?? []).map((i) => (i.id === updated.id ? updated : i)));
        if (updated.status === 'RESOLVED') {
          setStats((s) => ({ ...s, active: Math.max(0, s.active - 1), resolved: s.resolved + 1 }));
        }
      };

      socket.on('incident:created', handleCreated);
      socket.on('incident:updated', handleUpdated);

      return () => {
        socket.off('incident:created', handleCreated);
        socket.off('incident:updated', handleUpdated);
      };
    }
  }, []);

  const acceptSuggestion = async () => {
    if (!suggestion || !recent?.length) return;
    const target = recent.find((i) => i.status !== 'RESOLVED');
    if (!target) return;
    try {
      await api.patch(`/incidents/${target.id}/assign`, {
        assignedAgencyId: suggestion.agencyId,
        assignedResponderId: suggestion.unitId,
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
              <h2 className="font-semibold">
                {view === 'live' ? 'Live Map' : 'Predictive Risk Hotspots'}
              </h2>
              <div className="flex bg-slate-900 rounded-lg p-1 ml-4 border border-slate-700">
                <button
                  className={`px-3 py-1 text-xs rounded-md transition-all ${view === 'live' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setView('live')}
                >
                  Live
                </button>
                <button
                  className={`px-3 py-1 text-xs rounded-md transition-all ${view === 'history' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                  onClick={() => setView('history')}
                >
                  History (30d)
                </button>
              </div>
            </div>
            <a href="/agency/map" className="btn btn-sm btn-primary">
              Full screen
            </a>
          </div>
          <p className="text-sm text-slate-500">
            {view === 'live'
              ? 'Real-time situational awareness within your operational jurisdiction.'
              : 'AI-generated hotspots based on high-severity clusters over the last 30 days.'}
          </p>
          <div className="mt-4 h-[420px] lg:h-[calc(100%-100px)] min-h-[320px] rounded-lg border border-slate-800 bg-slate-900/40 overflow-hidden relative">
            {/* If stats active is 0, we can show a placeholder or overlay, but keeping the map is better contextually. 
                 The request says: "If no incidents are found, show a 'Waiting for reports in Bole...' empty state instead of a blank box." 
             */}

            {/* Ensure map only renders if we're not loading profile to avoid jumpiness, or render anyway */}
            {profileLoading || recent === null ? (
              <div className="h-full w-full p-4">
                <Skeleton className="h-full w-full rounded-lg" />
              </div>
            ) : (
              <IncidentMap
                historyMode={view === 'history'}
                jurisdiction={jurisdiction}
                center={agencyCenter ?? { lat: 9.0197, lng: 38.7525 }}
              />
            )}

            {!loadingSuggest &&
              stats.active === 0 &&
              view === 'live' &&
              !profileLoading &&
              recent !== null && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-[1000] pointer-events-none">
                <div className="text-center p-6 bg-slate-900/90 border border-slate-700 rounded-xl shadow-2xl">
                  <Activity className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
                  <h3 className="text-lg font-bold text-white">All Clear</h3>
                  <p className="text-sm text-slate-400">
                    Waiting for reports in your jurisdiction...
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="cyber-card">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-orange-400" />
              <h3 className="font-semibold">Recent incidents</h3>
            </div>
            <div className="space-y-3">
              {(recent || []).map((i) => (
                <div key={i.id} className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{i.title}</p>
                    <div className="flex gap-2">
                      {i.sharedWith && i.sharedWith.length > 0 && (
                        <span className="badge badge-sm badge-info">Collaborative</span>
                      )}
                      <span className="badge badge-sm">{i.status}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300">
                    Severity: {i.severityScore ?? '?'} • {new Date(i.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {recent !== null && recent.length === 0 && (
                <div className="p-6 text-center border border-dashed border-slate-800 rounded-lg">
                  <p className="text-sm text-slate-500">No active incidents reported recently.</p>
                </div>
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
                  {(suggestion as any)._placeholderMsg ? (
                    <p className="text-xs text-slate-400">{(suggestion as any)._placeholderMsg}</p>
                  ) : (
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
