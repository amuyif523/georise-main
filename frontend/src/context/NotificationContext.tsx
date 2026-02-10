import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../lib/api';

interface NotificationContextProps {
  permission: NotificationPermission;
  isSubscribed: boolean;
  loading: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setLoading(false);
      return;
    }
    setPermission(Notification.permission);
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error('Failed to check push subscription', err);
    } finally {
      setLoading(false);
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    // If granted, we can auto-subscribe or wait for user to click "Enable" toggle?
    // Usually asking for permission implies intent to subscribe.
    if (result === 'granted') {
      // subscribe(); // Optional auto-subscribe
    }
    return result;
  };

  const subscribe = async () => {
    if (!vapidKey) {
      console.error('VAPID key not configured');
      return;
    }
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send to backend
      await api.post('/notifications/subscribe', subscription.toJSON());
      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe to push', err);
      alert('Failed to enable notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        // Optional: Notify backend to delete subscription?
        // Usually backend handles failed delivery, but explicit unsubscription is cleaner.
        // For now, simple frontend implementation.
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error('Failed to unsubscribe', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        permission,
        isSubscribed,
        loading,
        requestPermission,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
