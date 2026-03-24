import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  MessageSquare,
  Shield,
  User,
  Clock,
  X,
  MapPin,
  Share2,
  Send,
  Check,
  XCircle,
  PenLine,
} from 'lucide-react';
import api from '../../lib/api';
import { severityBadgeClass, severityLabel } from '../../utils/severity';
import { useAuth } from '../../context/AuthContext';
import TrustBadge from '../user/TrustBadge';
import { getSocket } from '../../lib/socket';
import AgencySelectionModal from './AgencySelectionModal';

type ActivityLog = {
  id: string;
  type: 'STATUS_CHANGE' | 'COMMENT' | 'DISPATCH' | 'ASSIGNMENT' | 'SYSTEM' | 'TRIAGE_UPDATE';
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
  assignedAgencyId?: number | null;
  assignedResponderId?: number | null;
  acknowledgedAt?: string | null;
  reporter?: {
    id: number;
    fullName: string;
    trustScore?: number | null;
    phone?: string;
  } | null;
};

type DuplicateIncident = Incident & {
  distance?: number;
};

type IncidentPhoto = {
  id: string;
  url: string;
  originalName: string;
  createdAt: string;
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
  responders?: { id: number; name: string; status: string; userId?: number }[];
  onAssignResponder?: (assignment: { responderId: number; agencyId: number }) => void;
}

type AssignableResponder = {
  userId: number;
  fullName: string;
  agencyStaff?: {
    agencyId: number;
    staffRole: string;
  } | null;
  responder?: {
    id: number;
    agencyId: number;
    name: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    subCityName?: string | null;
    woredaName?: string | null;
  } | null;
};

type AssignableResponderOption = {
  id: number;
  agencyId: number;
  name: string;
  status: string;
  locationLabel: string;
  distanceKm: number | null;
};

const typeIcon = (type: ActivityLog['type']) => {
  switch (type) {
    case 'STATUS_CHANGE':
      return <Activity size={16} className="text-amber-300" />;
    case 'COMMENT':
      return <MessageSquare size={16} className="text-cyan-300" />;
    case 'ASSIGNMENT':
      return <Shield size={16} className="text-purple-300" />;
    case 'DISPATCH':
      return <MapPin size={16} className="text-green-300" />;
    case 'TRIAGE_UPDATE':
      return <PenLine size={16} className="text-pink-300" />;
    default:
      return <Clock size={16} className="text-slate-300" />;
  }
};

const haversineDistanceKm = (
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(endLat - startLat);
  const dLon = toRadians(endLon - startLon);
  const originLat = toRadians(startLat);
  const destinationLat = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(originLat) *
      Math.cos(destinationLat) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

interface TriageCorrectionFormProps {
  initialCategory: string;
  initialSeverity: number;
  onSave: (category: string, severity: number, reason: string) => Promise<void>;
  onCancel: () => void;
}

const TriageCorrectionForm = React.memo(
  ({ initialCategory, initialSeverity, onSave, onCancel }: TriageCorrectionFormProps) => {
    const [triageCategory, setTriageCategory] = useState(initialCategory || 'OTHER');
    const [triageSeverity, setTriageSeverity] = useState(initialSeverity || 1);
    const [triageReason, setTriageReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!triageReason.trim()) return;
      setActionLoading(true);
      try {
        await onSave(triageCategory, triageSeverity, triageReason);
        alert('Triage correction submitted successfully'); // Simple feedback
      } finally {
        setActionLoading(false);
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-3"
      >
        <h3 className="text-sm font-semibold text-white">Correct AI Triage</h3>
        <div className="grid grid-cols-2 gap-2">
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
              <span className="label-text text-xs text-slate-400">Category</span>
            </label>
            <select
              className="select select-bordered select-xs w-full bg-slate-800 text-white"
              value={triageCategory}
              onChange={(e) => setTriageCategory(e.target.value)}
            >
              <option value="TRAFFIC_ACCIDENT">Traffic Accident</option>
              <option value="FIRE_EMERGENCY">Fire Emergency</option>
              <option value="MEDICAL_EMERGENCY">Medical Emergency</option>
              <option value="POLLUTION">Pollution</option>
              <option value="INFRASTRUCTURE">Infrastructure</option>
              <option value="SECURITY">Security</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-2">
              <span className="label-text text-xs text-slate-400">Severity</span>
            </label>
            <input
              type="number"
              min="1"
              max="5"
              className="input input-bordered input-xs w-full bg-slate-800 text-white"
              value={triageSeverity}
              onChange={(e) => setTriageSeverity(Number(e.target.value))}
            />
          </div>
        </div>
        <textarea
          className={`textarea textarea-bordered textarea-xs w-full bg-slate-800 text-white ${
            !triageReason.trim() && 'textarea-error'
          }`}
          placeholder="Reason for correction (required)..."
          value={triageReason}
          onChange={(e) => setTriageReason(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="btn btn-xs btn-ghost"
            onClick={onCancel}
            disabled={actionLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-xs btn-primary"
            disabled={actionLoading || !triageReason.trim()}
          >
            {actionLoading ? 'Saving...' : 'Submit Correction'}
          </button>
        </div>
      </form>
    );
  },
);

const IncidentDetailPane: React.FC<Props> = ({
  incident: initialIncident,
  onClose,
  onAssign,
  onRespond,
  onResolve,
  responders = [],
  onAssignResponder,
}) => {
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(initialIncident);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const isOpen = Boolean(initialIncident);

  // Action State
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Triage Correction State
  const [isEditingTriage, setIsEditingTriage] = useState(false);

  useEffect(() => {
    if (incident) {
      setIsEditingTriage(false);
    }
  }, [incident?.id]); // Only reset editing state when a DIFFERENT incident is loaded

  const handleSaveTriage = async (category: string, severityScore: number, reason: string) => {
    if (!incident) return;
    try {
      const res = await api.patch(`/incidents/${incident.id}/triage`, {
        category,
        severityScore,
        reason,
      });
      setIncident(res.data.incident);
      setIsEditingTriage(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update triage');
      throw err; // Re-throw so form knows it failed if checking
    }
  };

  // Sync prop to state and fetch details
  useEffect(() => {
    // Lock mechanism: if editing triage, do not refresh the specific incident data from background updates
    if (isEditingTriage) {
      return;
    }

    setIncident(initialIncident);
    setShowDeclineInput(false);
    setDeclineReason('');

    if (initialIncident) {
      const fetchDetails = async () => {
        try {
          const res = await api.get(`/incidents/${initialIncident.id}`);
          if (res.data.incident) {
            setIncident((prev) => {
              if (isEditingTriage) return prev; // check again before setting state
              return { ...prev, ...res.data.incident };
            });
          }
        } catch (e) {
          console.error('Failed to fetch incident details', e);
        }
      };
      fetchDetails();
    }
  }, [initialIncident, isEditingTriage]);

  const [recs, setRecs] = useState<
    Array<{
      agencyId: number;
      agencyName?: string;
      unitId: number | null;
      unitName?: string | null;
      responderStatus?: string | null;
      subCityName?: string | null;
      woredaName?: string | null;
      distanceKm?: number | null;
      estimatedDurationMin?: number | null;
      totalScore?: number;
      jurisdictionScore?: number;
      severityScore?: number;
      proximityScore?: number;
      statusScore?: number;
    }>
  >([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [assignableResponders, setAssignableResponders] = useState<AssignableResponder[]>([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateIncident[]>([]);
  const [mergingId, setMergingId] = useState<number | null>(null);
  const [photos, setPhotos] = useState<IncidentPhoto[]>([]);
  const apiBase = useMemo(() => (api.defaults.baseURL || '').replace(/\/api$/, ''), []);

  // Chat & Share State
  const [activeTab, setActiveTab] = useState<'timeline' | 'chat'>('timeline');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Helper to find my responder profile
  const myResponderProfile = useMemo(() => {
    if (!user || !Array.isArray(responders)) return null; // Added array check
    // Responders are usually Agency Staff role or have a linked profile
    // The responders prop contains the list from /api/responders
    // We need to match user.id to responder.userId
    return responders.find((r: any) => r.userId === user.id);
  }, [user, responders]);

  const isAssignedToMe = useMemo(() => {
    if (!incident || !myResponderProfile) return false;
    return incident.assignedResponderId === myResponderProfile.id;
  }, [incident, myResponderProfile]);

  const needsAcknowledgement =
    isAssignedToMe && incident?.status === 'ASSIGNED' && !incident?.acknowledgedAt;

  const handleAcknowledge = async () => {
    if (!incident) return;
    setActionLoading(true);
    try {
      await api.post('/dispatch/acknowledge', { incidentId: incident.id });
      const res = await api.get(`/incidents/${incident.id}`);
      setIncident(res.data.incident);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to acknowledge');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!incident || !declineReason.trim()) return;
    setActionLoading(true);
    try {
      await api.post('/dispatch/decline', { incidentId: incident.id, reason: declineReason });
      onClose(); // Close on decline
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to decline');
    } finally {
      setActionLoading(false);
    }
  };

  // New Sharing State
  const [isAgencyModalOpen, setIsAgencyModalOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat' && incident) {
      const loadChat = async () => {
        try {
          const res = await api.get(`/incidents/${incident.id}/chat`);
          setChatMessages(res.data.messages || []);
        } catch (e) {
          console.error(e);
        }
      };
      loadChat();

      const socket = getSocket();
      if (socket) {
        socket.emit('join_incident', incident.id);
        socket.on('incident:chat', (msg: ChatMessage) => {
          setChatMessages((prev) => [...prev, msg]);
        });
      }

      return () => {
        if (socket) {
          socket.emit('leave_incident', incident.id);
          socket.off('incident:chat');
        }
      };
    }
  }, [activeTab, incident]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !incident) return;
    try {
      await api.post(`/incidents/${incident.id}/chat`, { message: chatInput.trim() });
      setChatInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareIncident = async (agencyId: number, reason: string, note: string) => {
    if (!incident) return;
    setIsSharing(true);
    try {
      await (api as any).shareIncident(incident.id, agencyId, reason, note);
      setIsAgencyModalOpen(false);
      alert('Incident shared successfully');
    } catch (err) {
      console.error('Failed to share incident', err);
      alert('Failed to share incident');
    } finally {
      setIsSharing(false);
    }
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
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message;
        setError(msg || 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };
    fetchTimeline();
  }, [incident]);

  useEffect(() => {
    const socket = getSocket();
    if (socket && incident) {
      // incident room joined in chat effect or globally, but we can ensure listening here
      socket.on('NEW_TIMELINE_ENTRY', (newLog: ActivityLog) => {
        // Logs are stored oldest first due to reverse() in fetchTimeline, so append to end
        setLogs((prev) => [...prev, newLog]);
      });
      return () => {
        socket.off('NEW_TIMELINE_ENTRY');
      };
    }
  }, [incident]);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!incident) return;
      try {
        const res = await api.get(`/incidents/${incident.id}/photos`);
        setPhotos(res.data.photos || []);
      } catch {
        setPhotos([]);
      }
    };
    fetchPhotos();
  }, [incident]);

  useEffect(() => {
    const checkDups = async () => {
      if (!incident || !incident.latitude || !incident.longitude) return;
      try {
        const res = await api.get('/incidents/duplicates', {
          params: {
            lat: incident.latitude,
            lng: incident.longitude,
            title: incident.title,
          },
        });
        // Filter out self
        const dups = (res.data.duplicates || []).filter(
          (d: DuplicateIncident) => d.id !== incident.id,
        );
        setDuplicates(dups);
      } catch (err) {
        console.warn('Failed to check duplicates', err);
      }
    };
    checkDups();
  }, [incident]);

  const handleMerge = async (targetId: number) => {
    if (
      !incident ||
      !confirm(
        'Are you sure you want to merge this duplicate into the current incident? The duplicate will be closed.',
      )
    )
      return;

    setMergingId(targetId);
    try {
      await api.post('/incidents/merge', {
        primaryId: incident.id,
        duplicateId: targetId,
      });
      // Remove from list
      setDuplicates((prev) => prev.filter((d) => d.id !== targetId));
      // Refresh timeline
      const res = await api.get(`/incidents/${incident.id}/timeline`);
      setLogs(res.data.logs?.reverse() || []);
    } catch {
      alert('Failed to merge incidents');
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

  useEffect(() => {
    const fetchAssignableResponders = async () => {
      if (!incident || !onAssignResponder || user?.role === 'CITIZEN') {
        setAssignableResponders([]);
        return;
      }

      setAssignableLoading(true);
      try {
        const res = await api.get('/agency/staff', {
          params: {
            role: 'RESPONDER',
            statuses: 'STANDBY,AVAILABLE',
          },
        });

        const fetchedStaff = (res.data.staff || []) as AssignableResponder[];
        const filteredStaff = fetchedStaff.filter((member) => {
          const responder = member.responder;
          if (!responder) return false;
          if (!incident.assignedAgencyId) return true;
          return responder.agencyId === incident.assignedAgencyId;
        });

        setAssignableResponders(filteredStaff);
      } catch (err) {
        console.error('Failed to load assignable responders', err);
        setAssignableResponders([]);
      } finally {
        setAssignableLoading(false);
      }
    };

    fetchAssignableResponders();
  }, [incident?.id, incident?.assignedAgencyId, onAssignResponder, user?.role]);

  const assignableResponderOptions = useMemo<AssignableResponderOption[]>(
    () =>
      assignableResponders
        .map((member) => {
          const responder = member.responder;
          if (!responder) return null;

          const distanceKm =
            incident?.latitude !== null &&
            incident?.latitude !== undefined &&
            incident?.longitude !== null &&
            incident?.longitude !== undefined &&
            responder.latitude !== null &&
            responder.longitude !== null
              ? haversineDistanceKm(
                  incident.latitude,
                  incident.longitude,
                  responder.latitude,
                  responder.longitude,
                )
              : null;

          const locationLabel =
            distanceKm !== null
              ? `${distanceKm.toFixed(1)}km from scene`
              : responder.subCityName || responder.woredaName || 'Location unavailable';

          return {
            id: responder.id,
            agencyId: responder.agencyId,
            name: responder.name || member.fullName,
            status: responder.status,
            locationLabel,
            distanceKm,
          };
        })
        .filter((responder): responder is AssignableResponderOption => Boolean(responder))
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        }),
    [assignableResponders, incident?.latitude, incident?.longitude],
  );

  const handleResponderSelection = (responderId: number) => {
    if (!onAssignResponder) return;
    const responder = assignableResponderOptions.find((option) => option.id === responderId);
    if (!responder) return;
    onAssignResponder({ responderId: responder.id, agencyId: responder.agencyId });
  };

  const handleComment = async () => {
    if (!incident || !comment.trim()) return;
    try {
      await api.post(`/incidents/${incident.id}/comment`, { message: comment.trim() });
      setComment('');
      const res = await api.get(`/incidents/${incident.id}/timeline`);
      const data = res.data.logs || [];
      setLogs(data.reverse());
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to add comment');
    }
  };

  const headerBg = useMemo(() => {
    if (!incident?.severityScore) return 'from-slate-900/70 via-slate-900/40 to-slate-900/10';
    if (incident.severityScore >= 5) return 'from-red-900/80 via-red-900/40 to-slate-900/10';
    if (incident.severityScore >= 4) return 'from-orange-900/80 via-orange-900/40 to-slate-900/10';
    if (incident.severityScore >= 3) return 'from-amber-900/80 via-amber-900/40 to-slate-900/10';
    return 'from-cyan-900/60 via-cyan-900/30 to-slate-900/10';
  }, [incident?.severityScore]);

  if (!isOpen || !incident) return null;

  return (
    <>
      <aside
        className={`fixed right-0 top-0 h-full w-[400px] z-[50] bg-slate-900 shadow-2xl transition-transform duration-300 ease-in-out border-l border-slate-700/50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div
          className={`p-4 bg-gradient-to-r ${headerBg} border-b border-slate-800 flex items-start justify-between`}
        >
          <div className="space-y-1">
            <p className="text-xs text-cyan-200 uppercase tracking-wide">Incident</p>
            <h2 className="text-2xl font-semibold text-white">{incident.title}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className={severityBadgeClass(incident.severityScore)}>
                {severityLabel(incident.severityScore)}
              </span>
              <span className="badge badge-outline badge-xs gap-1">
                {incident.category ?? 'Unclassified'}
                {user?.role !== 'CITIZEN' && (
                  <button
                    onClick={() => setIsEditingTriage(true)}
                    className="hover:text-cyan-300 ml-1"
                    title="Correct Triage"
                  >
                    <PenLine size={10} />
                  </button>
                )}
              </span>
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
            {user?.role !== 'CITIZEN' && (
              <button
                className="btn btn-circle btn-ghost btn-xs text-slate-300"
                onClick={() => setIsAgencyModalOpen(true)}
                title="Request Assistance"
              >
                <Share2 size={16} />
              </button>
            )}
            <button
              className="btn btn-circle btn-ghost btn-xs text-slate-300"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Categories / Triage Correction UI */}
        <div className="px-4 pt-4">
          {isEditingTriage ? (
            <TriageCorrectionForm
              initialCategory={incident.category ?? 'OTHER'}
              initialSeverity={incident.severityScore ?? 1}
              onSave={handleSaveTriage}
              onCancel={() => setIsEditingTriage(false)}
            />
          ) : (
            <div className="flex items-center gap-2 mb-2">{/* Original Read-only View */}</div>
          )}
        </div>

        {/* Tabs */}
        <div className="tabs tabs-boxed bg-slate-900 mx-4 mt-4">
          <a
            className={`tab ${activeTab === 'timeline' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline
          </a>
          <a
            className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Inter-Agency Chat
          </a>
        </div>

        {onAssignResponder && (
          <div className="p-3 border-b border-slate-800 bg-slate-900/60">
            <p className="text-sm font-semibold text-white mb-2">Assign responder</p>
            <div className="flex gap-2 items-center">
              <select
                className="select select-sm bg-slate-900 border-slate-700 text-white"
                onChange={(e) => handleResponderSelection(Number(e.target.value))}
                defaultValue=""
                disabled={assignableLoading || assignableResponderOptions.length === 0}
              >
                <option value="" disabled>
                  {assignableLoading
                    ? 'Loading responders...'
                    : assignableResponderOptions.length > 0
                      ? 'Select responder'
                      : 'No standby or available responders'}
                </option>
                {assignableResponderOptions.map((responder) => (
                    <option key={responder.id} value={responder.id}>
                      {responder.name} ({responder.status}) • {responder.locationLabel}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4 h-[calc(100%-240px)] overflow-y-auto">
          {activeTab === 'timeline' ? (
            <>
              {user?.role !== 'CITIZEN' && (
                <div className="p-3 rounded-lg border border-cyan-600/30 bg-slate-900/70">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Shield size={16} className="text-cyan-300" />
                      <h3 className="text-sm font-semibold text-white">Suggested dispatch</h3>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {recsLoading ? 'Calculating...' : `${recs.length || 0} options`}
                    </span>
                  </div>
                  {recsLoading ? (
                    <div className="text-xs text-slate-400">Calculating best agency/unit…</div>
                  ) : !recs.length ? (
                    <div className="text-xs text-slate-400">No recommendation available.</div>
                  ) : (
                    <div className="space-y-2">
                      {recs.slice(0, 3).map((rec, idx) => (
                        <div
                          key={rec.unitId ?? rec.agencyId ?? idx}
                          className="p-2 rounded-md bg-slate-800/70 border border-slate-700"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-200">
                              {rec.unitName || rec.agencyName || `Agency ${rec.agencyId}`}
                              {rec.agencyName && rec.unitName ? ` • ${rec.agencyName}` : ''}
                            </div>
                            <span className="text-[11px] text-cyan-300">
                              Score {((rec.totalScore || 0) * 100).toFixed(0)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-col mt-1">
                            <span>
                              {rec.distanceKm !== null && rec.distanceKm !== undefined
                                ? `${rec.distanceKm.toFixed(1)}km from scene`
                                : rec.subCityName || rec.woredaName || 'Location unavailable'}
                            </span>
                            {rec.responderStatus && (
                              <span className="text-slate-300">Status: {rec.responderStatus}</span>
                            )}
                            {rec.estimatedDurationMin !== null &&
                              rec.estimatedDurationMin !== undefined && (
                                <span className="text-emerald-400">
                                  Est. Driving Time:{' '}
                                  {rec.estimatedDurationMin < 1
                                    ? '< 1'
                                    : Math.round(rec.estimatedDurationMin)}{' '}
                                  mins
                                </span>
                              )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Proximity {Math.round((rec.proximityScore || 0) * 100)}% • Status{' '}
                            {Math.round((rec.statusScore || 0) * 100)}% • Jurisdiction{' '}
                            {Math.round((rec.jurisdictionScore || 0) * 100)}%
                          </div>
                          <button
                            className="btn btn-xs btn-accent mt-2"
                            onClick={async () => {
                              try {
                                await api.patch(`/incidents/${incident.id}/assign`, {
                                  assignedAgencyId: rec.agencyId,
                                  assignedResponderId: rec.unitId,
                                });
                                setIncident((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        assignedAgencyId: rec.agencyId,
                                        assignedResponderId: rec.unitId,
                                        status: 'ASSIGNED',
                                      }
                                    : prev,
                                );
                                alert('Suggestion accepted.');
                              } catch {
                                alert('Failed to assign suggestion.');
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
                      <div
                        key={d.id}
                        className="text-xs text-slate-300 flex justify-between items-center"
                      >
                        <span>
                          #{d.id} - {d.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            {d.distance ? Math.round(d.distance) + 'm' : ''}
                          </span>
                          <button
                            className="btn btn-xs btn-outline btn-warning"
                            disabled={mergingId === d.id}
                            onClick={() => handleMerge(d.id)}
                          >
                            {mergingId === d.id ? 'Merging...' : 'Merge'}
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

              {photos.length > 0 && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      Photos
                    </h3>
                    <span className="text-xs text-slate-500">{photos.length} file(s)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo) => (
                      <a
                        key={photo.id}
                        href={`${apiBase}${photo.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="block group"
                      >
                        <div className="aspect-video rounded-md overflow-hidden border border-slate-800 bg-slate-900">
                          <img
                            src={`${apiBase}${photo.url}`}
                            alt={photo.originalName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 truncate">
                          {photo.originalName}
                        </p>
                      </a>
                    ))}
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
                    {loading ? 'Loading...' : `${logs.length} entries`}
                  </span>
                </div>
                <div className="space-y-3">
                  {loading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div
                          key={idx}
                          className="h-12 bg-slate-900 border border-slate-800 rounded-lg animate-pulse"
                        />
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
                          {log.type === 'TRIAGE_UPDATE' ? (
                            <div className="text-sm text-white space-y-1">
                              <p>{log.message.split('Reason:')[0]}</p>
                              {log.message.includes('Reason:') && (
                                <p className="italic text-slate-300 text-xs border-l-2 border-slate-600 pl-2">
                                  Reason: {log.message.split('Reason:')[1]}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-white">{log.message}</p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            {new Date(log.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {user?.role !== 'CITIZEN' && (
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
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleComment}
                    disabled={!comment.trim()}
                  >
                    Post comment
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`chat ${msg.senderId === user?.id ? 'chat-end' : 'chat-start'}`}
                  >
                    <div className="chat-header text-xs opacity-50">
                      {msg.sender?.fullName} • {msg.sender?.agencyStaff?.agency?.name || 'Admin'}
                    </div>
                    <div className="chat-bubble chat-bubble-primary text-sm">{msg.message}</div>
                    <div className="chat-footer opacity-50 text-[10px]">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
                {chatMessages.length === 0 && (
                  <div className="text-center text-slate-500 text-sm mt-10">
                    No messages yet. Start the coordination.
                  </div>
                )}
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1 bg-slate-900"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-slate-800 bg-[#0C1322] flex flex-col gap-2">
          {needsAcknowledgement ? (
            <div className="flex flex-col gap-2 w-full animate-in slide-in-from-bottom-2 fade-in">
              {!showDeclineInput ? (
                <div className="flex gap-2 w-full">
                  <button
                    className="btn btn-primary flex-1 gap-2"
                    onClick={handleAcknowledge}
                    disabled={actionLoading}
                  >
                    <Check size={18} />
                    Accept Assignment
                  </button>
                  <button
                    className="btn btn-error btn-outline flex-1 gap-2"
                    onClick={() => setShowDeclineInput(true)}
                    disabled={actionLoading}
                  >
                    <XCircle size={18} />
                    Decline
                  </button>
                </div>
              ) : (
                <div className="bg-slate-900/50 p-3 rounded-lg border border-red-900/30 space-y-2">
                  <p className="text-sm font-medium text-red-200">Reason for declining:</p>
                  <textarea
                    className="textarea textarea-bordered w-full bg-slate-800 text-white textarea-sm"
                    placeholder="e.g., Equipment failure, Out of fuel..."
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      className="btn btn-ghost btn-xs"
                      onClick={() => setShowDeclineInput(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-error btn-xs"
                      onClick={handleDecline}
                      disabled={!declineReason.trim() || actionLoading}
                    >
                      Confirm Decline
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
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
          )}
        </div>
      </aside>

      {isAgencyModalOpen && (
        <AgencySelectionModal
          isOpen={isAgencyModalOpen}
          onClose={() => setIsAgencyModalOpen(false)}
          onSelect={handleShareIncident}
          isLoading={isSharing}
        />
      )}
    </>
  );
};

export default IncidentDetailPane;
