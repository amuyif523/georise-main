import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

type IncidentLayerProps = {
  lat: number;
  lng: number;
};

const IncidentLayer: React.FC<IncidentLayerProps> = ({ lat, lng }) => {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'incident-emergency-marker',
        html: `
          <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:48px;height:48px;border-radius:9999px;background:rgba(239,68,68,0.15);animation:pulse 1.8s ease-out infinite;"></div>
            <div style="position:absolute;width:34px;height:34px;border-radius:9999px;background:rgba(239,68,68,0.22);animation:pulse 1.8s ease-out infinite 0.3s;"></div>
            <div style="position:absolute;width:18px;height:18px;border-radius:9999px;background:#ef4444;border:3px solid #fff7ed;box-shadow:0 0 18px rgba(239,68,68,0.7);"></div>
          </div>
        `,
        iconSize: [56, 56],
        iconAnchor: [28, 28],
      }),
    [],
  );

  return <Marker position={[lat, lng]} icon={icon} />;
};

export default IncidentLayer;
