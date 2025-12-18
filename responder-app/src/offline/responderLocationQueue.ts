import { get, set } from 'idb-keyval';
import { getSocket } from '../lib/socket';

const QUEUE_KEY = 'responder_location_queue';

interface OfflineLocationUpdate {
  ts: string;
  lat: number;
  lng: number;
}

export async function addLocationToQueue(lat: number, lng: number) {
  const queue: OfflineLocationUpdate[] = ((await get(QUEUE_KEY)) as OfflineLocationUpdate[]) || [];
  queue.push({ ts: new Date().toISOString(), lat, lng });
  await set(QUEUE_KEY, queue);
}

export async function flushLocationQueue() {
  const queue: OfflineLocationUpdate[] = ((await get(QUEUE_KEY)) as OfflineLocationUpdate[]) || [];
  if (!queue.length) return;
  const socket = getSocket();
  if (!socket || !socket.connected) return;
  for (const item of queue) {
    socket.emit('responder:locationUpdate', { lat: item.lat, lng: item.lng, offlineTs: item.ts });
  }
  await set(QUEUE_KEY, []);
}
