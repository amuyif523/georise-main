import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { addLocationToQueue, flushLocationQueue } from '../offline/responderLocationQueue';
import { useNetworkStatus } from './useNetworkStatus';

function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000;
}

export function useLocationTracker() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const lastEmitted = useRef<{ lat: number; lng: number; time: number } | null>(null);
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
      const now = Date.now();
      setCoords({ lat: latitude, lng: longitude });

      let shouldEmit = false;

      if (!lastEmitted.current) {
        shouldEmit = true;
      } else {
        const dist = getDistanceFromLatLonInMeters(
          lastEmitted.current.lat,
          lastEmitted.current.lng,
          latitude,
          longitude,
        );
        const timeElapsed = now - lastEmitted.current.time;

        // Condition: > 15m movement OR > 60s elapsed
        if (dist > 15 || timeElapsed > 60000) {
          shouldEmit = true;
        }
      }

      if (shouldEmit) {
        const socket = getSocket();

        // 1. WebSocket Emit (Realtime map update)
        if (online && socket?.connected) {
          socket.emit('responder:locationUpdate', { lat: latitude, lng: longitude });
          lastEmitted.current = { lat: latitude, lng: longitude, time: now };
        } else {
          addLocationToQueue(latitude, longitude);
        }

        // 2. Surgical Auth Fix (Direct database update)
        if (online) {
          import('axios').then((axiosModule) => {
            const axios = axiosModule.default;
            const token = localStorage.getItem('responder_token');
            const payload = { latitude, longitude, status: 'IDLE' }; // Will be overwritten by other states if active

            axios
              .patch(
                (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api') +
                  '/responders/me/location',
                payload,
                {
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                },
              )
              .catch((err) => console.warn('Axios location sync failed', err));
          });
        }
      }
    };

    const error = (err: GeolocationPositionError) => {
      console.error('Geo error:', err);
    };

    watchId.current = navigator.geolocation.watchPosition(success, error, {
      enableHighAccuracy: true,
      maximumAge: 5000, // Reduced age for fresher data
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
