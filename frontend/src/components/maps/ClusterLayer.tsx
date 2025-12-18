import { CircleMarker, Tooltip } from 'react-leaflet';

export interface ClusterPoint {
  id: number;
  lat: number;
  lng: number;
  cluster_id: number;
  title?: string;
  severity?: number;
}

interface Props {
  points: ClusterPoint[];
  enabled?: boolean;
}

const colors = ['#38bdf8', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#14b8a6'];

const ClusterLayer: React.FC<Props> = ({ points, enabled = true }) => {
  if (!enabled) return null;

  return (
    <>
      {points.map((p) => {
        const color = colors[p.cluster_id % colors.length];
        const radius = 8 + Math.min(6, p.severity ?? 0);
        return (
          <CircleMarker
            key={`${p.id}-${p.cluster_id}`}
            center={[p.lat, p.lng]}
            radius={radius}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.6, weight: 1 }}
          >
            <Tooltip direction="top" offset={[0, -radius]} opacity={0.9}>
              <div className="text-xs">
                <div className="font-semibold">Cluster {p.cluster_id}</div>
                {p.title && <div>{p.title}</div>}
                {p.severity !== undefined && <div>Severity: {p.severity}</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default ClusterLayer;
