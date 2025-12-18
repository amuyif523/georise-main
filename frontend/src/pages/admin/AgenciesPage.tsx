/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup, GeoJSON } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import api from '../../lib/api';
import AppLayout from '../../layouts/AppLayout';

// Fix for leaflet draw icons
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

// Hack to fix missing icons in Leaflet
// @ts-expect-error - Leaflet prototype modification
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

type Agency = {
  id: number;
  name: string;
  type: string;
  city: string;
  description?: string | null;
  isApproved: boolean;
  isActive: boolean;
  boundary?: any;
};

const AgenciesPage: React.FC = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const fetchAll = async () => {
    try {
      const res = await api.get('/admin/agencies');
      setAgencies(res.data.agencies);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load agencies');
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencyDetails = async (id: number) => {
    try {
      const res = await api.get(`/admin/agencies/${id}`);
      setSelectedAgency(res.data.agency);
      // If there's a boundary, we might want to clear the draw layer or set it up
      // For now, we just display it using the GeoJSON component
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers();
      }
      setBoundaryGeoJSON(''); // Reset pending boundary
    } catch (err: any) {
      console.error('Failed to fetch agency details', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSelectAgency = (id: number) => {
    fetchAgencyDetails(id);
  };

  const approve = async (id: number) => {
    await api.patch(`/admin/agencies/${id}/approve`);
    fetchAll();
    if (selectedAgency?.id === id) {
      fetchAgencyDetails(id);
    }
  };

  const onCreated = (e: any) => {
    const layer = e.layer;
    const json = layer.toGeoJSON();

    // If we only want one polygon, we should clear others
    if (featureGroupRef.current) {
      const layers = featureGroupRef.current.getLayers();
      // Remove all layers except the one just created
      layers.forEach((l) => {
        if (l !== layer) {
          featureGroupRef.current?.removeLayer(l);
        }
      });
    }

    setBoundaryGeoJSON(JSON.stringify(json.geometry));
  };

  const onDeleted = () => {
    setBoundaryGeoJSON('');
  };

  const saveBoundary = async () => {
    if (!boundaryGeoJSON || !selectedAgency) return;
    try {
      await api.patch(`/admin/agencies/${selectedAgency.id}/boundary`, {
        geojson: boundaryGeoJSON,
      });
      // Refresh details to show the saved boundary
      fetchAgencyDetails(selectedAgency.id);
      alert('Boundary saved successfully!');
    } catch (err: any) {
      alert('Failed to save boundary: ' + (err?.response?.data?.message || err.message));
    }
  };

  return (
    <AppLayout>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      {loading ? (
        <div className="text-slate-300">Loading…</div>
      ) : (
        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-4">
          <div className="cyber-card h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Jurisdiction Editor</h2>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!selectedAgency || !boundaryGeoJSON}
                  onClick={saveBoundary}
                >
                  Save Boundary
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              {selectedAgency
                ? `Editing: ${selectedAgency.name}. Draw a polygon to set jurisdiction.`
                : 'Select an agency from the list to view or edit its jurisdiction.'}
            </p>
            <div className="flex-1 rounded-lg border border-slate-800 overflow-hidden relative">
              <MapContainer center={[9.03, 38.74]} zoom={12} className="w-full h-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* Display existing boundary if no new one is being drawn (or overlay it) */}
                {selectedAgency?.boundary && !boundaryGeoJSON && (
                  <GeoJSON
                    key={`boundary-${selectedAgency.id}`}
                    data={selectedAgency.boundary}
                    style={{ color: '#06b6d4', weight: 2, fillOpacity: 0.2 }}
                  />
                )}

                <FeatureGroup ref={featureGroupRef}>
                  <EditControl
                    position="topright"
                    onCreated={onCreated}
                    onDeleted={onDeleted}
                    draw={{
                      rectangle: false,
                      circle: false,
                      circlemarker: false,
                      marker: false,
                      polyline: false,
                      polygon: {
                        allowIntersection: false,
                        drawError: {
                          color: '#e1e100',
                          message: "<strong>Oh snap!<strong> you can't draw that!",
                        },
                        shapeOptions: {
                          color: '#06b6d4',
                        },
                      },
                    }}
                  />
                </FeatureGroup>
              </MapContainer>
            </div>
          </div>

          <div className="cyber-card h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Agencies</h2>
              <span className="text-xs text-slate-500">{agencies.length} found</span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-2">
              {agencies.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedAgency?.id === a.id
                      ? 'border-cyan-500 bg-cyan-950/30'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-600'
                  }`}
                  onClick={() => handleSelectAgency(a.id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{a.name}</p>
                      <p className="text-xs text-slate-400">
                        {a.type} • {a.city}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`badge badge-xs ${a.isActive ? 'badge-success' : 'badge-warning'}`}
                      >
                        {a.isActive ? 'Active' : 'Pending'}
                      </span>
                      {!a.isApproved && (
                        <button
                          className="btn btn-xs btn-outline btn-primary mt-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            approve(a.id);
                          }}
                        >
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
    </AppLayout>
  );
};

export default AgenciesPage;
