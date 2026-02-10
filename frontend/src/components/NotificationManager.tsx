import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSocket } from '../lib/socket';
import api from '../lib/api';

const NotificationManager: React.FC = () => {
  const { user } = useAuth();
  // vapidKey and conversion logic moved to Context

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

  // Subscription logic moved to NotificationContext

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
    socket.on('notification:new', handleAlert);
    return () => {
      socket.off('alert:proximity', handleAlert);
      socket.off('notification:new', handleAlert);
    };
  }, [user]);

  // Request notification permission
  // Permission request logic moved to NotificationToggle/Context

  return null;
};

export default NotificationManager;
