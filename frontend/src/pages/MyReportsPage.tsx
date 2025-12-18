import React, { useEffect, useState } from 'react';
import { MapPin, Shield, Sparkles } from 'lucide-react';
import api from '../lib/api';
import { severityBadgeClass, severityLabel } from '../utils/severity';
import { getSocket } from '../lib/socket';
import AppLayout from '../layouts/AppLayout';

type ActivityLog = {
  id: string;
  type: 'STATUS_CHANGE' | 'COMMENT' | 'DISPATCH' | 'ASSIGNMENT' | 'SYSTEM';
  message: string;
  createdAt: string;
};

type Incident = {
  id: number;
  title: string;
  description: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  timeline?: ActivityLog[];
  aiOutput?: {
    predictedCategory: string;
    severityScore: number;
    confidence: number;
    summary?: string | null;
  } | null;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'RECEIVED':
      return 'badge badge-info';
    case 'UNDER_REVIEW':
      return 'badge badge-warning';
    case 'ASSIGNED':
    case 'RESPONDING':
      return 'badge badge-primary';
    case 'RESOLVED':
      return 'badge badge-success';
    case 'CANCELLED':
      return 'badge badge-neutral';
    default:
      return 'badge badge-ghost';
  }
};

const formatDate = (iso: string) => new Date(iso).toLocaleString();

const MyReportsPage: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/incidents/my');
        setIncidents(res.data.incidents || []);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg || 'Failed to load incidents');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const socket = getSocket();
    if (socket) {
      const handler = (inc: Incident) => {
        setIncidents((prev) =>
          prev.map((r) =>
            r.id === inc.id
              ? {
                  ...r,
                  status: inc.status,
                  severityScore: inc.severityScore,
                  category: inc.category,
                }
              : r,
          ),
        );
      };
      socket.on('incident:updated', handler);
      return () => {
        socket.off('incident:updated', handler);
      };
    }
  }, []);

  const loadTimeline = async (incidentId: number) => {
    setLoadingTimeline(incidentId);
    try {
      const res = await api.get(`/incidents/${incidentId}/timeline`);
      const logs: ActivityLog[] = res.data.logs || [];
      setIncidents((prev) =>
        prev.map((i) => (i.id === incidentId ? { ...i, timeline: logs.reverse() } : i)),
      );
      setOpenId(incidentId);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to load timeline');
    } finally {
      setLoadingTimeline(null);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Citizen workspace</p>
          <h1 className="text-3xl font-bold text-slate-900">My Reports</h1>
          <p className="text-slate-500 text-sm">Track the status of your submitted incidents.</p>
        </div>
        <div className="flex items-center gap-2 text-blue-600">
          <Sparkles size={18} />
          <span className="text-sm">AI-assisted categories</span>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-500">Loading…</div>
      ) : incidents.length === 0 ? (
        <div className="p-8 border border-dashed border-slate-300 rounded-lg text-center text-slate-500 bg-white">
          No incidents yet. Start by submitting one from the wizard.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {incidents.map((incident) => (
            <div
              key={incident.id}
              className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{incident.title}</h3>
                  <p className="text-slate-500 text-sm">
                    {new Date(incident.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className={statusColor(incident.status)}>{incident.status}</span>
                  <span className={severityBadgeClass(incident.severityScore)}>
                    Sev {severityLabel(incident.severityScore)}
                  </span>
                </div>
              </div>
              <div className="mt-3 text-sm text-slate-800 line-clamp-3">{incident.description}</div>
              <div className="mt-3 flex items-center gap-2 text-slate-700 text-sm">
                <MapPin size={16} className="text-blue-500" />
                {incident.latitude && incident.longitude
                  ? `${incident.latitude.toFixed(3)}, ${incident.longitude.toFixed(3)}`
                  : 'No location set'}
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <Shield size={16} className="text-amber-500" />
                <span>
                  Category: {incident.category ?? 'Pending'} • AI severity:{' '}
                  {severityLabel(incident.severityScore)}
                </span>
              </div>
              {incident.aiOutput?.summary && (
                <div className="mt-2 text-xs text-slate-500">
                  AI summary: {incident.aiOutput.summary}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                ID: {incident.id} • Created: {formatDate(incident.createdAt)}
              </div>

              <div className="mt-3">
                <button
                  className={`btn btn-xs btn-outline ${loadingTimeline === incident.id ? 'loading' : ''}`}
                  onClick={() => loadTimeline(incident.id)}
                >
                  {openId === incident.id ? 'Refresh timeline' : 'View updates'}
                </button>
              </div>

              {openId === incident.id && (
                <div className="mt-3 space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Timeline</p>
                  {incident.timeline && incident.timeline.length > 0 ? (
                    incident.timeline.map((log) => (
                      <div
                        key={log.id}
                        className="text-sm p-2 rounded-md bg-white border border-slate-200"
                      >
                        <p className="text-slate-900">{log.message}</p>
                        <p className="text-[11px] text-slate-500">
                          {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No updates yet.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
};

export default MyReportsPage;
