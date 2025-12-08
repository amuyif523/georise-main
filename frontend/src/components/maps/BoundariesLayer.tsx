/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import api from "../../lib/api";

type BoundaryFeature = {
  gid: number;
  zone_name?: string;
  woreda_name?: string;
  geometry: string;
};

interface Props {
  level: "subcity" | "woreda";
  onSelect?: (id: number, props: { zone_name?: string; woreda_name?: string }) => void;
}

const BoundariesLayer: React.FC<Props> = ({ level, onSelect }) => {
  const [features, setFeatures] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/gis/boundaries?level=${level}`);
        const rows: BoundaryFeature[] = res.data || [];
        const geojson = {
          type: "FeatureCollection",
          features: rows.map((row) => ({
            type: "Feature",
            properties: {
              gid: row.gid,
              zone_name: row.zone_name,
              woreda_name: row.woreda_name,
            },
            geometry: row.geometry ? JSON.parse(row.geometry) : null,
          })),
        };
        setFeatures(geojson);
      } catch {
        setFeatures(null);
      }
    };
    load();
  }, [level]);

  if (!features) return null;

  return (
    <GeoJSON
      data={features as any}
      style={() => ({
        color: level === "woreda" ? "#f97316" : "#22d3ee",
        weight: 1,
        fillOpacity: 0.05,
      })}
      onEachFeature={(feature, layer) => {
        const props: any = feature.properties || {};
        const title = `${props.zone_name ?? ""} ${props.woreda_name ?? ""}`.trim();
        if (title) {
          layer.bindTooltip(title, { direction: "center" });
        }
        layer.on("click", () => {
          onSelect?.(props.gid, props);
        });
      }}
    />
  );
};

export default BoundariesLayer;
