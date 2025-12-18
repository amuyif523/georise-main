import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { addLocationToQueue, flushLocationQueue } from '../offline/responderLocationQueue';
import { useNetworkStatus } from './useNetworkStatus';

export function useLocationTracker() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const online = useNetworkStatus();

  useEffect(() => {
    if (online) {
      flushLocationQueue().catch((err) => console.error('Failed to flush location queue', err));
    }
  }, [online]);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported');
      return;
    }

    const success = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      setCoords({ lat: latitude, lng: longitude });
      const socket = getSocket();
      if (online && socket?.connected) {
        socket.emit('responder:locationUpdate', { lat: latitude, lng: longitude });
      } else {
        addLocationToQueue(latitude, longitude);
      }
    };

    const error = (err: GeolocationPositionError) => {
      console.error('Geo error:', err);
    };

    watchId.current = navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [online]);

  return coords;
}
