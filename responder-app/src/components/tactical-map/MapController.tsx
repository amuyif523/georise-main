import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

type Coords = { lat: number; lng: number };

type MapControllerProps = {
  responderCoords: Coords | null;
  incidentCoords: Coords | null;
  following: boolean;
  visible: boolean;
  recenterToken: number;
  finalReportVisible?: boolean;
};

const MapController: React.FC<MapControllerProps> = ({
  responderCoords,
  incidentCoords,
  following,
  visible,
  recenterToken,
  finalReportVisible = false,
}) => {
  const map = useMap();
  const lastIncidentRef = useRef<string | null>(null);
  const lastReportFocusRef = useRef<string | null>(null);
  const hasValidCoords = (coords: Coords | null) =>
    Boolean(
      coords &&
        typeof coords.lat === 'number' &&
        typeof coords.lng === 'number' &&
        !Number.isNaN(coords.lat) &&
        !Number.isNaN(coords.lng),
    );
  const isMapReady = () => {
    try {
      const center = map.getCenter();
      const zoom = map.getZoom();
      return (
        center != null &&
        Number.isFinite(center.lat) &&
        Number.isFinite(center.lng) &&
        Number.isFinite(zoom)
      );
    } catch (_err) {
      return false;
    }
  };

  const bounds = useMemo(() => {
    if (!hasValidCoords(responderCoords) || !hasValidCoords(incidentCoords)) return null;
    const responder: Coords = { lat: responderCoords!.lat, lng: responderCoords!.lng };
    const incident: Coords = { lat: incidentCoords!.lat, lng: incidentCoords!.lng };
    return L.latLngBounds(
      [responder.lat, responder.lng],
      [incident.lat, incident.lng],
    );
  }, [incidentCoords, responderCoords]);

  const reportViewportOffset = useMemo(() => {
    const zoom = map.getZoom();
    const size = map.getSize();
    if (
      !Number.isFinite(zoom) ||
      !size ||
      !Number.isFinite(size.y) ||
      size.y <= 0
    ) {
      return 0;
    }
    return size.y * 0.2;
  }, [finalReportVisible, map, visible]);

  useEffect(() => {
    if (!visible) return;
    const timeoutId = window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
    return () => window.clearTimeout(timeoutId);
  }, [visible, map]);

  useEffect(() => {
    if (!visible || !bounds || !incidentCoords) return;
    if (!hasValidCoords(incidentCoords)) {
      console.warn('MapController skipped fitBounds due to invalid incident coordinates', incidentCoords);
      return;
    }
    if (!isMapReady()) {
      console.warn('MapController skipped fitBounds because map is not ready');
      return;
    }
    const incidentKey = `${incidentCoords.lat}:${incidentCoords.lng}`;
    if (lastIncidentRef.current === incidentKey) return;

    map.fitBounds(bounds, {
      animate: true,
      duration: 1.5,
      padding: [48, 48],
      maxZoom: 16,
    });
    lastIncidentRef.current = incidentKey;
  }, [bounds, incidentCoords, map, visible]);

  useEffect(() => {
    if (!visible || !responderCoords || !following) return;
    if (!hasValidCoords(responderCoords)) {
      console.warn('MapController skipped panTo due to invalid responder coordinates', responderCoords);
      return;
    }
    if (!isMapReady()) {
      console.warn('MapController skipped panTo because map is not ready');
      return;
    }
    map.panTo([responderCoords.lat, responderCoords.lng], {
      animate: true,
      duration: 1.5,
    });
  }, [following, map, recenterToken, responderCoords, visible]);

  useEffect(() => {
    if (!visible || !finalReportVisible || !incidentCoords) return;
    if (!hasValidCoords(incidentCoords)) {
      console.warn('MapController skipped final-report flyTo due to invalid incident coordinates', incidentCoords);
      return;
    }
    if (!isMapReady()) {
      console.warn('MapController skipped final-report flyTo because map is not ready');
      return;
    }

    const reportFocusKey = `${incidentCoords.lat}:${incidentCoords.lng}:${finalReportVisible}`;
    if (lastReportFocusRef.current === reportFocusKey) return;

    const timeoutId = window.setTimeout(() => {
      if (!isMapReady()) {
        console.warn('MapController skipped final-report flyTo after invalidateSize because map is still not ready');
        return;
      }

      const currentZoom = map.getZoom();
      if (!Number.isFinite(currentZoom)) {
        console.warn('MapController skipped final-report flyTo because map zoom is not ready');
        return;
      }

      const size = map.getSize();
      const rawLat = incidentCoords.lat;
      const rawLng = incidentCoords.lng;
      let finalLat = rawLat;
      let finalLng = rawLng;

      if (Number.isFinite(size.y) && size.y > 0 && reportViewportOffset > 0) {
        const incidentPoint = map.project([rawLat, rawLng], currentZoom);
        if (!Number.isFinite(incidentPoint.x) || !Number.isFinite(incidentPoint.y)) {
          console.warn('MapController skipped final-report flyTo because projected incident point is invalid');
          return;
        }

        const shiftedCenter = map.unproject(
          L.point(incidentPoint.x, incidentPoint.y + reportViewportOffset),
          currentZoom,
        );
        finalLat = shiftedCenter.lat;
        finalLng = shiftedCenter.lng;
      }

      if (!Number.isFinite(finalLat) || !Number.isFinite(finalLng)) {
        console.error('MapController: Prevented NaN flight');
        return;
      }

      try {
        map.flyTo([finalLat, finalLng], Math.max(currentZoom, 16), {
          animate: true,
          duration: 1.2,
        });
        lastReportFocusRef.current = reportFocusKey;
      } catch (_err) {
        console.warn('MapController suppressed Leaflet flight error during final-report transition');
      }
    }, 240);

    return () => window.clearTimeout(timeoutId);
  }, [finalReportVisible, incidentCoords, map, reportViewportOffset, visible]);

  return null;
};

export default MapController;
