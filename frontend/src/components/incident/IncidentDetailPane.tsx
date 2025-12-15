import React, { useEffect, useMemo, useState } from "react";
import { Activity, MessageSquare, Shield, User, Clock, X, MapPin, Share2, Send } from "lucide-react";
import api from "../../lib/api";
import { severityBadgeClass, severityLabel } from "../../utils/severity";
import { useAuth } from "../../context/AuthContext";
import TrustBadge from "../user/TrustBadge";
import { getSocket } from "../../lib/socket";

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

type DuplicateIncident = Incident & {
  distance?: number;
};

type Agency = {
  id: number;
  name: string;
  type: string;
};

type ChatMessage = {
  senderId: number;
  sender?: {
    fullName: string;
    agencyStaff?: {
      agency?: {
        name: string;
      };
    };
  };
  message: string;
  createdAt: string;
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
  const [recs, setRecs] = useState<Array<{ 
    agencyId: number; 
    unitId: number | null; 
    distanceKm?: number | null; 
    totalScore?: number;
    jurisdictionScore?: number;
    severityScore?: number;
    proximityScore?: number;
  }>>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateIncident[]>([]);
  const [mergingId, setMergingId] = useState<number | null>(null);

  // Chat & Share State
  const [activeTab, setActiveTab] = useState<"timeline" | "chat">("timeline");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [shareReason, setShareReason] = useState("");

  useEffect(() => {
    if (activeTab === 'chat' && incident) {
      const loadChat = async () => {
        try {
          const res = await api.get(`/incidents/${incident.id}/chat`);
          setChatMessages(res.data.messages || []);
        } catch (e) { console.error(e); }
      };
      loadChat();

      const socket = getSocket();
      if (socket) {
        socket.emit("join_incident", incident.id);
        socket.on("incident:chat", (msg: ChatMessage) => {
          setChatMessages(prev => [...prev, msg]);
        });
      }

      return () => {
        if (socket) {
          socket.emit("leave_incident", incident.id);
          socket.off("incident:chat");
        }
      };
    }
  }, [activeTab, incident]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !incident) return;
    try {
      await api.post(`/incidents/${incident.id}/chat`, { message: chatInput.trim() });
      setChatInput("");
    } catch (err) { console.error(err); }
  };

  const openShareModal = async () => {
    setShowShareModal(true);
    try {
      const res = await api.get("/incidents/resources/agencies");
      setAgencies(res.data.agencies || []);
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    if (!selectedAgency || !shareReason || !incident) return;
    try {
      await api.post(`/incidents/${incident.id}/share`, {
        agencyId: Number(selectedAgency),
        reason: shareReason
      });
      setShowShareModal(false);
      alert("Incident shared successfully");
    } catch { alert("Failed to share incident"); }
  };

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
    const checkDups = async () => {
      if (!incident || !incident.latitude || !incident.longitude) return;
      try {
        const res = await api.get("/incidents/duplicates", {
          params: {
            lat: incident.latitude,
            lng: incident.longitude,
            title: incident.title,
          },
        });
        // Filter out self
        const dups = (res.data.duplicates || []).filter((d: DuplicateIncident) => d.id !== incident.id);
        setDuplicates(dups);
      } catch (err) {
        console.warn("Failed to check duplicates", err);
      }
    };
    checkDups();
  }, [incident]);

  const handleMerge = async (targetId: number) => {
    if (!incident || !confirm("Are you sure you want to merge this duplicate into the current incident? The duplicate will be closed.")) return;
    
    setMergingId(targetId);
    try {
      await api.post("/incidents/merge", {
        primaryId: incident.id,
        duplicateId: targetId
      });
      // Remove from list
      setDuplicates(prev => prev.filter(d => d.id !== targetId));
      // Refresh timeline
      const res = await api.get(`/incidents/${incident.id}/timeline`);
      setLogs(res.data.logs?.reverse() || []);
    } catch {
      alert("Failed to merge incidents");
    } finally {
      setMergingId(null);
    }
  };

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
          <div className="flex gap-2">
            {user?.role !== "CITIZEN" && (
              <button className="btn btn-circle btn-ghost btn-xs text-slate-300" onClick={openShareModal} title="Share Incident">
                <Share2 size={16} />
              </button>
            )}
            <button className="btn btn-circle btn-ghost btn-xs text-slate-300" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-slate-900 mx-4 mt-4">
          <a className={`tab ${activeTab === 'timeline' ? 'tab-active' : ''}`} onClick={() => setActiveTab('timeline')}>Timeline</a>
          <a className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('chat')}>Inter-Agency Chat</a>
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

        <div className="p-4 space-y-4 h-[calc(100%-240px)] overflow-y-auto">
          {activeTab === 'timeline' ? (
            <>
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
                          Score {((rec.totalScore || 0) * 100).toFixed(0)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rec.distanceKm !== null && rec.distanceKm !== undefined
                          ? `Distance ${rec.distanceKm.toFixed(1)} km`
                          : "No position"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Jurisdiction {Math.round((rec.jurisdictionScore || 0) * 100)}% • Severity {Math.round((rec.severityScore || 0) * 100)}% • Proximity {Math.round((rec.proximityScore || 0) * 100)}%
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

          {duplicates.length > 0 && (
            <div className="p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
              <div className="text-sm font-semibold text-orange-200 mb-2">
                Potential Duplicates ({duplicates.length})
              </div>
              <div className="space-y-2">
                {duplicates.map((d) => (
                  <div key={d.id} className="text-xs text-slate-300 flex justify-between items-center">
                    <span>
                      #{d.id} - {d.title}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">
                        {d.distance ? Math.round(d.distance) + "m" : ""}
                      </span>
                      <button 
                        className="btn btn-xs btn-outline btn-warning"
                        disabled={mergingId === d.id}
                        onClick={() => handleMerge(d.id)}
                      >
                        {mergingId === d.id ? "Merging..." : "Merge"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-slate-400">
                Consider merging or rejecting if identical.
              </div>
            </div>
          )}

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
          </>
        ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat ${msg.senderId === user?.id ? 'chat-end' : 'chat-start'}`}>
                    <div className="chat-header text-xs opacity-50">
                      {msg.sender?.fullName} • {msg.sender?.agencyStaff?.agency?.name || 'Admin'}
                    </div>
                    <div className="chat-bubble chat-bubble-primary text-sm">{msg.message}</div>
                    <div className="chat-footer opacity-50 text-[10px]">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {chatMessages.length === 0 && <div className="text-center text-slate-500 text-sm mt-10">No messages yet. Start the coordination.</div>}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input 
                  type="text" 
                  className="input input-bordered input-sm flex-1 bg-slate-900" 
                  placeholder="Type a message..." 
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary"><Send size={14} /></button>
              </form>
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

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-auto">
          <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md border border-slate-700 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Share Incident</h3>
            <div className="form-control mb-4">
              <label className="label"><span className="label-text text-slate-300">Select Agency</span></label>
              <select className="select select-bordered w-full bg-slate-800 text-white" value={selectedAgency} onChange={e => setSelectedAgency(e.target.value)}>
                <option value="">Select...</option>
                {agencies.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>
            </div>
            <div className="form-control mb-4">
              <label className="label"><span className="label-text text-slate-300">Reason</span></label>
              <textarea className="textarea textarea-bordered w-full bg-slate-800 text-white" value={shareReason} onChange={e => setShareReason(e.target.value)} placeholder="Requesting backup..." />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowShareModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleShare}>Share</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IncidentDetailPane;
