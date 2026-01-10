import React, { useEffect, useState } from 'react';
import { Marker, Popup, TileLayer, MapContainer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import api from '../../lib/api';

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
}

type HeatmapPoint = {
  lat: number;
  lng: number;
  weight?: number;
};

const IncidentMap: React.FC<Props> = ({ historyMode }) => {
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
        const data = (res.data || []) as (IncidentPoint & { lon: number })[];
        // Map lon to lng for consistency
        setIncidents(data.map((i) => ({ ...i, lng: i.lon })));
      });
    }
  }, [historyMode]);

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

      {!historyMode &&
        incidents.map((i) => (
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
        clusters.map((c, idx) => (
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

const MapWrapper: React.FC<Props> = (props) => (
  <MapContainer
    center={[9.03, 38.75]}
    zoom={12}
    className="w-full h-full rounded-xl overflow-hidden"
  >
    <IncidentMap {...props} />
  </MapContainer>
);

export default MapWrapper;
