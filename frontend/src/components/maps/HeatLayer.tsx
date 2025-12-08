import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type * as L from "leaflet";
import "leaflet.heat";

export interface HeatPoint {
  lat: number;
  lng: number;
  severity: number;
}

interface Props {
  points: HeatPoint[];
  enabled?: boolean;
}

// Simple Leaflet heat layer wrapper
const HeatLayer: React.FC<Props> = ({ points, enabled = true }) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !points.length) return;
    // @ts-ignore leaflet.heat augments L
    const layer: L.Layer = (window as any).L.heatLayer(
      points.map((p) => [p.lat, p.lng, Math.max(0.1, Math.min(1, p.severity / 5))]),
      { radius: 30, blur: 20, maxZoom: 18 }
    );
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [enabled, points, map]);

  return null;
};

export default HeatLayer;
