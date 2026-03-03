import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import api from '../lib/api';

// Fix for default marker icons in Leaflet missing paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface IncidentMapProps {
  responderLat: number;
  responderLng: number;
  incidentLat?: number | null;
  incidentLng?: number | null;
  following: boolean;
  onRouteData?: (distanceKm: number, durationMin: number) => void;
}

const MapEffect: React.FC<{ responderLat: number; responderLng: number; following: boolean }> = ({
  responderLat,
  responderLng,
  following,
}) => {
  const map = useMap();
  useEffect(() => {
    if (following) {
      map.setView([responderLat, responderLng], 16, { animate: true });
    }
  }, [responderLat, responderLng, following, map]);
  return null;
};

const IncidentMap: React.FC<IncidentMapProps> = ({
  responderLat,
  responderLng,
  incidentLat,
  incidentLng,
  following,
  onRouteData,
}) => {
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);

  useEffect(() => {
    if (incidentLat && incidentLng) {
      // Calculate basic distance
      const from = turf.point([responderLng, responderLat]);
      const to = turf.point([incidentLng, incidentLat]);
      const dist = turf.distance(from, to, { units: 'kilometers' });

      // Fetch OSRM via backend
      api
        .get(
          `/gis/route?startLat=${responderLat}&startLon=${responderLng}&endLat=${incidentLat}&endLon=${incidentLng}`,
        )
        .then((res: any) => {
          if (res.data?.geometry) {
            setRouteGeoJSON(res.data.geometry);
          }
          if (onRouteData) {
            onRouteData(res.data?.distanceKm ?? dist, res.data?.durationMin ?? dist * 2); // default 30kph approximation
          }
        })
        .catch((err: any) => {
          console.error('Failed to fetch route:', err);
          if (onRouteData) onRouteData(dist, dist * 2);
        });
    }
  }, [responderLat, responderLng, incidentLat, incidentLng]);

  const mapCenter: [number, number] =
    incidentLat && incidentLng && !following
      ? [incidentLat, incidentLng]
      : [responderLat, responderLng];

  return (
    <MapContainer
      center={mapCenter}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <MapEffect responderLat={responderLat} responderLng={responderLng} following={following} />

      {/* Responder Marker */}
      <Marker
        position={[responderLat, responderLng]}
        icon={L.divIcon({
          className: 'responder-marker',
          html: `<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow: 0 0 10px #3b82f6;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        })}
      >
        <Popup>You</Popup>
      </Marker>

      {/* Incident Marker */}
      {incidentLat && incidentLng && (
        <Marker
          position={[incidentLat, incidentLng]}
          icon={L.divIcon({
            className: 'incident-marker',
            html: `<div style="background:#ef4444; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow: 0 0 15px #ef4444; animation: pulse 2s infinite;"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          })}
        >
          <Popup>Target</Popup>
        </Marker>
      )}

      {/* Route Line */}
      {routeGeoJSON && routeGeoJSON.coordinates && (
        <Polyline
          positions={routeGeoJSON.coordinates.map((c: [number, number]) => [c[1], c[0]])}
          pathOptions={{ color: '#3b82f6', weight: 5, dashArray: '10 5' }}
        />
      )}
    </MapContainer>
  );
};

export default IncidentMap;
