/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', (event) => {
  const data = event.data?.json() as
    | { title?: string; body?: string; data?: Record<string, unknown> }
    | undefined;

  const title = data?.title || 'GEORISE Alert';
  const options: NotificationOptions = {
    body: data?.body || 'You have a new alert.',
    data: data?.data || {},
    icon: '/icons/icon-192.png',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
