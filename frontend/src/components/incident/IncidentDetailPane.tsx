import React, { useEffect, useMemo, useState } from "react";
import { Activity, MessageSquare, Shield, User, Clock, X, MapPin } from "lucide-react";
import api from "../../lib/api";
import { severityBadgeClass, severityLabel } from "../../utils/severity";
import { useAuth } from "../../context/AuthContext";
import TrustBadge from "../user/TrustBadge";

type ActivityLog = {
  id: string;
  type: "STATUS_CHANGE" | "COMMENT" | "DISPATCH" | "ASSIGNMENT" | "SYSTEM";
  message: string;
  createdAt: string;
  userId?: number | null;
};

type Incident = {
  id: number;
  title: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  reporter?: {
    id: number;
    fullName: string;
    trustScore?: number | null;
  } | null;
};

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onAssign?: () => void;
  onRespond?: () => void;
  onResolve?: () => void;
  responders?: { id: number; name: string; status: string }[];
  onAssignResponder?: (responderId: number) => void;
}

const typeIcon = (type: ActivityLog["type"]) => {
  switch (type) {
    case "STATUS_CHANGE":
      return <Activity size={16} className="text-amber-300" />;
    case "COMMENT":
      return <MessageSquare size={16} className="text-cyan-300" />;
    case "ASSIGNMENT":
      return <Shield size={16} className="text-purple-300" />;
    case "DISPATCH":
      return <MapPin size={16} className="text-green-300" />;
    default:
      return <Clock size={16} className="text-slate-300" />;
  }
};

const IncidentDetailPane: React.FC<Props> = ({
  incident,
  onClose,
  onAssign,
  onRespond,
  onResolve,
  responders = [],
  onAssignResponder,
}) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const isOpen = Boolean(incident);
  const [recs, setRecs] = useState<Array<{ agencyId: number; unitId: number | null; distanceKm?: number | null; totalScore?: number }>>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    const fetchTimeline = async () => {
      if (!incident) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/incidents/${incident.id}/timeline`);
        const data = res.data.logs || [];
        setLogs(data.reverse()); // oldest first
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to load timeline");
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [incident]);

  useEffect(() => {
    const fetchRecs = async () => {
      if (!incident) return;
      setRecsLoading(true);
      try {
        const res = await api.get(`/dispatch/recommend/${incident.id}`);
        setRecs(res.data || []);
    } catch {
      setRecs([]);
    } finally {
        setRecsLoading(false);
      }
    };
    fetchRecs();
  }, [incident]);

  const handleComment = async () => {
    if (!incident || !comment.trim()) return;
    try {
      await api.post(`/incidents/${incident.id}/comment`, { message: comment.trim() });
      setComment("");
      const res = await api.get(`/incidents/${incident.id}/timeline`);
      const data = res.data.logs || [];
      setLogs(data.reverse());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to add comment");
    }
  };

  const headerBg = useMemo(() => {
    if (!incident?.severityScore) return "from-slate-900/70 via-slate-900/40 to-slate-900/10";
    if (incident.severityScore >= 5) return "from-red-900/80 via-red-900/40 to-slate-900/10";
    if (incident.severityScore >= 4) return "from-orange-900/80 via-orange-900/40 to-slate-900/10";
    if (incident.severityScore >= 3) return "from-amber-900/80 via-amber-900/40 to-slate-900/10";
    return "from-cyan-900/60 via-cyan-900/30 to-slate-900/10";
  }, [incident?.severityScore]);

  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-end pointer-events-none">
      <div
        className="absolute inset-0 bg-black/40 pointer-events-auto"
        onClick={onClose}
        aria-label="Close incident detail"
      />
      <aside className="relative pointer-events-auto w-full max-w-xl h-full bg-[#0B1220] border-l border-slate-800 shadow-2xl shadow-cyan-500/10 overflow-hidden">
        <div className={`p-4 bg-gradient-to-r ${headerBg} border-b border-slate-800 flex items-start justify-between`}>
          <div className="space-y-1">
            <p className="text-xs text-cyan-200 uppercase tracking-wide">Incident</p>
            <h2 className="text-2xl font-semibold text-white">{incident.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className={severityBadgeClass(incident.severityScore)}>
                {severityLabel(incident.severityScore)}
              </span>
              <span className="badge badge-outline badge-xs">{incident.category ?? "Unclassified"}</span>
              <span className="badge badge-ghost badge-xs">Status: {incident.status}</span>
              <span className="text-slate-400">
                {new Date(incident.createdAt).toLocaleString()}
              </span>
            </div>
            {incident.reporter && (
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <User size={14} />
                <span>{incident.reporter.fullName}</span>
                <TrustBadge trustScore={incident.reporter.trustScore ?? 0} />
              </div>
            )}
          </div>
          <button className="btn btn-circle btn-ghost btn-xs text-slate-300" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {onAssignResponder && responders.length > 0 && (
          <div className="p-3 border-b border-slate-800 bg-slate-900/60">
            <p className="text-sm font-semibold text-white mb-2">Assign responder</p>
            <div className="flex gap-2 items-center">
              <select
                className="select select-sm bg-slate-900 border-slate-700 text-white"
                onChange={(e) => onAssignResponder(Number(e.target.value))}
                defaultValue=""
              >
                <option value="" disabled>
                  Select responder
                </option>
                {responders
                  .filter((r) => r.status === "AVAILABLE" || r.status === "ASSIGNED")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.status})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4 h-[calc(100%-180px)] overflow-y-auto">
          {user?.role !== "CITIZEN" && (
            <div className="p-3 rounded-lg border border-cyan-600/30 bg-slate-900/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-cyan-300" />
                  <h3 className="text-sm font-semibold text-white">Suggested dispatch</h3>
                </div>
                <span className="text-[11px] text-slate-500">
                  {recsLoading ? "Calculating..." : `${recs.length || 0} options`}
                </span>
              </div>
              {recsLoading ? (
                <div className="text-xs text-slate-400">Calculating best agency/unit…</div>
              ) : !recs.length ? (
                <div className="text-xs text-slate-400">No recommendation available.</div>
              ) : (
                <div className="space-y-2">
                  {recs.slice(0, 3).map((rec, idx) => (
                    <div key={rec.unitId ?? rec.agencyId ?? idx} className="p-2 rounded-md bg-slate-800/70 border border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-200">
                          Agency #{rec.agencyId} {rec.unitId && <>• Unit {rec.unitId}</>}
                        </div>
                        <span className="text-[11px] text-cyan-300">
                          Score {(rec.totalScore * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rec.distanceKm !== null && rec.distanceKm !== undefined
                          ? `Distance ${rec.distanceKm.toFixed(1)} km`
                          : "No position"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Jurisdiction {Math.round(rec.jurisdictionScore * 100)}% • Severity {Math.round(rec.severityScore * 100)}% • Proximity {Math.round(rec.proximityScore * 100)}%
                      </div>
                      <button
                        className="btn btn-xs btn-accent mt-2"
                        onClick={async () => {
                          try {
                            await api.post("/dispatch/assign", {
                              incidentId: incident.id,
                              agencyId: rec.agencyId,
                              unitId: rec.unitId,
                            });
                            alert("Suggestion accepted.");
                          } catch {
                              alert("Failed to assign suggestion.");
                            }
                        }}
                      >
                        Accept suggestion
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div className="alert alert-error text-sm">{error}</div>}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity size={16} className="text-cyan-300" />
                Timeline
              </h3>
              <span className="text-xs text-slate-500">
                {loading ? "Loading..." : `${logs.length} entries`}
              </span>
            </div>
            <div className="space-y-3">
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-12 bg-slate-900 border border-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-sm text-slate-400">No activity yet.</div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-slate-800 bg-slate-900/70 flex gap-3 items-start"
                  >
                    <div className="mt-1">{typeIcon(log.type)}</div>
                    <div className="flex-1">
                      <p className="text-sm text-white">{log.message}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {user?.role !== "CITIZEN" && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare size={16} className="text-cyan-300" />
                Add update
              </p>
              <textarea
                className="textarea textarea-bordered w-full bg-slate-900 text-white"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a quick dispatcher note or update..."
              />
              <button className="btn btn-primary btn-sm" onClick={handleComment} disabled={!comment.trim()}>
                Post comment
              </button>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 bg-[#0C1322] flex flex-wrap gap-2">
          {onAssign && (
            <button className="btn btn-sm" onClick={onAssign}>
              Assign
            </button>
          )}
          {onRespond && (
            <button className="btn btn-sm btn-primary" onClick={onRespond}>
              Responding
            </button>
          )}
          {onResolve && (
            <button className="btn btn-sm btn-success" onClick={onResolve}>
              Resolve
            </button>
          )}
        </div>
      </aside>
    </div>
  );
};

export default IncidentDetailPane;
