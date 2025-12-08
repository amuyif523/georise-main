/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable react-hooks/exhaustive-deps */
import L from "leaflet";
import "leaflet.heat";
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, GeoJSON } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import api from "../lib/api";
import { severityBadgeClass, severityLabel } from "../utils/severity";
import IncidentCard from "../components/incident/IncidentCard";
import IncidentDetailPane from "../components/incident/IncidentDetailPane";
import AppLayout from "../layouts/AppLayout";
import { getSocket } from "../lib/socket";
import BoundariesLayer from "../components/maps/BoundariesLayer";
import ClusterLayer from "../components/maps/ClusterLayer";

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
};

type HeatPoint = { lat: number; lng: number; weight: number | null };
type ClusterPoint = { id: number; cluster_id: number; lat: number; lng: number; severity: number; title?: string | null };
type ClusterPoint = { id: number; cluster_id: number; lat: number; lng: number; severity: number; title?: string | null };

const severityFill = (score: number | null | undefined) => {
  if (score == null) return "#94a3b8"; // slate
  if (score >= 5) return "#dc2626";
  if (score >= 4) return "#f97316";
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#06b6d4";
  return "#10b981";
};

const createIcon = (score: number | null | undefined) =>
  L.divIcon({
    className: "incident-marker",
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

const HeatmapLayer: React.FC<{ points: HeatPoint[]; enabled: boolean }> = ({
  points,
  enabled,
}) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || points.length === 0) return;
    // @ts-ignore leaflet.heat augments L
    const layer = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.weight ?? 1]),
      { radius: 20, blur: 15, maxZoom: 18 }
    );
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, enabled]);

  return null;
};

const AgencyMap: React.FC = () => {
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fallbackPoll, setFallbackPoll] = useState<NodeJS.Timeout | null>(null);
  const [subcityGeo, setSubcityGeo] = useState<any | null>(null);
  const [selectedSubCity, setSelectedSubCity] = useState<string>("");
  const [boundaryLevel, setBoundaryLevel] = useState<"subcity" | "woreda">("subcity");
  const [responders, setResponders] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setListLoading(true);
      const [incRes, heatRes, respRes, clusterRes] = await Promise.all([
        api.get("/incidents", {
          params: { status: "RECEIVED", hours },
        }),
        api.get("/analytics/heatmap", { params: { hours, minSeverity } }),
        api.get("/responders"),
        api.get("/analytics/clusters"),
      ]);
      let incs = incRes.data.incidents || [];
      if (selectedSubCity) {
        incs = incs.filter((i: any) => i.subCityId === Number(selectedSubCity));
      }
      setIncidents(incs);
      setHeatPoints(heatRes.data.points || heatRes.data || []);
      setClusterPoints(
        (clusterRes.data || []).map((c: any) => ({
          id: c.id || c.cluster_id || Math.random(),
          cluster_id: c.cluster_id ?? 0,
          lat: c.lat,
          lng: c.lng,
          severity: c.severity ?? 0,
          title: c.title ?? null,
        }))
      );
      setResponders(respRes.data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load incidents");
    } finally {
      setLoading(false);
      setListLoading(false);
    }
  };

  useEffect(() => {
    const loadGeo = async () => {
      try {
        const res = await api.get("/gis/subcities");
        setSubcityGeo(res.data);
      } catch {
        /* ignore */
      }
    };
    loadGeo();
    fetchData();
    const interval = setInterval(fetchData, 10000);
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
          prev.map((r) => (r.id === payload.responderId ? { ...r, latitude: payload.lat, longitude: payload.lng } : r))
        );
      };
      const responderAssigned = (payload: any) => {
        setIncidents((prev) =>
          prev.map((i) =>
            i.id === payload.incidentId ? { ...i, assignedResponderId: payload.responderId, status: "ASSIGNED" } : i
          )
        );
      };
      socket.on("incident:created", handlerCreated);
      socket.on("incident:updated", handlerUpdated);
      socket.on("responder:position", responderPos);
      socket.on("incident:assignedResponder", responderAssigned);
      socket.on("disconnect", () => {
        // fallback polling every 30s
        const t = setInterval(fetchData, 30000);
        setFallbackPoll(t as any);
      });
      socket.on("connect", () => {
        if (fallbackPoll) {
          clearInterval(fallbackPoll);
          setFallbackPoll(null);
        }
      });
      return () => {
        socket.off("incident:created", handlerCreated);
        socket.off("incident:updated", handlerUpdated);
        socket.off("responder:position", responderPos);
        socket.off("incident:assignedResponder", responderAssigned);
        socket.off("disconnect");
        socket.off("connect");
      };
    }
    return () => clearInterval(interval);
  }, [hours, minSeverity]);

  const updateStatus = async (id: number, action: "assign" | "respond" | "resolve") => {
    const confirmMsg =
      action === "assign"
        ? "Assign this incident to your agency?"
        : action === "respond"
          ? "Mark this incident as RESPONDING?"
          : "Mark this incident as RESOLVED?";
    if (!window.confirm(confirmMsg)) return;
    try {
      setActionLoading(id);
      await api.patch(`/incidents/${id}/${action}`);
      await fetchData();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update incident");
    } finally {
      setActionLoading(null);
    }
  };

  const markers = useMemo(
    () =>
      incidents
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => (
          <Marker
            key={i.id}
            position={[i.latitude as number, i.longitude as number]}
            icon={createIcon(i.severityScore)}
            eventHandlers={{ click: () => setSelectedId(i.id) }}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold">{i.title}</p>
                <p className="text-xs text-slate-500">
                  {new Date(i.createdAt).toLocaleString()}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Severity</span>
                  <span className={severityBadgeClass(i.severityScore)}>
                    {severityLabel(i.severityScore)}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Status: {i.status}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    className={`btn btn-xs ${actionLoading === i.id ? "loading" : ""}`}
                    onClick={() => updateStatus(i.id, "assign")}
                  >
                    Assign
                  </button>
                  <button
                    className={`btn btn-xs btn-primary ${
                      actionLoading === i.id ? "loading" : ""
                    }`}
                    onClick={() => updateStatus(i.id, "respond")}
                  >
                    Responding
                  </button>
                  <button
                    className={`btn btn-xs btn-success ${
                      actionLoading === i.id ? "loading" : ""
                    }`}
                    onClick={() => updateStatus(i.id, "resolve")}
                  >
                    Resolve
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )),
    [incidents, actionLoading]
  );

  const responderMarkers = useMemo(
    () =>
      responders
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => (
          <Marker
            key={`resp-${r.id}`}
            position={[r.latitude as number, r.longitude as number]}
            icon={L.divIcon({
              className: "responder-marker",
              html: `<div style="background:#22d3ee;width:14px;height:14px;border-radius:50%;box-shadow:0 0 12px #22d3ee80;border:2px solid #0f172a;"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <div className="text-sm space-y-1">
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-slate-500">{r.type}</p>
                <p className="text-xs">Status: {r.status}</p>
              </div>
            </Popup>
          </Marker>
        )),
    [responders]
  );

  const selectedIncident = incidents.find((i) => i.id === selectedId) || null;

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
          </select>
        </div>
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
      </div>
      {loading && <div className="p-4 text-slate-300">Loading map…</div>}
      <div className="grid lg:grid-cols-[2fr,1fr] h-[calc(100vh-140px)]">
        <MapContainer center={[9.03, 38.74]} zoom={12} className="w-full h-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {subcityGeo && (
            <GeoJSON
              data={subcityGeo}
              style={() => ({
                color: "#22d3ee",
                weight: 1,
                fillOpacity: 0.05,
              })}
            />
          )}
          <BoundariesLayer level={boundaryLevel} />
          <HeatmapLayer points={heatPoints} enabled={showHeat} />
          {showClusters && <ClusterLayer points={clusterPoints} enabled />}
          <MarkerClusterGroup chunkedLoading>
            {markers}
            {responderMarkers}
          </MarkerClusterGroup>
        </MapContainer>
        <div className="hidden lg:block border-l border-slate-800 bg-[#0D1117] p-3 overflow-y-auto">
          <div className="text-sm text-slate-300 mb-2">Live queue</div>
          <div className="space-y-2">
            {listLoading
              ? Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-slate-900 animate-pulse h-20" />
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
        onAssign={selectedIncident ? () => updateStatus(selectedIncident.id, "assign") : undefined}
        onRespond={selectedIncident ? () => updateStatus(selectedIncident.id, "respond") : undefined}
        onResolve={selectedIncident ? () => updateStatus(selectedIncident.id, "resolve") : undefined}
        responders={responders}
        onAssignResponder={
          selectedIncident
            ? async (responderId: number) => {
                try {
                  setActionLoading(selectedIncident.id);
                  await api.patch("/dispatch/assign-responder", {
                    incidentId: selectedIncident.id,
                    responderId,
                  });
                  await fetchData();
                } catch (err: any) {
                  setError(err?.response?.data?.message || "Failed to assign responder");
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
