/* eslint-disable @typescript-eslint/no-explicit-any */
import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import api from "../../lib/api";
import { severityBadgeClass } from "../../utils/severity";

type Agency = {
  id: number;
  name: string;
  type: string;
  city: string;
  description?: string | null;
  isApproved: boolean;
  isActive: boolean;
};

const AgenciesPage: React.FC = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const fetchAll = async () => {
    try {
      const res = await api.get("/admin/agencies/pending");
      const metrics = await api.get("/admin/metrics/agencies");
      const pending: Agency[] = res.data.agencies || [];
      const fromMetrics: Agency[] = (metrics.data.agencies || []).map((m: any) => ({
        id: m.agencyId,
        name: m.name,
        type: m.type,
        city: "Addis",
        description: "",
        isApproved: m.isActive,
        isActive: m.isActive,
      }));
      // merge by id
      const merged: Agency[] = [...pending];
      fromMetrics.forEach((m) => {
        if (!merged.find((p) => p.id === m.id)) merged.push(m);
      });
      setAgencies(merged);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Failed to load agencies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const approve = async (id: number) => {
    if (!window.confirm("Approve and activate this agency?")) return;
    await api.patch(`/admin/agencies/${id}/approve`);
    fetchAll();
  };

  const saveBoundary = async () => {
    if (!selectedId || !boundaryGeoJSON) return;
    if (!window.confirm("Save this boundary for the selected agency?")) return;
    await api.patch(`/admin/agencies/${selectedId}/boundary`, { geojson: boundaryGeoJSON });
    setBoundaryGeoJSON("");
    setSelectedId(null);
    fetchAll();
  };

  const toggleStatus = async (id: number, isActive: boolean) => {
    if (!window.confirm(`${isActive ? "Deactivate" : "Activate"} this agency?`)) return;
    await api.patch(`/admin/agencies/${id}/status`, { isActive: !isActive });
    fetchAll();
  };

  const onCreated = (e: any, agencyId: number) => {
    const layer = e.layer;
    const geojson = layer.toGeoJSON();
    setSelectedId(agencyId);
    setBoundaryGeoJSON(JSON.stringify(geojson.geometry));
  };

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-slate-100 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-cyan-200">Admin control</p>
          <h1 className="text-3xl font-bold">Agencies</h1>
          <p className="text-slate-400 text-sm">Approve and manage jurisdiction boundaries.</p>
        </div>
      </div>

      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {agencies.map((a) => (
            <div key={a.id} className="p-4 rounded-xl border border-slate-800 bg-[#0D1117] shadow">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{a.name}</h3>
                  <p className="text-sm text-slate-400">
                    {a.type} in {a.city}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={severityBadgeClass(a.isApproved ? 1 : null)}>
                    {a.isApproved ? "Approved" : "Pending"}
                  </div>
                  <div className={`badge badge-xs ${a.isActive ? "badge-success" : "badge-ghost"}`}>
                    {a.isActive ? "Active" : "Disabled"}
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-300 mt-2">{a.description}</p>
              {!a.isApproved && (
                <button className="btn btn-primary btn-sm mt-3" onClick={() => approve(a.id)}>
                  Approve & Activate
                </button>
              )}
              {a.isApproved && (
                <button
                  className="btn btn-xs btn-outline mt-2"
                  onClick={() => toggleStatus(a.id, a.isActive)}
                >
                  {a.isActive ? "Disable agency" : "Activate agency"}
                </button>
              )}
              <div className="mt-3 space-y-2">
                <label className="text-xs text-slate-400">Draw boundary (polygon)</label>
                <div className="h-64 rounded-lg overflow-hidden border border-slate-800">
                  <MapContainer
                    center={[9.03, 38.74]}
                    zoom={12}
                    style={{ height: "100%", width: "100%" }}
                    whenCreated={(map) => (mapRef.current = map)}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <FeatureGroup>
                      <EditControl
                        position="topright"
                        draw={{
                          rectangle: false,
                          circle: false,
                          polyline: false,
                          marker: false,
                          circlemarker: false,
                        }}
                        onCreated={(e) => onCreated(e, a.id)}
                        edit={{ edit: false, remove: false }}
                      />
                    </FeatureGroup>
                  </MapContainer>
                </div>
                <textarea
                  className="textarea textarea-bordered w-full bg-slate-900 text-white"
                  rows={3}
                  value={selectedId === a.id ? boundaryGeoJSON : ""}
                  onChange={(e) => {
                    setSelectedId(a.id);
                    setBoundaryGeoJSON(e.target.value);
                  }}
                  placeholder='{"type":"Polygon","coordinates":[[...]]}'
                />
                <button
                  className="btn btn-outline btn-xs"
                  onClick={saveBoundary}
                  disabled={selectedId !== a.id || !boundaryGeoJSON}
                >
                  Save boundary
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgenciesPage;
