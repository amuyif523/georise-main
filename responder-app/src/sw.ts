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

  const title = data?.title || '🚨 New Emergency Assignment';
  const options: NotificationOptions & { vibrate?: number[]; actions?: any[] } = {
    body: data?.body || 'You have been dispatched to a new incident.',
    data: data?.data || {},
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      {
        action: 'accept',
        title: 'ACCEPT MISSION',
      },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = (event.notification.data as { url?: string } | undefined)?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === new URL(urlToOpen, self.location.origin).href && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
        return undefined;
      }),
  );
});
