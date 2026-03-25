import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import api from '../lib/api';

// Fix for default marker icons in Leaflet missing paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/assets/map/marker-icon-2x.png',
  iconUrl: '/assets/map/marker-icon.png',
  shadowUrl: '/assets/map/marker-shadow.png',
});

interface IncidentMapProps {
  responderLat: number;
  responderLng: number;
  visible?: boolean;
  fallbackLocation?: { lat: number; lng: number };
  incidentLat?: number | null;
  incidentLng?: number | null;
  incidentId?: number | null;
  currentUserId?: number;
  nearbyResponders?: Array<{
    id: number;
    name: string;
    status: string;
    latitude: number;
    longitude: number;
    user?: { id: number; fullName?: string | null } | null;
  }>;
  following: boolean;
  onRouteData?: (distanceKm: number, durationMin: number) => void;
  onOfflineReadyChange?: (ready: boolean) => void;
}

const MapEffect: React.FC<{ responderLat: number; responderLng: number; following: boolean }> = ({
  responderLat,
  responderLng,
  following,
}) => {
  const map = useMap();
  const lastMoveRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);

  useEffect(() => {
    if (following) {
      const now = Date.now();
      const elapsed = lastMoveRef.current ? now - lastMoveRef.current.ts : Number.POSITIVE_INFINITY;
      const shouldAnimate = elapsed > 1400;
      const currentZoom = map.getZoom();
      if (currentZoom < 16) {
        map.setView([responderLat, responderLng], 16, { animate: shouldAnimate });
      } else {
        map.panTo([responderLat, responderLng], { animate: shouldAnimate });
      }
      lastMoveRef.current = { lat: responderLat, lng: responderLng, ts: now };
    }
  }, [responderLat, responderLng, following, map]);
  return null;
};

const MapVisibilityEffect: React.FC<{ visible: boolean }> = ({ visible }) => {
  const map = useMap();

  useEffect(() => {
    if (!visible) return;

    const timeoutId = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [visible, map]);

  return null;
};

const IncidentMap: React.FC<IncidentMapProps> = ({
  responderLat,
  responderLng,
  visible = true,
  fallbackLocation,
  incidentLat,
  incidentLng,
  incidentId,
  currentUserId,
  nearbyResponders = [],
  following,
  onRouteData,
  onOfflineReadyChange,
}) => {
  const [routeGeoJSON, setRouteGeoJSON] = useState<any>(null);
  const lastRouteFetchRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const onRouteDataRef = useRef<typeof onRouteData | undefined>(undefined);

  useEffect(() => {
    onRouteDataRef.current = onRouteData;
  }, [onRouteData]);

  useEffect(() => {
    if (!incidentId || !incidentLat || !incidentLng) {
      onOfflineReadyChange?.(false);
      return;
    }

    onOfflineReadyChange?.(true);
  }, [incidentId, incidentLat, incidentLng, onOfflineReadyChange]);

  useEffect(() => {
    if (!incidentLat || !incidentLng) {
      routeAbortRef.current?.abort();
      routeAbortRef.current = null;
      setRouteGeoJSON(null);
      return;
    }

    const now = Date.now();
    const last = lastRouteFetchRef.current;
    if (last) {
      const movedMeters = turf.distance(
        turf.point([last.lng, last.lat]),
        turf.point([responderLng, responderLat]),
        { units: 'kilometers' },
      ) * 1000;
      const elapsedMs = now - last.ts;
      // Avoid rerouting on tiny movement bursts; keeps map rendering smooth.
      if (movedMeters < 30 && elapsedMs < 15000) {
        return;
      }
    }

    const from = turf.point([responderLng, responderLat]);
    const to = turf.point([incidentLng, incidentLat]);
    const dist = turf.distance(from, to, { units: 'kilometers' });

    routeAbortRef.current?.abort();
    const controller = new AbortController();
    routeAbortRef.current = controller;

    api
      .get(
        `/gis/route?startLat=${responderLat}&startLon=${responderLng}&endLat=${incidentLat}&endLon=${incidentLng}`,
        { signal: controller.signal },
      )
      .then((res: any) => {
        if (controller.signal.aborted) return;

        lastRouteFetchRef.current = { lat: responderLat, lng: responderLng, ts: now };
        setRouteGeoJSON(res.data?.geometry ?? null);
        if (onRouteDataRef.current) {
          onRouteDataRef.current(res.data?.distanceKm ?? dist, res.data?.durationMin ?? dist * 2);
        }
      })
      .catch((err: any) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return;
        }

        console.error('Failed to fetch route:', err);
        if (onRouteDataRef.current) onRouteDataRef.current(dist, dist * 2);
      });

    return () => {
      controller.abort();
      if (routeAbortRef.current === controller) {
        routeAbortRef.current = null;
      }
    };
  }, [responderLat, responderLng, incidentLat, incidentLng]);

  const initialCenterRef = useRef<[number, number] | null>(null);
  if (!initialCenterRef.current) {
    initialCenterRef.current =
      incidentLat && incidentLng && !following
        ? [incidentLat, incidentLng]
        : [fallbackLocation?.lat ?? responderLat, fallbackLocation?.lng ?? responderLng];
  }

  // Recenter baseline only when the assigned incident target changes.
  useEffect(() => {
    if (incidentLat && incidentLng && !following) {
      initialCenterRef.current = [incidentLat, incidentLng];
    }
  }, [incidentLat, incidentLng, following]);

  return (
    <MapContainer
      center={initialCenterRef.current}
      zoom={14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
        updateWhenIdle={true}
        keepBuffer={3}
      />
      <MapVisibilityEffect visible={visible} />
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

      {nearbyResponders
        .filter((responder) => responder.user?.id !== currentUserId)
        .map((responder) => (
          <Marker
            key={responder.id}
            position={[responder.latitude, responder.longitude]}
            icon={L.divIcon({
              className: 'backup-responder-marker',
              html: `<div style="background:#22c55e; width:14px; height:14px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px #22c55e;"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7],
            })}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{responder.name}</div>
                <div>Status: {responder.status}</div>
              </div>
            </Popup>
          </Marker>
        ))}

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

export default React.memo(IncidentMap);
