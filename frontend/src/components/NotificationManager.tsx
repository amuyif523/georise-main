import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
  };

  // Track location
  useEffect(() => {
    if (!user) return;

    const sendLocation = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      // Debounce or throttle could be good here, but for now we rely on watchPosition's behavior
      api.post('/users/location', { lat: latitude, lng: longitude }).catch(console.error);
    };

    if ('geolocation' in navigator) {
      // Send immediately
      navigator.geolocation.getCurrentPosition(sendLocation, console.error);

      // Watch for changes
      const watchId = navigator.geolocation.watchPosition(sendLocation, console.error, {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 27000,
      });
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [user]);

  // Register push notifications
  useEffect(() => {
    if (!user || !vapidKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const register = async () => {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
      if (Notification.permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      await api.post('/users/push/subscribe', { subscription: subscription.toJSON() });
    };

    register().catch((err) => console.error('Failed to register push', err));
  }, [user, vapidKey]);

  // Listen for alerts
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;

    interface AlertData {
      title: string;
      message: string;
    }

    const handleAlert = (data: AlertData) => {
      console.log('Received alert:', data);

      // Browser Notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.title, {
          body: data.message,
          icon: '/icons/alert.png', // Assuming icon exists or browser default
        });
      } else {
        // Fallback to alert
        alert(`Alert: ${data.title}\n${data.message}`);
      }
    };

    socket.on('alert:proximity', handleAlert);
    return () => {
      socket.off('alert:proximity', handleAlert);
    };
  }, [user]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return null;
};

export default NotificationManager;
