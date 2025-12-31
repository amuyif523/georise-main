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
  responderStats?: {
    available: number;
    assigned: number;
    enRoute: number;
    onScene: number;
    offline: number;
    active: number;
  };
  activeIncidentCount?: number;
};

type ConfirmState = null | {
  agencyId: number;
  action: 'deactivate' | 'delete';
  next?: boolean;
};

const agencyTypes = [
  'POLICE',
  'FIRE',
  'MEDICAL',
  'TRAFFIC',
  'DISASTER',
  'ELECTRIC',
  'WATER',
  'ENVIRONMENT',
  'PUBLIC_HEALTH',
  'CONSTRUCTION',
  'ADMINISTRATION',
  'OTHER',
];

const badge = (text: string, tone: 'green' | 'gray' | 'yellow' | 'blue') => {
  const map: Record<string, string> = {
    green: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
    gray: 'bg-slate-700/40 text-slate-200 border-slate-500/40',
    yellow: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
    blue: 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30',
  };
  return <span className={`badge badge-sm border ${map[tone]}`}>{text}</span>;
};

const AgenciesPage: React.FC = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>(
    'all',
  );
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [form, setForm] = useState({
    name: '',
    city: '',
    type: 'POLICE',
    description: '',
    isApproved: false,
    isActive: false,
  });

  const [boundaryGeoJSON, setBoundaryGeoJSON] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/admin/agencies', {
        params: {
          page,
          limit,
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          type: typeFilter !== 'all' ? typeFilter : undefined,
        },
      });
      setAgencies(res.data.agencies || []);
      setTotal(res.data.total || 0);
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
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers();
      }
      setBoundaryGeoJSON('');
    } catch (err: any) {
      console.error('Failed to fetch agency details', err);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [page, limit, search, statusFilter, typeFilter]);

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

    if (featureGroupRef.current) {
      const layers = featureGroupRef.current.getLayers();
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
      fetchAgencyDetails(selectedAgency.id);
      alert('Boundary saved successfully!');
    } catch (err: any) {
      alert('Failed to save boundary: ' + (err?.response?.data?.message || err.message));
    }
  };

  const saveSelectedAgency = async () => {
    if (!selectedAgency) return;
    try {
      const payload = {
        name: selectedAgency.name,
        city: selectedAgency.city,
        type: selectedAgency.type,
        description: selectedAgency.description ?? '',
        isApproved: selectedAgency.isApproved,
        isActive: selectedAgency.isActive,
      };
      await api.patch(`/admin/agencies/${selectedAgency.id}`, payload);
      fetchAll();
      fetchAgencyDetails(selectedAgency.id);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update agency');
    }
  };

  const toggleActive = (agency: Agency, next: boolean) => {
    setConfirm({ agencyId: agency.id, action: 'deactivate', next });
  };

  const deleteAgency = (agency: Agency) => {
    setConfirm({ agencyId: agency.id, action: 'delete' });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const agencyId = confirm.agencyId;
    try {
      if (confirm.action === 'deactivate') {
        await api.patch(`/admin/agencies/${agencyId}/status`, { isActive: confirm.next });
      } else {
        await api.delete(`/admin/agencies/${agencyId}`);
      }
      if (selectedAgency?.id === agencyId) {
        fetchAgencyDetails(agencyId);
      }
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Action failed');
    } finally {
      setConfirm(null);
    }
  };

  const openCreate = () => {
    setForm({
      name: '',
      city: '',
      type: 'POLICE',
      description: '',
      isApproved: false,
      isActive: false,
    });
    setCreateModal(true);
  };

  const submitCreate = async () => {
    try {
      setCreating(true);
      await api.post('/admin/agencies', {
        ...form,
        description: form.description || undefined,
      });
      setCreateModal(false);
      fetchAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create agency');
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const listEmpty = !loading && agencies.length === 0;

  return (
    <AppLayout>
      {error && <div className="alert alert-error text-sm">{error}</div>}
      <div className="grid lg:grid-cols-[1.15fr,1fr] gap-4">
        <div className="cyber-card h-[78vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Jurisdiction Editor</h2>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-ghost" onClick={openCreate}>
                + New agency
              </button>
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
            {selectedAgency ? (
              <MapContainer center={[9.03, 38.74]} zoom={12} className="w-full h-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

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
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-400 text-sm">
                Pick an agency to edit its boundary.
              </div>
            )}
          </div>
          {selectedAgency && (
            <div className="mt-4 grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Name</label>
                <input
                  className="input input-sm input-bordered bg-slate-900 border-slate-700"
                  value={selectedAgency.name}
                  onChange={(e) =>
                    setSelectedAgency((prev) => (prev ? { ...prev, name: e.target.value } : prev))
                  }
                />
                <label className="text-xs text-slate-400">City</label>
                <input
                  className="input input-sm input-bordered bg-slate-900 border-slate-700"
                  value={selectedAgency.city}
                  onChange={(e) =>
                    setSelectedAgency((prev) => (prev ? { ...prev, city: e.target.value } : prev))
                  }
                />
                <label className="text-xs text-slate-400">Type</label>
                <select
                  className="select select-sm select-bordered bg-slate-900 border-slate-700"
                  value={selectedAgency.type}
                  onChange={(e) =>
                    setSelectedAgency((prev) => (prev ? { ...prev, type: e.target.value } : prev))
                  }
                >
                  {agencyTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Description</label>
                <textarea
                  className="textarea textarea-bordered bg-slate-900 border-slate-700 h-20"
                  value={selectedAgency.description ?? ''}
                  onChange={(e) =>
                    setSelectedAgency((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={selectedAgency.isApproved}
                    onChange={(e) =>
                      setSelectedAgency((prev) =>
                        prev ? { ...prev, isApproved: e.target.checked } : prev,
                      )
                    }
                  />
                  <span className="text-sm">Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="toggle toggle-info"
                    checked={selectedAgency.isActive}
                    onChange={(e) => toggleActive(selectedAgency, e.target.checked)}
                  />
                  <span className="text-sm">Active / Accepting dispatches</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-sm btn-primary" onClick={saveSelectedAgency}>
                    Save details
                  </button>
                  <button
                    className="btn btn-sm btn-outline btn-error"
                    onClick={() => deleteAgency(selectedAgency)}
                  >
                    Deactivate
                  </button>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <div>Responders active: {selectedAgency.responderStats?.active ?? 0}</div>
                  <div>Available: {selectedAgency.responderStats?.available ?? 0}</div>
                  <div>Active incidents: {selectedAgency.activeIncidentCount ?? 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="cyber-card h-[78vh] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="space-y-1">
              <h2 className="font-semibold">Agencies</h2>
              <p className="text-xs text-slate-400">
                Manage approval, availability, and assignments.
              </p>
            </div>
            <span className="text-xs text-slate-500">{total} total</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              className="input input-sm input-bordered bg-slate-900 border-slate-700"
              placeholder="Search by name or city"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <select
              className="select select-sm select-bordered bg-slate-900 border-slate-700"
              value={statusFilter}
              onChange={(e) => {
                setPage(1);
                setStatusFilter(e.target.value as any);
              }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending approval</option>
            </select>
            <select
              className="select select-sm select-bordered bg-slate-900 border-slate-700"
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
            >
              <option value="all">All types</option>
              {agencyTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="btn btn-sm btn-outline" onClick={openCreate}>
              + Create
            </button>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Loading...
            </div>
          ) : listEmpty ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm">
              <p>No agencies match these filters.</p>
              <button className="btn btn-sm btn-primary mt-2" onClick={openCreate}>
                Add first agency
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-2">
              <table className="table table-sm text-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>City</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Responders</th>
                    <th>Incidents</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {agencies.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-900/60">
                      <td
                        className="font-semibold cursor-pointer"
                        onClick={() => handleSelectAgency(a.id)}
                      >
                        {a.name}
                      </td>
                      <td>{a.city}</td>
                      <td>{a.type}</td>
                      <td className="space-x-1">
                        {badge(
                          a.isApproved ? 'Approved' : 'Pending',
                          a.isApproved ? 'green' : 'yellow',
                        )}
                        {badge(a.isActive ? 'Active' : 'Inactive', a.isActive ? 'blue' : 'gray')}
                      </td>
                      <td className="text-xs space-y-1">
                        <div>Active: {a.responderStats?.active ?? 0}</div>
                        <div>Available: {a.responderStats?.available ?? 0}</div>
                      </td>
                      <td>{a.activeIncidentCount ?? 0}</td>
                      <td className="flex items-center gap-2">
                        {!a.isApproved && (
                          <button
                            className="btn btn-xs btn-outline btn-primary"
                            onClick={() => approve(a.id)}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={() => toggleActive(a, !a.isActive)}
                        >
                          {a.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={() => deleteAgency(a)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-xs"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </button>
              <button
                className="btn btn-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>

      {createModal && (
        <div className="modal modal-open">
          <div className="modal-box bg-slate-900 border border-slate-700">
            <h3 className="font-semibold mb-2">Create agency</h3>
            <div className="space-y-3">
              <input
                className="input input-bordered w-full bg-slate-800 border-slate-700"
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input input-bordered bg-slate-800 border-slate-700"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                />
                <select
                  className="select select-bordered bg-slate-800 border-slate-700"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                >
                  {agencyTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                className="textarea textarea-bordered w-full bg-slate-800 border-slate-700"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="toggle toggle-success"
                    checked={form.isApproved}
                    onChange={(e) => setForm((p) => ({ ...p, isApproved: e.target.checked }))}
                  />
                  Approved
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="toggle toggle-info"
                    checked={form.isActive}
                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={submitCreate} disabled={creating}>
                {creating ? 'Saving...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal modal-open">
          <div className="modal-box bg-slate-900 border border-slate-700">
            <h3 className="font-semibold mb-2">
              {confirm.action === 'delete' ? 'Deactivate agency' : 'Change availability'}
            </h3>
            <p className="text-sm text-slate-300">
              {confirm.action === 'delete'
                ? 'This will mark the agency as inactive. Active assignments must be cleared first.'
                : confirm.next
                  ? 'Activate this agency to receive dispatches?'
                  : 'Deactivate this agency? Active assignments must be reassigned first.'}
            </p>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirm}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default AgenciesPage;
