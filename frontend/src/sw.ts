/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

precacheAndRoute(self.__WB_MANIFEST || []);

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    (url.hostname.endsWith('tile.openstreetmap.org') ||
      url.hostname.endsWith('.tile.openstreetmap.org')),
  new CacheFirst({
    cacheName: 'citizen-osm-tiles-v1',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 800,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  ({ url, request }) =>
    request.method === 'GET' &&
    url.pathname.endsWith('/api/incidents/feed'),
  new StaleWhileRevalidate({
    cacheName: 'citizen-incident-feed-v1',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

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
  const urlToOpen = (event.notification.data as { url?: string } | undefined)?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (const client of windowClients) {
          // Compare URLs (ignoring query params/hash if needed, but simple check for now)
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
        return undefined; // Add explicit return for void/Promise<void> match
      }),
  );
});
