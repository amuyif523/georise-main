import React, { useEffect, useState } from 'react';
import api from './lib/api';
import { connectSocket, disconnectSocket, getSocket } from './lib/socket';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useLocationTracker } from './hooks/useLocationTracker';
import NetworkBanner from './components/NetworkBanner';
import InstallAppBanner from './components/InstallAppBanner';
import LoginForm from './components/LoginForm';
import IncidentMap from './components/IncidentMap';
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
  latitude?: number | null;
  longitude?: number | null;
  status?: string;
};

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('responder_token'));
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const online = useNetworkStatus();
  const coords = useLocationTracker();

  const [routeDist, setRouteDist] = useState<number | null>(null);
  const [routeEta, setRouteEta] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const [closingPhoto, setClosingPhoto] = useState<File | null>(null);

  let distToTarget = Infinity;
  if (coords && activeIncident?.latitude && activeIncident?.longitude) {
    const from = turf.point([coords.lng, coords.lat]);
    const to = turf.point([activeIncident.longitude, activeIncident.latitude]);
    distToTarget = turf.distance(from, to, { units: 'kilometers' });
  }
  const canResolve = distToTarget <= 0.05; // 50 meters

  const handleLogin = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      const t = res.data.token;

      // Verify role
      if (res.data.user.role !== 'AGENCY_STAFF' && res.data.user.role !== 'ADMIN') {
        throw new Error('Unauthorized: Only agency staff can access this app.');
      }

      localStorage.setItem('responder_token', t);
      setToken(t);
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
    disconnectSocket();
    setToken(null);
    setActiveIncident(null);
  };

  useEffect(() => {
    if (token) {
      connectSocket(token);
    }
  }, [token]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onAssigned = (payload: any) => {
      setActiveIncident({
        id: payload.incidentId,
        title: payload.title,
        latitude: payload.latitude,
        longitude: payload.longitude,
        status: 'ASSIGNED',
      });
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
      setMessage('Incident marked resolved.');
      setClosingPhoto(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to resolve');
    }
  };

  if (!token) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

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

      <main className="flex-1 p-4 flex flex-col gap-4 max-w-md mx-auto w-full">
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
                          const socket = getSocket();
                          if (socket && coords) {
                            socket.emit('responder:locationUpdate', {
                              lat: coords.lat,
                              lng: coords.lng,
                              status: 'RESPONDING',
                            });
                            setActiveIncident({ ...activeIncident, status: 'RESPONDING' });
                            setMessage('Mission Started: Status is now RESPONDING');
                          }
                        }}
                      >
                        <MapPin className="w-5 h-5" /> START MISSION
                      </button>
                    )}

                    {activeIncident.status === 'RESPONDING' && (
                      <button
                        className="btn btn-primary w-full h-16 text-lg shadow-lg font-bold"
                        onClick={async () => {
                          const socket = getSocket();
                          if (socket && coords) {
                            socket.emit('responder:locationUpdate', {
                              lat: coords.lat,
                              lng: coords.lng,
                              status: 'ON_SCENE',
                            });
                            setActiveIncident({ ...activeIncident, status: 'ON_SCENE' });
                            setMessage('Status: On Scene');
                          }
                        }}
                      >
                        <MapPin className="w-5 h-5" /> I HAVE ARRIVED
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
                            disabled={!canResolve}
                            onClick={markResolved}
                          >
                            <CheckCircle className="w-5 h-5" />
                            {canResolve
                              ? 'MARK AS RESOLVED'
                              : `GPS Lock Required (${Math.round(distToTarget * 1000)}m away)`}
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
    </div>
  );
};

export default App;
