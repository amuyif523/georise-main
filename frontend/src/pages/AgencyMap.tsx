import L from "leaflet";
import React, { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
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

const AgencyMap: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchIncidents = async () => {
    try {
      const res = await api.get("/incidents", {
        params: { status: "RECEIVED", hours: 48 },
      });
      setIncidents(res.data.incidents || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 10000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id: number, action: "assign" | "respond" | "resolve") => {
    try {
      setActionLoading(id);
      await api.patch(`/incidents/${id}/${action}`);
      await fetchIncidents();
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
                    className={`btn btn-xs btn-primary ${actionLoading === i.id ? "loading" : ""}`}
                    onClick={() => updateStatus(i.id, "respond")}
                  >
                    Responding
                  </button>
                  <button
                    className={`btn btn-xs btn-success ${actionLoading === i.id ? "loading" : ""}`}
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
      {loading && <div className="p-4 text-slate-300">Loading map…</div>}
      <MapContainer center={[9.03, 38.74]} zoom={12} className="w-full h-full">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MarkerClusterGroup chunkedLoading>{markers}</MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default AgencyMap;
