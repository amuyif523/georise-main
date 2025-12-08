import L from "leaflet";
import "leaflet.heat";
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import api from "../lib/api";
import { severityBadgeClass, severityLabel } from "../utils/severity";

type Incident = {
  id: number;
  title: string;
  category: string | null;
  severityScore: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

type HeatPoint = { lat: number; lng: number; weight: number | null };

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [hours, setHours] = useState(24);
  const [minSeverity, setMinSeverity] = useState(0);
  const [showHeat, setShowHeat] = useState(true);

  const fetchData = async () => {
    try {
      const [incRes, heatRes] = await Promise.all([
        api.get("/incidents", {
          params: { status: "RECEIVED", hours },
        }),
        api.get("/analytics/heatmap", { params: { hours, minSeverity } }),
      ]);
      setIncidents(incRes.data.incidents || []);
      setHeatPoints(heatRes.data.points || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
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

  return (
    <div className="h-screen bg-[#0A0F1A] text-slate-100">
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={showHeat}
            onChange={(e) => setShowHeat(e.target.checked)}
          />
          <span className="text-slate-400">Heatmap</span>
        </label>
      </div>
      {loading && <div className="p-4 text-slate-300">Loading map…</div>}
      <MapContainer center={[9.03, 38.74]} zoom={12} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <HeatmapLayer points={heatPoints} enabled={showHeat} />
        <MarkerClusterGroup chunkedLoading>{markers}</MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default AgencyMap;
