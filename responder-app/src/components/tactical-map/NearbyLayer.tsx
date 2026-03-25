import React from 'react';
import { CircleMarker } from 'react-leaflet';

type NearbyResponder = {
  id: number;
  latitude: number;
  longitude: number;
  user?: { id: number; fullName?: string | null } | null;
};

type NearbyLayerProps = {
  nearbyResponders: NearbyResponder[];
  currentUserId?: number;
};

const NearbyLayer: React.FC<NearbyLayerProps> = ({ nearbyResponders, currentUserId }) => {
  return (
    <>
      {nearbyResponders
        .filter((responder) => responder.user?.id !== currentUserId)
        .map((responder) => (
          <CircleMarker
            key={responder.id}
            center={[responder.latitude, responder.longitude]}
            radius={5}
            pathOptions={{
              color: 'rgba(16, 185, 129, 0.55)',
              weight: 1,
              fillColor: 'rgba(16, 185, 129, 0.22)',
              fillOpacity: 0.8,
            }}
          />
        ))}
    </>
  );
};

export default NearbyLayer;
