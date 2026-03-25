import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import api from '../lib/api';
import { addLocationToQueue } from '../offline/responderLocationQueue';
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

export function useLocationTracker(currentStatus?: string) {
  const [coords, setCoords] = useState<{ lat: number; lng: number; heading?: number | null } | null>(null);
  const watchId = useRef<number | null>(null);
  const lastVisualCoords = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const lastEmitted = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const online = useNetworkStatus();

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      console.warn('Geolocation not supported');
      return;
    }

    const success = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      const now = Date.now();

      const lastVisual = lastVisualCoords.current;
      const visualDistance = lastVisual
        ? getDistanceFromLatLonInMeters(lastVisual.lat, lastVisual.lng, latitude, longitude)
        : Number.POSITIVE_INFINITY;
      const visualElapsed = lastVisual ? now - lastVisual.time : Number.POSITIVE_INFINITY;

      // Avoid repainting map position on tiny GPS jitter updates.
      if (!lastVisual || visualDistance > 8 || visualElapsed > 2000) {
        setCoords({
          lat: latitude,
          lng: longitude,
          heading: Number.isFinite(pos.coords.heading) ? pos.coords.heading : null,
        });
        lastVisualCoords.current = { lat: latitude, lng: longitude, time: now };
      }

      if (currentStatus === 'ON_SCENE') {
        return;
      }

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
        if (!online) {
          void addLocationToQueue(latitude, longitude, currentStatus);
          lastEmitted.current = { lat: latitude, lng: longitude, time: now };
          return;
        }

        const payload = {
          latitude,
          longitude,
          ...(currentStatus ? { status: currentStatus } : {}),
        };

        void api
          .patch('/responders/me/location', payload)
          .then(() => {
            const socket = getSocket();
            if (socket?.connected) {
              socket.emit('responder:locationUpdate', {
                lat: latitude,
                lng: longitude,
                ...(currentStatus ? { status: currentStatus } : {}),
              });
            }
            lastEmitted.current = { lat: latitude, lng: longitude, time: now };
          })
          .catch((err: any) => {
            const isNetworkFailure =
              !err?.response || err?.code === 'ERR_NETWORK' || /network/i.test(err?.message || '');
            if (isNetworkFailure) {
              console.warn('Location sync failed, queueing for retry', err);
              void addLocationToQueue(latitude, longitude, currentStatus);
              lastEmitted.current = { lat: latitude, lng: longitude, time: now };
              return;
            }

            console.warn('Location sync rejected without queue fallback', err);
          });
      }
    };

    const error = (err: GeolocationPositionError) => {
      console.error('Geo error:', err);
    };

    watchId.current = navigator.geolocation.watchPosition(success, error, {
      // Lower-power "good enough" lock first, then browser refines readings in background.
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 20000,
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [online, currentStatus]);

  return coords;
}
