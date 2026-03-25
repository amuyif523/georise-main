import { useEffect, useMemo, useRef, useState } from 'react';
import { Polyline } from 'react-leaflet';
import * as turf from '@turf/turf';
import api from '../../lib/api';

type Coords = { lat: number; lng: number };

type RoutingLayerProps = {
  responderCoords: Coords | null;
  incidentCoords: Coords | null;
  onRouteData?: (distanceKm: number, durationMin: number) => void;
};

const RoutingLayer: React.FC<RoutingLayerProps> = ({
  responderCoords,
  incidentCoords,
  onRouteData,
}) => {
  const [routeGeoJSON, setRouteGeoJSON] = useState<{ coordinates: [number, number][] } | null>(null);
  const lastRouteFetchRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const onRouteDataRef = useRef<typeof onRouteData | undefined>(undefined);

  useEffect(() => {
    onRouteDataRef.current = onRouteData;
  }, [onRouteData]);

  const fallbackDistance = useMemo(() => {
    if (!responderCoords || !incidentCoords) return null;

    return turf.distance(
      turf.point([responderCoords.lng, responderCoords.lat]),
      turf.point([incidentCoords.lng, incidentCoords.lat]),
      { units: 'kilometers' },
    );
  }, [incidentCoords, responderCoords]);

  const routePositions = useMemo(
    () => routeGeoJSON?.coordinates.map((point) => [point[1], point[0]] as [number, number]) ?? [],
    [routeGeoJSON],
  );

  useEffect(() => {
    if (!responderCoords || !incidentCoords || fallbackDistance === null) {
      setRouteGeoJSON(null);
      return;
    }

    const now = Date.now();
    const last = lastRouteFetchRef.current;
    if (last) {
      const movedMeters = turf.distance(
        turf.point([last.lng, last.lat]),
        turf.point([responderCoords.lng, responderCoords.lat]),
        { units: 'kilometers' },
      ) * 1000;
      const elapsedMs = now - last.ts;
      if (movedMeters < 30 && elapsedMs < 15000) {
        return;
      }
    }

    const controller = new AbortController();

    void api
      .get(
        `/gis/route?startLat=${responderCoords.lat}&startLon=${responderCoords.lng}&endLat=${incidentCoords.lat}&endLon=${incidentCoords.lng}`,
        { signal: controller.signal },
      )
      .then((res: any) => {
        if (controller.signal.aborted) return;

        lastRouteFetchRef.current = {
          lat: responderCoords.lat,
          lng: responderCoords.lng,
          ts: now,
        };
        setRouteGeoJSON(res.data?.geometry ?? null);
        onRouteDataRef.current?.(
          res.data?.distanceKm ?? fallbackDistance,
          res.data?.durationMin ?? fallbackDistance * 2,
        );
      })
      .catch((err: any) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return;
        }

        console.error('Failed to fetch route:', err);
        onRouteDataRef.current?.(fallbackDistance, fallbackDistance * 2);
      });

    return () => controller.abort();
  }, [fallbackDistance, incidentCoords, responderCoords]);

  if (!routePositions.length) return null;

  return (
    <Polyline
      positions={routePositions}
      pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 0.92 }}
    />
  );
};

export default RoutingLayer;
