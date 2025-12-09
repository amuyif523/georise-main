/* eslint-disable @typescript-eslint/no-explicit-any */
import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import api from "../../lib/api";
import PageWrapper from "../../components/layout/PageWrapper";

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
      setAgencies([...pending, ...fromMetrics]);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load agencies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const approve = async (id: number) => {
    await api.patch(`/admin/agencies/${id}/approve`);
    fetchAll();
  };

  const onCreated = (e: any) => {
    const json = e.layer.toGeoJSON();
    setBoundaryGeoJSON(JSON.stringify(json.geometry));
    setSelectedId(null);
  };

  const saveBoundary = async () => {
    if (!boundaryGeoJSON || !selectedId) return;
    await api.patch(`/admin/agencies/${selectedId}/boundary`, { geojson: boundaryGeoJSON });
    setBoundaryGeoJSON("");
    setSelectedId(null);
  };

  return (
    <PageWrapper title="Agencies">
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-4">
          <div className="cyber-card h-[65vh]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Jurisdiction editor</h2>
              <button className="btn btn-sm" disabled={!selectedId || !boundaryGeoJSON} onClick={saveBoundary}>
                Save boundary
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">Draw polygon for agency jurisdiction.</p>
            <MapContainer
              center={[9.03, 38.74]}
              zoom={12}
              className="w-full h-full rounded-lg border border-slate-800 overflow-hidden"
              whenCreated={(map) => (mapRef.current = map)}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <FeatureGroup>
                <EditControl
                  position="topright"
                  draw={{ rectangle: false, circle: false, circlemarker: false, marker: false, polyline: false }}
                  onCreated={onCreated}
                />
              </FeatureGroup>
            </MapContainer>
          </div>

          <div className="cyber-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Agencies</h2>
            </div>
            <div className="space-y-2 max-h-[65vh] overflow-auto">
              {agencies.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border ${selectedId === a.id ? "border-cyan-500" : "border-slate-800"} bg-slate-900/60`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.type}</p>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge badge-xs">{a.isActive ? "Active" : "Pending"}</span>
                      <button className="btn btn-xs btn-outline" onClick={() => setSelectedId(a.id)}>
                        Select boundary
                      </button>
                      {!a.isApproved && (
                        <button className="btn btn-xs btn-primary" onClick={() => approve(a.id)}>
                          Approve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
};

export default AgenciesPage;
