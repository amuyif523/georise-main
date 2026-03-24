import React, { useEffect, useState } from 'react';
import { Marker, Popup, TileLayer, MapContainer, useMap, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type IncidentPoint = {
  id: number;
  title: string;
  category: string | null;
  severityScore?: number | null;
  lat: number;
  lng: number;
};

type ClusterPoint = {
  id: number;
  cluster_id: number;
  lat: number;
  lng: number;
  severity: number;
};

interface Props {
  historyMode?: boolean;
  jurisdiction?: any;
  center?: { lat: number; lng: number } | null;
}

type HeatmapPoint = {
  lat: number;
  lng: number;
  weight?: number;
};

const IncidentMap: React.FC<Props> = ({ historyMode, jurisdiction }) => {
  const [incidents, setIncidents] = useState<IncidentPoint[]>([]);
  const [clusters, setClusters] = useState<ClusterPoint[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const map = useMap();

  useEffect(() => {
    if (historyMode) {
      api.get('/analytics/clusters').then((res) => setClusters(res.data || []));
      api.get('/analytics/heatmap', { params: { hours: 720 } }).then((res) => {
        setHeatmapPoints(res.data || []);
      });
    } else {
      api.get('/gis/incidents').then((res) => {
        const data = res.data || [];

        // Only show RECEIVED or ACTIVE incidents to prevent map clutter
        const activeIncidents = data.filter(
          (i: any) => i.status === 'RECEIVED' || i.status === 'ACTIVE',
        );

        setIncidents(
          activeIncidents.map((i: any) => ({
            ...i,
            lat: Number(i.latitude || i.lat),
            lng: Number(i.longitude || i.lon || i.lng),
          })),
        );
      });
    }
  }, [historyMode]);

  // Auto-fit bounds when jurisdiction changes
  useEffect(() => {
    if (jurisdiction) {
      try {
        const layer = L.geoJSON(jurisdiction);
        const bounds = layer.getBounds();
        if (bounds.isValid() && Object.keys(layer.getLayers()).length > 0) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        } else {
          // Default view if invalid
          map.setView([9.03, 38.74], 12);
        }
      } catch (e) {
        console.warn('Failed to fit bounds:', e);
        map.setView([9.03, 38.74], 12);
      }
    }
  }, [jurisdiction, map]);

  useEffect(() => {
    if (historyMode && heatmapPoints.length > 0) {
      // @ts-expect-error - L.heatLayer might not be in the typings
      const heat = L.heatLayer(
        heatmapPoints.map((p) => [p.lat, p.lng, p.weight ?? 1]),
        { radius: 25, blur: 15, maxZoom: 17 },
      ).addTo(map);
      return () => {
        map.removeLayer(heat);
      };
    }
  }, [historyMode, heatmapPoints, map]);

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

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

      {!historyMode &&
        incidents
          .filter(
            (i) =>
              typeof i.lat === 'number' &&
              isFinite(i.lat) &&
              typeof i.lng === 'number' &&
              isFinite(i.lng),
          )
          .map((i) => (
            <Marker
              key={i.id}
              position={[i.lat, i.lng]}
              icon={L.divIcon({
                className: 'custom-marker',
                html: `<div style="background:${
                  (i.severityScore || 0) >= 4 ? '#ef4444' : '#3b82f6'
                }; width:12px; height:12px; border-radius:50%; border:2px solid white;"></div>`,
              })}
            >
              <Popup>
                <strong>{i.title}</strong>
                <br />
                Severity: {i.severityScore ?? '?'}
              </Popup>
            </Marker>
          ))}

      {historyMode &&
        clusters
          .filter(
            (c) =>
              typeof c.lat === 'number' &&
              isFinite(c.lat) &&
              typeof c.lng === 'number' &&
              isFinite(c.lng),
          )
          .map((c, idx) => (
            <Marker
              key={idx}
              position={[c.lat, c.lng]}
              icon={L.divIcon({
                className: 'cluster-point',
                html: `<div style="background:rgba(234, 179, 8, 0.4); border: 2px solid #eab308; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">C-${c.cluster_id}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup>
                <strong>Hotspot Cluster #{c.cluster_id}</strong>
                <br />
                Predictive risk factor based on historical density.
              </Popup>
            </Marker>
          ))}
    </>
  );
};

const MapWrapper: React.FC<Props> = (props) => {
  const { user } = useAuth();
  const userRole = (user as any)?.role;
  const overrideCenter = props.center;

  const rawLat = (user as any)?.agencyStaff?.agency?.centerLatitude;
  const rawLng = (user as any)?.agencyStaff?.agency?.centerLongitude;

  const isCitizen = userRole === 'CITIZEN';
  const safeLat = overrideCenter?.lat ?? (isCitizen ? 9.0197 : Number(rawLat) || 9.0197);
  const safeLng = overrideCenter?.lng ?? (isCitizen ? 38.7525 : Number(rawLng) || 38.7525);

  const isDataValid =
    Boolean(overrideCenter) ||
    (!isNaN(Number(rawLat)) && rawLat !== null && typeof rawLat !== 'undefined');
  const isAgencyRole = ['AGENCY_STAFF', 'AGENCY_MANAGER'].includes(userRole);

  if (isAgencyRole && !isDataValid) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-900 text-slate-400 rounded-xl">
        📡 Synchronizing GIS Anchor...
      </div>
    );
  }

  return (
    <MapContainer
      center={[safeLat, safeLng]}
      zoom={12}
      className="w-full h-full rounded-xl overflow-hidden"
    >
      <IncidentMap {...props} />
    </MapContainer>
  );
};

export default MapWrapper;
