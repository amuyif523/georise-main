import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import api from './lib/api';
import { connectSocket, disconnectSocket, getSocket, setActiveIncidentRoom } from './lib/socket';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useLocationTracker } from './hooks/useLocationTracker';
import NetworkBanner from './components/NetworkBanner';
import InstallAppBanner from './components/InstallAppBanner';
import LoginForm from './components/LoginForm';
import SetupPassword from './components/SetupPassword';
import VerificationTerminal from './components/VerificationTerminal';
import MissionDashboard from './components/MissionDashboard';
import * as turf from '@turf/turf';
import { addChatMessageToQueue } from './offline/chatQueue';
import { flushOfflineQueuesChronologically } from './offline/offlineSync';
import { addStatusUpdateToQueue } from './offline/responderLocationQueue';

const TacticalChatDrawer = lazy(() => import('./components/TacticalChatDrawer'));
const TacticalMap = lazy(() => import('./components/TacticalMap'));
const preloadMap = () => import('./components/TacticalMap');

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

type Incident = {
  id: number;
  assignedAgencyId?: number | null;
  assignedResponderId?: number | null;
  title: string;
  description?: string | null;
  category?: string | null;
  severityScore?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  acknowledgedAt?: string | null;
  subCity?: { id: number; name: string } | null;
  woreda?: { id: number; name: string } | null;
  photos?: Array<{
    id: number;
    url: string;
    originalName?: string | null;
  }>;
};

type NearbyResponder = {
  id: number;
  name: string;
  status: string;
  latitude: number;
  longitude: number;
  user?: { id: number; fullName?: string | null } | null;
};

type VerificationRequest = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string | null;
};

type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  mustChangePassword?: boolean;
  isVerified?: boolean;
  citizenVerification?: {
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    verifiedAt?: string | null;
  } | null;
  verificationRequest?: VerificationRequest | null;
};

type ChatMessage = {
  id: number;
  incidentId: number;
  senderId: number;
  message: string;
  createdAt: string;
  clientId?: string;
  syncState?: 'PENDING' | 'SYNCING';
  sender?: {
    id: number;
    fullName?: string | null;
    role?: string | null;
  } | null;
};

const normalizeUser = (payload: unknown): AuthUser | null => {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as { user?: AuthUser } & AuthUser;
  return data.user || data;
};

const isTrustedVerifiedUser = (candidate: AuthUser | null) => {
  if (!candidate) return false;
  return candidate.isVerified === true || candidate.citizenVerification?.status === 'VERIFIED';
};

const ACTIVE_INCIDENT_STORAGE_KEY = 'responder_active_incident_id';
type AppView = 'MISSION_DASHBOARD' | 'TACTICAL_MAP';

const DeferredPanelFallback = ({ label }: { label: string }) => (
  <div className="flex h-full min-h-24 items-center justify-center bg-slate-950/60 text-xs text-slate-400">
    <div className="flex items-center gap-2">
      <span className="loading loading-spinner loading-sm" />
      <span>{label}</span>
    </div>
  </div>
);

const getPublicAssetUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const normalizeIncident = (payload: any): Incident => ({
  id: payload.id,
  assignedAgencyId: payload.assignedAgencyId ?? null,
  assignedResponderId: payload.assignedResponderId ?? null,
  title: payload.title || 'Untitled Incident',
  description: payload.description ?? null,
  category: payload.category ?? payload.aiOutput?.category ?? null,
  severityScore: payload.severityScore ?? payload.aiOutput?.severityScore ?? null,
  latitude: payload.latitude ?? null,
  longitude: payload.longitude ?? null,
  status: payload.status,
  acknowledgedAt: payload.acknowledgedAt ?? null,
  subCity: payload.subCity ?? null,
  woreda: payload.woreda ?? null,
  photos: Array.isArray(payload.photos)
    ? payload.photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        originalName: photo.originalName ?? null,
      }))
    : [],
});

const getResponderStatusForIncident = (incidentStatus?: string | null) => {
  if (incidentStatus === 'ARRIVED' || incidentStatus === 'ON_SCENE') return 'ON_SCENE';
  if (incidentStatus === 'RESPONDING' || incidentStatus === 'EN_ROUTE') return 'EN_ROUTE';
  if (incidentStatus === 'ASSIGNED') return 'ASSIGNED';
  return undefined;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('responder_token'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptingMission, setAcceptingMission] = useState(false);
  const online = useNetworkStatus();

  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const [recenterToken, setRecenterToken] = useState(0);
  const [closingPhoto, setClosingPhoto] = useState<File | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(() => Boolean(token));
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [nearbyResponders, setNearbyResponders] = useState<NearbyResponder[]>([]);
  const [missionMapOfflineReady, setMissionMapOfflineReady] = useState(false);
  const [view, setView] = useState<AppView>('MISSION_DASHBOARD');
  const [mapActivated, setMapActivated] = useState(false);
  const [socketResponderCoords, setSocketResponderCoords] = useState<{
    lat: number;
    lng: number;
    heading?: number | null;
    updatedAt: number;
  } | null>(null);
  const [autoArriving, setAutoArriving] = useState(false);
  const trackerCoords = useLocationTracker(getResponderStatusForIncident(activeIncident?.status));
  const coords = useMemo(() => {
    if (!socketResponderCoords) return trackerCoords;
    if (!trackerCoords) {
      return {
        lat: socketResponderCoords.lat,
        lng: socketResponderCoords.lng,
        heading: socketResponderCoords.heading ?? null,
      };
    }

    const trackerTimestamp = Date.now();
    const socketAgeMs = trackerTimestamp - socketResponderCoords.updatedAt;
    if (socketAgeMs <= 10000) {
      return {
        lat: socketResponderCoords.lat,
        lng: socketResponderCoords.lng,
        heading: socketResponderCoords.heading ?? trackerCoords.heading ?? null,
      };
    }

    return trackerCoords;
  }, [socketResponderCoords, trackerCoords]);
  const handleRouteData = useCallback((distanceKm: number, durationMin: number) => {
    setRouteDist(distanceKm);
    setRouteEta(durationMin);
  }, []);

  useEffect(() => {
    setMissionMapOfflineReady(false);
    setRouteDist(null);
    setRouteEta(null);
    setSocketResponderCoords(null);
    setAutoArriving(false);
  }, [activeIncident?.id]);

  const applyAuthSession = (nextToken: string, nextUser: AuthUser, refreshToken?: string) => {
    localStorage.setItem('responder_token', nextToken);
    if (refreshToken) {
      localStorage.setItem('responder_refresh_token', refreshToken);
    }
    setToken(nextToken);
    setUser(nextUser);
  };

  const openTacticalMap = () => {
    setMapActivated(true);
    void preloadMap();
    setView('TACTICAL_MAP');
  };

  const distToTarget = useMemo(() => {
    if (!coords || !activeIncident?.latitude || !activeIncident?.longitude) return Infinity;
    const from = turf.point([coords.lng, coords.lat]);
    const to = turf.point([activeIncident.longitude, activeIncident.latitude]);
    return turf.distance(from, to, { units: 'kilometers' });
  }, [activeIncident?.latitude, activeIncident?.longitude, coords]);
  const canResolve = distToTarget <= 0.1; // 100 meters
  const finalReportVisible = view === 'TACTICAL_MAP' && (activeIncident?.status === 'ARRIVED' || activeIncident?.status === 'ON_SCENE');

  useEffect(() => {
    if (finalReportVisible) {
      setChatOpen(false);
    }
  }, [finalReportVisible]);

  const fetchIncidentDetails = async (incidentId: number) => {
    const res = await api.get(`/incidents/${incidentId}`);
    const incidentPayload = res.data?.incident ?? res.data;
    const incident = normalizeIncident(incidentPayload);
    localStorage.setItem(ACTIVE_INCIDENT_STORAGE_KEY, String(incident.id));
    setActiveIncident(incident);
    return incident;
  };

  const fetchActiveIncident = async () => {
    const res = await api.get('/responders/me/active-incident');
    const payload = res.data?.incident;
    if (!payload) {
      localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
      setActiveIncident(null);
      return null;
    }
    const incident = normalizeIncident(payload);
    localStorage.setItem(ACTIVE_INCIDENT_STORAGE_KEY, String(incident.id));
    setActiveIncident(incident);
    return incident;
  };

  const fetchIncidentChat = async (incidentId: number) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/incidents/${incidentId}/chat`);
      setChatMessages((prev) => {
        const pending = prev.filter((msg) => msg.syncState === 'PENDING' || msg.syncState === 'SYNCING');
        return [...(res.data?.messages || []), ...pending];
      });
    } catch (err) {
      console.error('Failed to load incident chat', err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', {
        email,
        password,
        clientSource: 'RESPONDER_APP',
      });
      const t = res.data.token;
      const authUser = normalizeUser(res.data);

      if (!authUser) {
        throw new Error('Invalid authentication response.');
      }

      // Verify role
      if (
        authUser.role !== 'RESPONDER' &&
        authUser.role !== 'AGENCY_STAFF' &&
        authUser.role !== 'ADMIN'
      ) {
        throw new Error('Unauthorized: Only responders can access this app.');
      }

      applyAuthSession(t, authUser, res.data.refreshToken);
      setMapActivated(true);
      void preloadMap();
      setMessage('Connected as responder.');

      // Push subscription
      try {
        if (
          'serviceWorker' in navigator &&
          'PushManager' in window &&
          import.meta.env.VITE_VAPID_PUBLIC_KEY
        ) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
            });
            await api.post('/notifications/subscribe', subscription.toJSON());
          }
        }
      } catch (pushErr) {
        console.warn('Silent failure on push subscription:', pushErr);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('responder_token');
    localStorage.removeItem('responder_refresh_token');
    localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
    disconnectSocket();
    setToken(null);
    setUser(null);
    setActiveIncident(null);
    setChatMessages([]);
    setChatInput('');
    setResolutionNotes('');
    setView('MISSION_DASHBOARD');
    setMapActivated(false);
  };

  const refreshSessionUser = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/auth/me');
      const authUser = normalizeUser(res.data);
      if (!authUser) {
        throw new Error('Invalid session payload.');
      }
      setUser(authUser);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to refresh verification status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
    return () => {
      if (!token) {
        disconnectSocket();
      }
    };
  }, [token]);

  useEffect(() => {
    if (!online || !token) return;

    const sync = async () => {
      await flushOfflineQueuesChronologically({
        onChatStateChange: (clientId, state) => {
          if (state === 'SYNCING') {
            setChatMessages((prev) =>
              prev.map((msg) => (msg.clientId === clientId ? { ...msg, syncState: 'SYNCING' } : msg)),
            );
            return;
          }

          if (state === 'SYNCED') {
            setChatMessages((prev) => prev.filter((msg) => msg.clientId !== clientId));
            return;
          }

          if (state === 'FAILED') {
            setChatMessages((prev) =>
              prev.map((msg) => (msg.clientId === clientId ? { ...msg, syncState: 'PENDING' } : msg)),
            );
          }
        },
      });
    };

    void sync();
  }, [online, token]);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setBootstrapping(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        const authUser = normalizeUser(res.data);
        if (!authUser) {
          throw new Error('Invalid session payload.');
        }

        setUser(authUser);
        setMapActivated(true);
        void preloadMap();
        try {
          await fetchActiveIncident();
        } catch (incidentErr) {
          console.warn('Failed to restore active incident', incidentErr);
          localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
          setActiveIncident(null);
        }
      } catch (err: any) {
        console.error('Responder session bootstrap failed', err);
        logout();
      } finally {
        setBootstrapping(false);
      }
    };

    void bootstrap();
  }, [token]);

  useEffect(() => {
    setActiveIncidentRoom(activeIncident?.id ?? null);
  }, [activeIncident?.id]);

  useEffect(() => {
    if (view === 'TACTICAL_MAP') {
      setMapActivated(true);
    }
  }, [view]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAssigned = (payload: any) => {
      void fetchIncidentDetails(payload.incidentId).catch((err) => {
        console.error('Failed to fetch assigned incident details', err);
        setError('Received an assignment, but scene details could not be loaded.');
      });
      setChatOpen(true);
      setMessage('New assignment received.');
    };
    const onArrival = (payload: any) => {
      if (activeIncident && payload.incidentId === activeIncident.id) {
        setActiveIncident((current) =>
          current && current.id === payload.incidentId ? { ...current, status: 'ARRIVED' } : current,
        );
      }
    };
    const onStatusChanged = (payload: any) => {
      if (!activeIncident || payload.incidentId !== activeIncident.id) return;
      setActiveIncident((current) =>
        current && current.id === payload.incidentId ? { ...current, status: payload.status } : current,
      );
      if (payload.status === 'ARRIVED') {
        setAutoArriving(false);
        setMessage('Responder status updated: On scene.');
      }
    };
    const onResponderLocationUpdate = (payload: any) => {
      if (typeof payload?.lat !== 'number' || typeof payload?.lng !== 'number') return;
      setSocketResponderCoords({
        lat: payload.lat,
        lng: payload.lng,
        heading: null,
        updatedAt: typeof payload.updatedAt === 'number' ? payload.updatedAt : Date.now(),
      });
    };
    socket.on('incident:assignedResponder', onAssigned);
    socket.on('incident:arrival', onArrival);
    socket.on('incident:statusChanged', onStatusChanged);
    socket.on('responder:locationUpdate', onResponderLocationUpdate);
    return () => {
      socket.off('incident:assignedResponder', onAssigned);
      socket.off('incident:arrival', onArrival);
      socket.off('incident:statusChanged', onStatusChanged);
      socket.off('responder:locationUpdate', onResponderLocationUpdate);
    };
  }, [activeIncident]);

  useEffect(() => {
    if (!activeIncident?.id || activeIncident.status !== 'RESPONDING') {
      setAutoArriving(false);
      return;
    }
    if (!coords || !Number.isFinite(distToTarget) || distToTarget > 0.02 || autoArriving) {
      return;
    }

    setAutoArriving(true);
    void syncResponderMissionStatus('ARRIVED')
      .then(() => {
        setActiveIncident((current) =>
          current && current.id === activeIncident.id ? { ...current, status: 'ARRIVED' } : current,
        );
        setMessage('Status synced automatically: Arrived on scene.');
      })
      .catch((err: any) => {
        setAutoArriving(false);
        setError(err?.response?.data?.message || err?.message || 'Failed to mark arrival.');
      });
  }, [activeIncident?.id, activeIncident?.status, autoArriving, coords, distToTarget]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeIncident?.id) {
      setChatMessages([]);
      setChatInput('');
      return;
    }

    void fetchIncidentChat(activeIncident.id);
    socket.emit('join_incident', activeIncident.id);

    const onChatMessage = (msg: ChatMessage) => {
      if (msg.incidentId !== activeIncident.id) return;
      setChatMessages((prev) => {
        if (prev.some((existing) => existing.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    };

    socket.on('incident:chat', onChatMessage);
    socket.on('incident:message', onChatMessage);

    return () => {
      socket.emit('leave_incident', activeIncident.id);
      socket.off('incident:chat', onChatMessage);
      socket.off('incident:message', onChatMessage);
    };
  }, [activeIncident?.id]);

  useEffect(() => {
    if (!activeIncident) {
      setNearbyResponders([]);
      return;
    }

    const loadNearbyResponders = async () => {
      try {
        const res = await api.get('/responders');
        const rawResponders = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.responders)
            ? res.data.responders
            : [];
        const scoped = rawResponders
          .filter((responder: any) => responder.id !== activeIncident.assignedResponderId)
          .filter((responder: any) => responder.latitude && responder.longitude)
          .filter((responder: any) => {
            if (!activeIncident.latitude || !activeIncident.longitude) return true;
            const from = turf.point([activeIncident.longitude, activeIncident.latitude]);
            const to = turf.point([Number(responder.longitude), Number(responder.latitude)]);
            return turf.distance(from, to, { units: 'kilometers' }) <= 5;
          })
          .slice(0, 8);
        setNearbyResponders(scoped);
      } catch (err) {
        console.warn('Failed to load nearby responders', err);
      }
    };

    void loadNearbyResponders();
    const interval = window.setInterval(() => {
      void loadNearbyResponders();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [activeIncident?.id, activeIncident?.latitude, activeIncident?.longitude, activeIncident?.assignedResponderId]);

  const openMaps = () => {
    if (!activeIncident?.latitude || !activeIncident.longitude) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${activeIncident.latitude},${activeIncident.longitude}&travelmode=driving`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const acceptMission = async () => {
    if (!activeIncident) return;
    setAcceptingMission(true);
    setError(null);
    try {
      await api.post('/dispatch/acknowledge', { incidentId: activeIncident.id });
      setActiveIncident({ ...activeIncident, acknowledgedAt: new Date().toISOString() });
      setMessage('Mission accepted. Dispatch has been notified.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to accept mission.');
    } finally {
      setAcceptingMission(false);
    }
  };

  const startMission = async () => {
    if (!activeIncident) return;
    try {
      await syncResponderMissionStatus('EN_ROUTE');
      setActiveIncident({ ...activeIncident, status: 'RESPONDING' });
      setMessage('Mission started. Status synced with dispatch.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to start mission.');
    }
  };

  const markResolved = async () => {
    if (!activeIncident) return;
    if (!canResolve) {
      setError('You are too far from the incident site.');
      return;
    }
    if (!closingPhoto) {
      setError('Resolution photo is required.');
      return;
    }
    if (!resolutionNotes.trim()) {
      setError('Resolution notes are required.');
      return;
    }
    if (!confirm('Mark incident resolved?')) return;
    try {
      // Create FormData to upload photo (Evidence Bridge)
      const fd = new FormData();
      fd.append('note', resolutionNotes.trim());
      fd.append('photo', closingPhoto);

      await api.patch(`/incidents/${activeIncident.id}/resolve`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setActiveIncident(null);
      setView('MISSION_DASHBOARD');
      localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
      setMessage('Incident marked resolved.');
      setClosingPhoto(null);
      setResolutionNotes('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resolve');
    }
  };

  const queueChatMessage = async (messageOverride?: string) => {
    if (!activeIncident) return;
    const text = (messageOverride ?? chatInput).trim();
    if (!text) return;

    const queued = await addChatMessageToQueue(activeIncident.id, text);
    setChatMessages((prev) => [
      ...prev,
      {
        id: -Date.now(),
        incidentId: activeIncident.id,
        senderId: user?.id || 0,
        message: text,
        createdAt: queued.ts,
        clientId: queued.clientId,
        syncState: 'PENDING',
        sender: { id: user?.id || 0, fullName: user?.fullName || 'You' },
      },
    ]);
    setChatInput('');
    setChatOpen(true);
    setMessage('Offline. Chat message queued for sync.');
  };

  const sendChatMessage = async (messageOverride?: string) => {
    if (!activeIncident) return;
    const text = (messageOverride ?? chatInput).trim();
    if (!text) return;

    await api.post(`/incidents/${activeIncident.id}/chat`, { message: text });
    setChatInput('');
    setChatOpen(true);
  };

  const syncResponderMissionStatus = async (nextStatus: 'EN_ROUTE' | 'ARRIVED') => {
    if (!coords) {
      throw new Error('Current GPS location is required to update mission status.');
    }

    const incidentPath =
      nextStatus === 'ARRIVED'
        ? `/incidents/${activeIncident?.id}/arrive`
        : `/incidents/${activeIncident?.id}/respond`;

    const responderStatus = nextStatus === 'ARRIVED' ? 'ON_SCENE' : 'EN_ROUTE';

    try {
      await api.patch('/responders/me/status', { status: responderStatus });
      if (nextStatus !== 'ARRIVED') {
        await api.patch('/responders/me/location', {
          latitude: coords.lat,
          longitude: coords.lng,
          status: responderStatus,
        });
      }
      await api.patch(incidentPath, {});
    } catch (err: any) {
      const maybeNetworkError =
        !err?.response || err.code === 'ERR_NETWORK' || /network/i.test(err?.message || '');
      if (maybeNetworkError && activeIncident?.id) {
        await addStatusUpdateToQueue(activeIncident.id, nextStatus, coords.lat, coords.lng);
        setMessage('Network unstable. Mission status queued for sync.');
      } else {
        throw err;
      }
    }

    const socket = getSocket();
    if (socket) {
      socket.emit('responder:locationUpdate', {
        lat: coords.lat,
        lng: coords.lng,
        status: responderStatus,
      });
    }
  };

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-sm text-slate-400">Restoring duty session...</div>
      </div>
    );
  }

  if (!token) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  if (user?.mustChangePassword) {
    return (
      <SetupPassword
        onComplete={({ user: nextUser, token: nextToken, refreshToken }) => {
          applyAuthSession(nextToken, nextUser, refreshToken);
          setMessage('Password updated successfully.');
        }}
      />
    );
  }

  if (user && !isTrustedVerifiedUser(user)) {
    return (
      <VerificationTerminal user={user} loading={loading} onRefresh={refreshSessionUser} onLogout={logout} />
    );
  }

  const landmark = activeIncident
    ? [activeIncident.subCity?.name, activeIncident.woreda?.name].filter(Boolean).join(', ') ||
      activeIncident.title
    : null;
  const severityLabel =
    activeIncident?.severityScore !== null && activeIncident?.severityScore !== undefined
      ? `${Number(activeIncident.severityScore).toFixed(1)}/10`
      : 'Pending AI';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col">
      <NetworkBanner missionMapOfflineReady={missionMapOfflineReady} />
      <InstallAppBanner />
      <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-[11px] text-slate-400">GEORISE Responder</div>
          <div className="text-sm font-semibold">On Duty</div>
        </div>
        <button className="btn btn-xs btn-outline text-slate-400 hover:text-white" onClick={logout}>
          Logout
        </button>
      </header>

      <main className="relative flex-1 overflow-hidden">
        {token && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1300] px-4 pt-4">
              <div className="mx-auto flex max-w-md flex-col gap-2">
                {message && <div className="pointer-events-auto alert alert-info text-xs">{message}</div>}
                {error && <div className="pointer-events-auto alert alert-error text-xs">{error}</div>}
              </div>
            </div>

            <div className={view === 'MISSION_DASHBOARD' ? 'block h-full' : 'hidden h-full'}>
              <MissionDashboard
                incident={activeIncident}
                online={online}
                responderCoords={coords}
                landmark={landmark}
                severityLabel={severityLabel}
                getPhotoUrl={getPublicAssetUrl}
                accepting={acceptingMission}
                onAcceptMission={acceptMission}
                onStartMission={startMission}
                onGoToMap={openTacticalMap}
                onOpenMaps={openMaps}
              />
            </div>

            {(mapActivated || view === 'TACTICAL_MAP') && (
              <Suspense fallback={<DeferredPanelFallback label="Initializing tactical map..." />}>
                <TacticalMap
                  visible={view === 'TACTICAL_MAP'}
                  incidentTitle={activeIncident?.title ?? null}
                  incidentStatus={activeIncident?.status ?? null}
                  incidentLat={activeIncident?.latitude}
                  incidentLng={activeIncident?.longitude}
                  routeDist={routeDist}
                  routeEta={routeEta}
                  following={following}
                  responderCoords={coords}
                  currentUserId={user?.id}
                  nearbyResponders={nearbyResponders}
                  hasIncident={Boolean(activeIncident)}
                  canResolve={canResolve}
                  closingPhoto={closingPhoto}
                  resolutionNotes={resolutionNotes}
                  onBack={() => setView('MISSION_DASHBOARD')}
                  onOpenMaps={openMaps}
                  onToggleFollowing={() => setFollowing(!following)}
                  onRecenter={() => {
                    setFollowing(true);
                    setRecenterToken((current) => current + 1);
                  }}
                  onStartMission={startMission}
                  onArrive={async () => {
                    if (!activeIncident) return;
                    try {
                      await syncResponderMissionStatus('ARRIVED');
                      setActiveIncident({ ...activeIncident, status: 'ARRIVED' });
                      setMessage('Status synced: Arrived');
                    } catch (err: any) {
                      setError(err?.response?.data?.message || err?.message || 'Failed to mark arrival.');
                    }
                  }}
                  onResolve={markResolved}
                  onClosingPhotoChange={setClosingPhoto}
                  onResolutionNotesChange={setResolutionNotes}
                  onRouteData={handleRouteData}
                  recenterToken={recenterToken}
                  finalReportVisible={finalReportVisible}
                />
              </Suspense>
            )}
          </>
        )}
      </main>
      {token && activeIncident && view === 'TACTICAL_MAP' && (
        <Suspense fallback={<DeferredPanelFallback label="Loading tactical chat..." />}>
          <TacticalChatDrawer
            open={chatOpen}
            compactMode={finalReportVisible}
            loading={chatLoading}
            messages={chatMessages}
            currentUserId={user?.id}
            input={chatInput}
            onInputChange={setChatInput}
            onToggle={() => setChatOpen((prev) => !prev)}
            onSend={sendChatMessage}
            onQuickSend={(message) => {
              return sendChatMessage(message);
            }}
            onQueueFailedMessage={(message) => {
              return queueChatMessage(message);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
