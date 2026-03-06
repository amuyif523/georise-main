/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable react-hooks/exhaustive-deps */
import L from 'leaflet';
import 'leaflet.heat';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, GeoJSON, Polyline } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import api from '../lib/api';
import { severityBadgeClass, severityLabel } from '../utils/severity';
import IncidentCard from '../components/incident/IncidentCard';
import IncidentDetailPane from '../components/incident/IncidentDetailPane';
import AppLayout from '../layouts/AppLayout';
import { getSocket } from '../lib/socket';
import BoundariesLayer from '../components/maps/BoundariesLayer';
import ClusterLayer from '../components/maps/ClusterLayer';

type Incident = {
  id: number;
  title: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  reviewStatus?: string;
  subCityId?: number | null;
  reporter?: {
    id: number;
    fullName: string;
    trustScore?: number | null;
  } | null;
  assignedResponderId?: number | null;
  acknowledgedAt?: string | null;
};

type HeatPoint = { lat: number; lng: number; weight: number | null };
type ClusterPoint = {
  id: number;
  cluster_id: number;
  lat: number;
  lng: number;
  severity: number;
  title?: string;
};

const severityFill = (score: number | null | undefined) => {
  if (score == null) return '#94a3b8'; // slate
  if (score >= 5) return '#dc2626';
  if (score >= 4) return '#f97316';
  if (score >= 3) return '#f59e0b';
  if (score >= 2) return '#06b6d4';
  return '#10b981';
};

const createIcon = (score: number | null | undefined) =>
  L.divIcon({
    className: 'incident-marker',
    html: `<div style="
      background:${severityFill(score)};
      width:18px;
      height:18px;
      border-radius:50%;
      box-shadow:0 0 10px ${severityFill(score)}80;
      border:2px solid #0f172a;
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

const HQIcon = L.divIcon({
  className: 'station-marker',
  html: `<div style="
    background: #0f172a;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 2px solid #3b82f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #3b82f6;
    font-size: 14px;
    font-weight: bold;
    box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
  ">HQ</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const HeatmapLayer: React.FC<{ points: HeatPoint[]; enabled: boolean }> = ({ points, enabled }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || points.length === 0) return;
    const safePoints = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (safePoints.length === 0) return;
    // @ts-ignore leaflet.heat augments L
    const layer = L.heatLayer(
      safePoints.map((p) => [p.lat, p.lng, p.weight ?? 1]),
      { radius: 20, blur: 15, maxZoom: 18 },
    );
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, enabled]);

  return null;
};

import { useAuth } from '../context/AuthContext';

const isValid = (lat: any, lng: any) =>
  !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng)) && lat !== null && lng !== null;

// Helper to fit bounds
const MapAutoFitter = ({ data }: { data: any }) => {
  const map = useMap();
  useEffect(() => {
    if (!data) return; // Null safety

    try {
      const layer = L.geoJSON(data);
      const bounds = layer.getBounds();

      // Validation: Ensure bounds are valid and not infinite
      if (bounds.isValid() && Object.keys(layer.getLayers()).length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        // Default to Addis Ababa if invalid polygon
        map.setView([9.03, 38.74], 12);
      }
    } catch (e) {
      console.warn('Failed to autofit bounds:', e);
      map.setView([9.03, 38.74], 12);
    }
  }, [data, map]);
  return null;
};

interface AgencyMapProps {
  historyMode?: boolean;
  jurisdiction?: any; // Task 3: Accept jurisdiction GeoJSON
}

const AgencyMap: React.FC<AgencyMapProps> = ({ historyMode = false, jurisdiction }) => {
  const { user } = useAuth();

  // Suppress unused warning effectively
  useEffect(() => {
    if (historyMode) console.log('Map in History Mode');
  }, [historyMode]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [heatPoints, setHeatPoints] = useState<HeatPoint[]>([]);
  const [clusterPoints, setClusterPoints] = useState<ClusterPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [hours, setHours] = useState(24);
  const [minSeverity, setMinSeverity] = useState(0);
  const [showHeat, setShowHeat] = useState(true);
  const [showClusters, setShowClusters] = useState(false);
  const [lowDataMode, setLowDataMode] = useState(
    () => localStorage.getItem('low_data_mode') === '1',
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackPoll, setFallbackPoll] = useState<ReturnType<typeof setInterval> | null>(null);
  const [subcityGeo, setSubcityGeo] = useState<any | null>(null);
  const [selectedSubCity, setSelectedSubCity] = useState<string>('');

  // Task 3: Default to 'agency' for AGENCY_STAFF and AGENCY_MANAGER to prevent 403s on load
  const [boundaryLevel, setBoundaryLevel] = useState<'subcity' | 'woreda' | 'agency'>(
    ['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string) ? 'agency' : 'subcity',
  );

  const [agencyProfile, setAgencyProfile] = useState<any>(null);
  const [isGisReady, setIsGisReady] = useState(false);

  console.log('[Forensics] User Role:', user?.role);
  console.log('[Forensics] Agency Data:', agencyProfile);
  console.log('[Forensics] Raw Coords:', {
    lat: agencyProfile?.centerLatitude,
    lng: agencyProfile?.centerLongitude,
  });

  const [responders, setResponders] = useState<any[]>([]); // Task 2: Ensure array init
  const [trajectories, setTrajectories] = useState<Record<number, [number, number][]>>({});

  // Deep-Trace Debugging
  useEffect(() => {
    incidents.forEach((i: any) => {
      if (
        typeof i.latitude !== 'number' ||
        typeof i.longitude !== 'number' ||
        !isFinite(i.latitude) ||
        !isFinite(i.longitude)
      ) {
        console.error('DEEP-TRACE Incident Invalid Coordinate:', i);
        console.error('Keys present:', Object.keys(i));
      }
    });
    responders.forEach((r: any) => {
      if (
        typeof r.latitude !== 'number' ||
        typeof r.longitude !== 'number' ||
        !isFinite(r.latitude) ||
        !isFinite(r.longitude)
      ) {
        console.error('DEEP-TRACE Responder Invalid Coordinate:', r);
        console.error('Keys present:', Object.keys(r));
      }
    });
  }, [incidents, responders]);

  const fetchData = useCallback(async () => {
    try {
      setListLoading(true);

      // Parallel fetches without failing the whole map if one fails
      const requests = [
        api.get('/incidents', { params: { status: 'RECEIVED', hours } }).catch((err) => {
          console.error('Failed to load incidents', err);
          return { data: { incidents: [] } };
        }),
        api.get('/analytics/heatmap', { params: { hours, minSeverity } }).catch((err) => {
          console.error('Failed to load heatmap', err);
          return { data: { points: [] } };
        }),
        api.get('/responders').catch((err) => {
          console.error('Failed to load responders', err);
          return { data: [] };
        }),
        api.get('/analytics/clusters').catch((err) => {
          console.error('Failed to load clusters', err);
          return { data: [] };
        }),
      ];

      const [incRes, heatRes, respRes, clusterRes] = await Promise.all(requests);

      let incs = incRes?.data?.incidents || [];
      if (selectedSubCity) {
        incs = incs.filter((i: any) => i.subCityId === Number(selectedSubCity));
      }
      setIncidents(incs);

      const rawHeat = heatRes?.data?.points || heatRes?.data || [];
      const filteredHeat = (rawHeat as any[]).filter(
        (p) => p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng),
      );
      setHeatPoints(filteredHeat as HeatPoint[]);

      setClusterPoints(
        (clusterRes?.data || []).map((c: any) => ({
          id: c.id || c.cluster_id || Math.random(),
          cluster_id: c.cluster_id ?? 0,
          lat: c.lat,
          lng: c.lng,
          severity: c.severity ?? 0,
          title: c.title ?? undefined,
        })),
      );

      const rawResps = respRes?.data;
      setResponders(Array.isArray(rawResps) ? rawResps : rawResps?.responders || []);

      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to update map features');
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  }, [hours, minSeverity, selectedSubCity]);

  useEffect(() => {
    const loadGeo = async () => {
      try {
        const res = await api.get('/gis/subcities');
        setSubcityGeo(res.data);
      } catch {
        /* ignore */
      }
    };
    const loadProfile = async () => {
      if (['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string)) {
        try {
          const res = await api.get('/agency/profile');
          if (res.data) {
            setAgencyProfile(res.data);
            const isValidData =
              !isNaN(parseFloat(res.data.centerLatitude)) &&
              !isNaN(parseFloat(res.data.centerLongitude));
            if (isValidData) {
              setIsGisReady(true);
            }
            console.log('[GIS Debug] Agency Profile Loaded:', res.data);
          }
        } catch {
          /* ignore */
        }
      }
    };
    loadGeo();
    loadProfile();
    fetchData();
    const interval = setInterval(fetchData, lowDataMode ? 30000 : 10000);
    const socket = getSocket();
    if (socket) {
      const handlerCreated = (inc: any) => {
        setIncidents((prev) => [inc, ...prev]);
      };
      const handlerUpdated = (inc: any) => {
        setIncidents((prev) => prev.map((p) => (p.id === inc.id ? inc : p)));
      };
      const responderPos = (payload: any) => {
        setResponders((prev) =>
          prev.map((r) =>
            r.id === payload.responderId
              ? {
                  ...r,
                  latitude: payload.lat,
                  longitude: payload.lng,
                  status: payload.status || r.status,
                }
              : r,
          ),
        );
        setTrajectories((prev) => {
          if (!isValid(payload.lat, payload.lng)) {
            return prev;
          }
          const currentPath = prev[payload.responderId] || [];
          const newPath = [...currentPath, [payload.lat, payload.lng] as [number, number]].slice(
            -10,
          );
          return { ...prev, [payload.responderId]: newPath };
        });
      };
      const responderAssigned = (payload: any) => {
        setIncidents((prev) =>
          prev.map((i) =>
            i.id === payload.incidentId
              ? { ...i, assignedResponderId: payload.responderId, status: 'ASSIGNED' }
              : i,
          ),
        );
        // Also update responder status locally if we have them
        setResponders((prev) =>
          prev.map((r) => (r.id === payload.responderId ? { ...r, status: 'ASSIGNED' } : r)),
        );
      };
      socket.on('incident:created', handlerCreated);
      socket.on('incident:updated', handlerUpdated);
      // FR-06: Listen for live location updates (Corrected event name)
      socket.on('responder:position', responderPos);
      socket.on('incident:assignedResponder', responderAssigned);
      socket.on('disconnect', () => {
        // fallback polling every 30s
        const t = setInterval(fetchData, 30000);
        setFallbackPoll(t as any);
      });
      socket.on('connect', () => {
        if (fallbackPoll) {
          clearInterval(fallbackPoll);
          setFallbackPoll(null);
        }
      });
      return () => {
        socket.off('incident:created', handlerCreated);
        socket.off('incident:updated', handlerUpdated);
        socket.off('responder:position', responderPos);
        socket.off('incident:assignedResponder', responderAssigned);
        socket.off('disconnect');
        socket.off('connect');
      };
    }
    return () => clearInterval(interval);
  }, [fetchData, lowDataMode]);

  const updateStatus = async (id: number, action: 'assign' | 'respond' | 'resolve') => {
    const confirmMsg =
      action === 'assign'
        ? 'Assign this incident to your agency?'
        : action === 'respond'
          ? 'Mark this incident as RESPONDING?'
          : 'Mark this incident as RESOLVED?';
    if (!window.confirm(confirmMsg)) return;
    try {
      setActionLoading(id);
      await api.patch(`/incidents/${id}/${action}`);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update incident');
    } finally {
      setActionLoading(null);
    }
  };

  const getResponderColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE':
        return '#10b981'; // emerald-500
      case 'ASSIGNED':
      case 'en_route': // backend might send lowercase or snake_case
      case 'EN_ROUTE':
      case 'ON_SCENE':
      case 'on_scene':
        return '#ef4444'; // red-500
      case 'OFFLINE':
        return '#64748b'; // slate-500
      default:
        return '#f59e0b'; // amber-500 (BUSY/unknown)
    }
  };

  const sanitizedIncidents = incidents.filter(
    (i) =>
      typeof i.latitude === 'number' && typeof i.longitude === 'number' && isFinite(i.latitude),
  );

  const sanitizedResponders = (Array.isArray(responders) ? responders : []).filter(
    (r) =>
      typeof r.latitude === 'number' && typeof r.longitude === 'number' && isFinite(r.latitude),
  );

  const markers = useMemo(
    () =>
      sanitizedIncidents.map((i) => (
        <Marker
          key={i.id}
          position={[i.latitude as number, i.longitude as number]}
          icon={createIcon(i.severityScore)}
          eventHandlers={{ click: () => setSelectedId(i.id) }}
        >
          <Popup>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{i.title}</p>
              <p className="text-xs text-slate-500">{new Date(i.createdAt).toLocaleString()}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Severity</span>
                <span className={severityBadgeClass(i.severityScore)}>
                  {severityLabel(i.severityScore)}
                </span>
              </div>
              <p className="text-xs text-slate-400">Status: {i.status}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  className={`btn btn-xs ${actionLoading === i.id ? 'loading' : ''}`}
                  onClick={() => updateStatus(i.id, 'assign')}
                >
                  Assign
                </button>
                <button
                  className={`btn btn-xs btn-primary ${actionLoading === i.id ? 'loading' : ''}`}
                  onClick={() => updateStatus(i.id, 'respond')}
                >
                  Responding
                </button>
                <button
                  className={`btn btn-xs btn-success ${actionLoading === i.id ? 'loading' : ''}`}
                  onClick={() => updateStatus(i.id, 'resolve')}
                >
                  Resolve
                </button>
              </div>
            </div>
          </Popup>
        </Marker>
      )),
    [incidents, actionLoading],
  );

  const responderMarkers = useMemo(() => {
    return sanitizedResponders.map((r) => {
      const color = getResponderColor(r.status);
      const isOffline = r.status === 'OFFLINE';
      const opacity = isOffline ? '0.4' : '1';
      return (
        <Marker
          key={`resp-${r.id}`}
          position={[r.latitude as number, r.longitude as number]}
          zIndexOffset={1000}
          icon={L.divIcon({
            className: 'responder-marker',
            html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;box-shadow:0 0 12px ${color}80;border:2px solid #0f172a;opacity:${opacity};"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })}
        >
          <Popup>
            <div className="text-sm space-y-1">
              <p className="font-semibold">{r.name}</p>
              <p className="text-xs text-slate-500">{r.type}</p>
              <p className="text-xs">
                Status: <span style={{ color }}>{r.status}</span>
              </p>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [responders]);

  const selectedIncident = incidents.find((i) => i.id === selectedId) || null;

  console.table({
    agencyProfile,
    incidentCount: incidents?.length,
    responderCount: responders?.length,
  });

  if (['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string) && !isGisReady) {
    console.error(
      `[GIS ERROR] Map Gate blocked render: Agency coords are [${agencyProfile?.centerLatitude}, ${agencyProfile?.centerLongitude}]`,
    );
    return (
      <AppLayout>
        <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white">
          📡 Initializing Command Center GIS...
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-full bg-[#0A0F1A] text-slate-100">
        {error && <div className="alert alert-error m-4 text-sm">{error}</div>}
        <div className="p-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Hours</span>
            <select
              className="select select-bordered select-xs bg-slate-900 text-white"
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            >
              {[1, 6, 12, 24, 48, 168].map((h) => (
                <option key={h} value={h}>
                  Last {h}h
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Min severity</span>
            <input
              type="range"
              min={0}
              max={5}
              value={minSeverity}
              onChange={(e) => setMinSeverity(Number(e.target.value))}
              className="range range-xs w-32"
            />
            <span className="badge badge-outline">{minSeverity}+</span>
          </div>

          {/* Task 3: Agency Admin UX - Locked Filters */}
          {!['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string) && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Sub-city</span>
                <select
                  className="select select-bordered select-xs bg-slate-900 text-white"
                  value={selectedSubCity}
                  onChange={(e) => setSelectedSubCity(e.target.value)}
                >
                  <option value="">All</option>
                  {subcityGeo?.features?.map((f: any) => (
                    <option key={f.properties.id} value={f.properties.id}>
                      {f.properties.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Boundary level</span>
                <select
                  className="select select-bordered select-xs bg-slate-900 text-white"
                  value={boundaryLevel}
                  onChange={(e) => setBoundaryLevel(e.target.value as any)}
                >
                  <option value="subcity">Subcity</option>
                  <option value="woreda">Woreda</option>
                  <option value="agency">Agency</option>
                </select>
              </div>
            </>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={showHeat}
              onChange={(e) => setShowHeat(e.target.checked)}
            />
            <span className="text-slate-400">Heatmap</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={showClusters}
              onChange={(e) => setShowClusters(e.target.checked)}
            />
            <span className="text-slate-400">Clusters</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={lowDataMode}
              onChange={(e) => {
                const next = e.target.checked;
                setLowDataMode(next);
                localStorage.setItem('low_data_mode', next ? '1' : '0');
                if (next) {
                  setShowHeat(false);
                  setShowClusters(false);
                }
              }}
            />
            <span className="text-slate-400">Low data</span>
          </label>
        </div>
        {loading && <div className="p-4 text-slate-300">Loading map…</div>}
        <div className="grid lg:grid-cols-[2fr,1fr] h-[calc(100vh-140px)]">
          <MapContainer
            center={[
              parseFloat(agencyProfile?.centerLatitude || '9.03'),
              parseFloat(agencyProfile?.centerLongitude || '38.74'),
            ]}
            zoom={12}
            className="w-full h-full"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {/* Agency Logic: Show specific agency polygon if available logic is handled by BoundariesLayer with 'agency' level, but simpler to just use it if user is restricted */}
            {['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string) ? (
              <>
                {/* Render the passed jurisdiction */}
                {jurisdiction && (
                  <GeoJSON
                    data={jurisdiction}
                    style={() => ({
                      color: '#3b82f6', // blue-500
                      weight: 2,
                      fillOpacity: 0.1,
                      dashArray: '5, 5',
                    })}
                  />
                )}
                {/* Auto-zoom safely inside a component or effect */}
                {jurisdiction && <MapAutoFitter data={jurisdiction} />}
              </>
            ) : (
              <>
                {subcityGeo && (
                  <GeoJSON
                    data={subcityGeo}
                    style={() => ({
                      color: '#22d3ee',
                      weight: 1,
                      fillOpacity: 0.05,
                    })}
                  />
                )}
                {/* Only show boundaries if explicitly selected, or handled by level */}
                <BoundariesLayer level={boundaryLevel} />
              </>
            )}
            <HeatmapLayer points={heatPoints} enabled={showHeat} />
            {showClusters && <ClusterLayer points={clusterPoints} enabled />}
            <MarkerClusterGroup chunkedLoading>
              {markers}
              {responderMarkers}
            </MarkerClusterGroup>
            {Object.entries(trajectories).map(([id, path]) => (
              <Polyline
                key={`trail-${id}`}
                positions={path.filter((p) => isValid(p[0], p[1]))}
                pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.4, dashArray: '1, 6' }}
              />
            ))}
            {['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(user?.role as string) &&
              agencyProfile?.centerLatitude != null &&
              agencyProfile?.centerLongitude != null && (
                <Marker
                  position={[
                    Number(agencyProfile.centerLatitude),
                    Number(agencyProfile.centerLongitude),
                  ]}
                  icon={HQIcon}
                  zIndexOffset={100}
                >
                  <Popup className="cyber-popup">
                    <div className="font-bold text-cyan-300 mb-1">{agencyProfile.name} HQ</div>
                    <div className="text-xs text-slate-300">Operational Base</div>
                  </Popup>
                </Marker>
              )}
          </MapContainer>
          <div className="hidden lg:block border-l border-slate-800 bg-[#0D1117] p-3 overflow-y-auto">
            <div className="text-sm text-slate-300 mb-2">Live queue</div>
            <div className="space-y-2">
              {listLoading
                ? Array.from({ length: 4 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-900 animate-pulse h-20"
                    />
                  ))
                : incidents.map((i) => (
                    <IncidentCard
                      key={i.id}
                      title={i.title}
                      category={i.category}
                      severity={i.severityScore}
                      status={i.status}
                      timestamp={i.createdAt}
                      onClick={() => setSelectedId(i.id)}
                    />
                  ))}
            </div>
          </div>
        </div>
        <IncidentDetailPane
          incident={selectedIncident}
          onClose={() => setSelectedId(null)}
          onAssign={
            selectedIncident ? () => updateStatus(selectedIncident.id, 'assign') : undefined
          }
          onRespond={
            selectedIncident ? () => updateStatus(selectedIncident.id, 'respond') : undefined
          }
          onResolve={
            selectedIncident ? () => updateStatus(selectedIncident.id, 'resolve') : undefined
          }
          responders={responders}
          onAssignResponder={
            selectedIncident
              ? async (responderId: number) => {
                  try {
                    setActionLoading(selectedIncident.id);
                    await api.patch(`/incidents/${selectedIncident.id}/assign`, {
                      assignedResponderId: responderId,
                    });
                    await fetchData();
                  } catch (err: any) {
                    setError(err?.response?.data?.message || 'Failed to assign responder');
                  } finally {
                    setActionLoading(null);
                  }
                }
              : undefined
          }
        />
      </div>
    </AppLayout>
  );
};

export default AgencyMap;
