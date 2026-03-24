import React, { useEffect, useState } from 'react';
import api from './lib/api';
import { connectSocket, disconnectSocket, getSocket } from './lib/socket';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useLocationTracker } from './hooks/useLocationTracker';
import NetworkBanner from './components/NetworkBanner';
import InstallAppBanner from './components/InstallAppBanner';
import LoginForm from './components/LoginForm';
import IncidentMap from './components/IncidentMap';
import SetupPassword from './components/SetupPassword';
import VerificationTerminal from './components/VerificationTerminal';
import TacticalChatDrawer from './components/TacticalChatDrawer';
import { MapPin, Navigation2, CheckCircle, AlertCircle, Camera } from 'lucide-react';
import * as turf from '@turf/turf';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

type Incident = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  severityScore?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
  subCity?: { id: number; name: string } | null;
  woreda?: { id: number; name: string } | null;
  photos?: Array<{
    id: number;
    url: string;
    originalName?: string | null;
  }>;
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
  verificationRequest?: VerificationRequest | null;
};

type ChatMessage = {
  id: number;
  incidentId: number;
  senderId: number;
  message: string;
  createdAt: string;
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

const ACTIVE_INCIDENT_STORAGE_KEY = 'responder_active_incident_id';

const getPublicAssetUrl = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
};

const normalizeIncident = (payload: any): Incident => ({
  id: payload.id,
  title: payload.title || 'Untitled Incident',
  description: payload.description ?? null,
  category: payload.category ?? payload.aiOutput?.category ?? null,
  severityScore: payload.severityScore ?? payload.aiOutput?.severityScore ?? null,
  latitude: payload.latitude ?? null,
  longitude: payload.longitude ?? null,
  status: payload.status,
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
  if (incidentStatus === 'ON_SCENE') return 'ON_SCENE';
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
  const online = useNetworkStatus();

  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const [closingPhoto, setClosingPhoto] = useState<File | null>(null);
  const [bootstrapping, setBootstrapping] = useState<boolean>(() => Boolean(token));
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const coords = useLocationTracker(getResponderStatusForIncident(activeIncident?.status));

  const applyAuthSession = (nextToken: string, nextUser: AuthUser, refreshToken?: string) => {
    localStorage.setItem('responder_token', nextToken);
    if (refreshToken) {
      localStorage.setItem('responder_refresh_token', refreshToken);
    }
    setToken(nextToken);
    setUser(nextUser);
  };

  let distToTarget = Infinity;
  if (coords && activeIncident?.latitude && activeIncident?.longitude) {
    const from = turf.point([coords.lng, coords.lat]);
    const to = turf.point([activeIncident.longitude, activeIncident.latitude]);
    distToTarget = turf.distance(from, to, { units: 'kilometers' });
  }
  const canResolve = distToTarget <= 0.1; // 100 meters

  const fetchIncidentDetails = async (incidentId: number) => {
    const res = await api.get(`/incidents/${incidentId}`);
    const incidentPayload = res.data?.incident ?? res.data;
    const incident = normalizeIncident(incidentPayload);
    localStorage.setItem(ACTIVE_INCIDENT_STORAGE_KEY, String(incident.id));
    setActiveIncident(incident);
    return incident;
  };

  const fetchIncidentChat = async (incidentId: number) => {
    setChatLoading(true);
    try {
      const res = await api.get(`/incidents/${incidentId}/chat`);
      setChatMessages(res.data?.messages || []);
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
        const savedIncidentId = localStorage.getItem(ACTIVE_INCIDENT_STORAGE_KEY);
        if (savedIncidentId) {
          try {
            await fetchIncidentDetails(Number(savedIncidentId));
          } catch (incidentErr) {
            console.warn('Failed to restore active incident', incidentErr);
            localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
            setActiveIncident(null);
          }
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
        setActiveIncident({ ...activeIncident, status: 'RESPONDING' });
      }
    };
    socket.on('incident:assignedResponder', onAssigned);
    socket.on('incident:arrival', onArrival);
    return () => {
      socket.off('incident:assignedResponder', onAssigned);
      socket.off('incident:arrival', onArrival);
    };
  }, [activeIncident]);

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

  const openMaps = () => {
    if (!activeIncident?.latitude || !activeIncident.longitude) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${activeIncident.latitude},${activeIncident.longitude}`,
    );
  };

  const markResolved = async () => {
    if (!activeIncident) return;
    if (!canResolve) {
      setError('You are too far from the incident site.');
      return;
    }
    if (!confirm('Mark incident resolved?')) return;
    try {
      // Create FormData to upload photo (Evidence Bridge)
      const fd = new FormData();
      fd.append('note', 'Resolved by responder');
      if (closingPhoto) {
        fd.append('photo', closingPhoto);
      }

      await api.patch(`/incidents/${activeIncident.id}/resolve`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setActiveIncident({ ...activeIncident, status: 'RESOLVED' });
      localStorage.removeItem(ACTIVE_INCIDENT_STORAGE_KEY);
      setMessage('Incident marked resolved.');
      setClosingPhoto(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resolve');
    }
  };

  const sendChatMessage = async (messageOverride?: string) => {
    if (!activeIncident) return;
    const text = (messageOverride ?? chatInput).trim();
    if (!text) return;

    try {
      await api.post(`/incidents/${activeIncident.id}/chat`, { message: text });
      setChatInput('');
      setChatOpen(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send message to dispatch.');
    }
  };

  const syncResponderMissionStatus = async (nextStatus: 'EN_ROUTE' | 'ON_SCENE') => {
    if (!coords) {
      throw new Error('Current GPS location is required to update mission status.');
    }

    await api.patch('/responders/me/status', { status: nextStatus });
    await api.patch('/responders/me/location', {
      latitude: coords.lat,
      longitude: coords.lng,
      status: nextStatus,
    });

    const socket = getSocket();
    if (socket) {
      socket.emit('responder:locationUpdate', {
        lat: coords.lat,
        lng: coords.lng,
        status: nextStatus,
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

  if (user && !user.isVerified) {
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
      <NetworkBanner />
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

      <main className="flex-1 p-4 pb-40 flex flex-col gap-4 max-w-md mx-auto w-full">
        {token && (
          <>
            {message && <div className="alert alert-info text-xs">{message}</div>}
            {error && <div className="alert alert-error text-xs">{error}</div>}

            <div className="card p-4 space-y-2">
              <div className="text-xs text-slate-400">Your location</div>
              {coords ? (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-cyan-300" />
                  <div>
                    <div>
                      {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {online ? 'Online' : 'Offline (queued)'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">Waiting for GPS…</div>
              )}
            </div>

            <div className="card p-4 space-y-3">
              <div className="text-xs text-slate-400">Active mission</div>
              {activeIncident ? (
                <>
                  <div className="text-sm font-semibold">{activeIncident.title}</div>
                  {landmark && (
                    <div className="text-xs text-slate-400">
                      Landmark: <span className="text-slate-200">{landmark}</span>
                    </div>
                  )}
                  {activeIncident.description && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-200">
                      {activeIncident.description}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-200">
                      {activeIncident.category || 'UNCLASSIFIED'}
                    </div>
                    <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                      Severity {severityLabel}
                    </div>
                  </div>
                  {activeIncident.photos && activeIncident.photos.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-400">Citizen photos</div>
                      <div className="grid grid-cols-3 gap-2">
                        {activeIncident.photos.map((photo) => {
                          const photoUrl = getPublicAssetUrl(photo.url);
                          return (
                            <a
                              key={photo.id}
                              href={photoUrl || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
                            >
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt={photo.originalName || 'Incident evidence'}
                                  className="h-20 w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-20 items-center justify-center text-[11px] text-slate-500">
                                  Photo unavailable
                                </div>
                              )}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {coords && (
                    <div className="h-64 rounded-xl overflow-hidden relative border border-slate-700 shadow-inner">
                      <IncidentMap
                        responderLat={coords.lat}
                        responderLng={coords.lng}
                        incidentLat={activeIncident.latitude}
                        incidentLng={activeIncident.longitude}
                        following={following}
                        onRouteData={(d, t) => {
                          setRouteDist(d);
                          setRouteEta(t);
                        }}
                      />
                      <div className="absolute top-2 right-2 bg-slate-900/90 text-white p-2 rounded-lg text-xs z-[1000] border border-slate-700 backdrop-blur shadow-lg">
                        <div className="font-bold text-slate-300 mb-1">MISSION HUD</div>
                        {routeDist !== null ? (
                          <>
                            <div>
                              Distance:{' '}
                              <span className="font-mono text-cyan-300">
                                {routeDist.toFixed(2)} km
                              </span>
                            </div>
                            <div>
                              ETA:{' '}
                              <span className="font-mono text-emerald-400">
                                {Math.ceil(routeEta!)} min
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-500">Calculating...</div>
                        )}
                      </div>
                      <button
                        className="absolute bottom-2 right-2 btn btn-xs btn-neutral z-[1000]"
                        onClick={() => setFollowing(!following)}
                      >
                        {following ? 'Free Pan' : 'Follow Me'}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <AlertCircle className="w-4 h-4 text-orange-400" />
                    <span>Status: {activeIncident.status || 'ASSIGNED'}</span>
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    {(!activeIncident.status ||
                      ['ASSIGNED', 'EN_ROUTE'].includes(activeIncident.status)) && (
                      <button
                        className="btn btn-warning w-full h-16 text-lg shadow-lg font-bold"
                        onClick={async () => {
                          try {
                            await syncResponderMissionStatus('EN_ROUTE');
                            setActiveIncident({ ...activeIncident, status: 'RESPONDING' });
                            setMessage('Mission started. Status synced with dispatch.');
                          } catch (err: any) {
                            setError(
                              err?.response?.data?.message ||
                                err?.message ||
                                'Failed to start mission.',
                            );
                          }
                        }}
                      >
                        <MapPin className="w-5 h-5" /> START MISSION
                      </button>
                    )}

                    {activeIncident.status === 'RESPONDING' && (
                      <button
                        className="btn btn-primary w-full h-16 text-lg shadow-lg font-bold"
                        disabled={!canResolve}
                        onClick={async () => {
                          try {
                            await syncResponderMissionStatus('ON_SCENE');
                            setActiveIncident({ ...activeIncident, status: 'ON_SCENE' });
                            setMessage('Status synced: On Scene');
                          } catch (err: any) {
                            setError(
                              err?.response?.data?.message ||
                                err?.message ||
                                'Failed to mark arrival.',
                            );
                          }
                        }}
                      >
                        <MapPin className="w-5 h-5" />
                        {canResolve
                          ? 'I HAVE ARRIVED'
                          : `ARRIVAL LOCKED (${Math.round(distToTarget * 1000)}m away)`}
                      </button>
                    )}

                    <div className="flex flex-col gap-2">
                      <button className="btn btn-outline btn-info w-full" onClick={openMaps}>
                        <Navigation2 className="w-4 h-4" /> Export to Google Maps
                      </button>

                      {activeIncident.status === 'ON_SCENE' && (
                        <div className="flex flex-col gap-3 mt-4 border-t border-slate-700 pt-4">
                          <div className="text-xs text-slate-400">Resolution & Evidence</div>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => setClosingPhoto(e.target.files?.[0] || null)}
                              className="file-input file-input-bordered file-input-sm file-input-success w-full"
                            />
                            {!closingPhoto && (
                              <Camera className="absolute right-3 top-2 w-4 h-4 text-slate-400 pointer-events-none" />
                            )}
                          </div>
                          <button
                            className="btn btn-success w-full h-14 font-bold"
                            disabled={!canResolve || !closingPhoto}
                            onClick={markResolved}
                          >
                            <CheckCircle className="w-5 h-5" />
                            {!canResolve
                              ? `GPS Lock Required (${Math.round(distToTarget * 1000)}m away)`
                              : !closingPhoto
                                ? 'RESOLUTION PHOTO REQUIRED'
                                : 'MARK AS RESOLVED'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500">No active assignment.</div>
              )}
            </div>
          </>
        )}
      </main>
      {token && activeIncident && (
        <TacticalChatDrawer
          open={chatOpen}
          loading={chatLoading}
          messages={chatMessages}
          currentUserId={user?.id}
          input={chatInput}
          onInputChange={setChatInput}
          onToggle={() => setChatOpen((prev) => !prev)}
          onSend={() => {
            void sendChatMessage();
          }}
          onQuickSend={(message) => {
            void sendChatMessage(message);
          }}
        />
      )}
    </div>
  );
};

export default App;
