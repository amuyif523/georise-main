import { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';

type ResponderMarkerProps = {
  lat: number;
  lng: number;
  heading?: number | null;
};

const ResponderMarker: React.FC<ResponderMarkerProps> = ({ lat, lng, heading }) => {
  const icon = useMemo(() => {
    const rotation = Number.isFinite(heading) ? heading ?? 0 : 0;

    return L.divIcon({
      className: 'responder-gis-marker',
      html: `
        <div style="position:relative;width:42px;height:42px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:4px;border-radius:9999px;background:rgba(14,165,233,0.22);filter:blur(6px);"></div>
          <div style="position:absolute;width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid #f8fafc;box-shadow:0 0 14px rgba(14,165,233,0.55);"></div>
          <img src="/assets/map/responder-marker.svg" alt="" width="24" height="24" style="position:absolute;transform:rotate(${rotation}deg);transform-origin:50% 50%;" />
        </div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }, [heading]);

  return <Marker position={[lat, lng]} icon={icon} />;
};

export default ResponderMarker;
