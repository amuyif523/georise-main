import React, { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, GeoJSON } from "react-leaflet";
import api from "../../lib/api";

type IncidentPoint = {
  id: number;
  title: string;
  category: string | null;
  severityscore?: number | null;
  severityScore?: number | null;
  lat: number;
  lon: number;
};

type Boundary = {
  id: number;
  geometry: any;
  name?: string;
  zone_name?: string;
  woreda_name?: string;
};

const IncidentMap: React.FC = () => {
  const [incidents, setIncidents] = useState<IncidentPoint[]>([]);
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);

  useEffect(() => {
    api.get("/gis/incidents").then((res) => setIncidents(res.data || []));
    api.get("/gis/boundaries").then((res) => setBoundaries(res.data || []));
  }, []);

  return (
    <MapContainer center={[9.03, 38.75]} zoom={12} className="w-full h-[calc(100vh-220px)] rounded-xl overflow-hidden">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      {boundaries.map((b) => (
        <GeoJSON
          key={b.id}
          data={typeof b.geometry === "string" ? JSON.parse(b.geometry) : b.geometry}
          style={{ color: "#38bdf8", weight: 1.5, fillOpacity: 0.05 }}
        />
      ))}

      {incidents.map((i) => (
        <Marker key={i.id} position={[i.lat, i.lon]}>
          <Popup>
            <strong>{i.title}</strong>
            <br />
            {i.category || "Uncategorized"}
            <br />
            Severity: {i.severityScore ?? i.severityscore ?? "?"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

export default IncidentMap;
