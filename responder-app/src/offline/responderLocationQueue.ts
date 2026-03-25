import { get, set } from 'idb-keyval';
import { getSocket } from '../lib/socket';

const QUEUE_KEY = 'responder_location_queue';

interface OfflineQueueUpdate {
  kind: 'location' | 'status';
  ts: string;
  lat: number;
  lng: number;
  status?: 'EN_ROUTE' | 'ARRIVED' | string;
  incidentId?: number;
}

const getApiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export async function addLocationToQueue(lat: number, lng: number, status?: string) {
  const queue: OfflineQueueUpdate[] = ((await get(QUEUE_KEY)) as OfflineQueueUpdate[]) || [];
  queue.push({ kind: 'location', ts: new Date().toISOString(), lat, lng, status });
  await set(QUEUE_KEY, queue);
}

export async function addStatusUpdateToQueue(
  incidentId: number,
  status: 'EN_ROUTE' | 'ARRIVED',
  lat: number,
  lng: number,
) {
  const queue: OfflineQueueUpdate[] = ((await get(QUEUE_KEY)) as OfflineQueueUpdate[]) || [];
  queue.push({
    kind: 'status',
    ts: new Date().toISOString(),
    lat,
    lng,
    status,
    incidentId,
  });
  await set(QUEUE_KEY, queue);
}

export async function getLocationQueueSnapshot(): Promise<OfflineQueueUpdate[]> {
  return ((await get(QUEUE_KEY)) as OfflineQueueUpdate[]) || [];
}

export async function flushLocationQueue() {
  while (await flushNextLocationQueueItem()) {
    // continue draining
  }
}

export async function flushNextLocationQueueItem(): Promise<boolean> {
  const queue = await getLocationQueueSnapshot();
  if (!queue.length) return false;

  const token = localStorage.getItem('responder_token');
  if (!token) return false;

  const socket = getSocket();
  const axiosModule = await import('axios');
  const axios = axiosModule.default;
  const headers = { Authorization: `Bearer ${token}` };

  const sorted = [...queue].sort((a, b) => a.ts.localeCompare(b.ts));
  const [item, ...remaining] = sorted;

  try {
    if (item.kind === 'status' && item.incidentId && item.status) {
      const responderStatus = item.status === 'ARRIVED' ? 'ON_SCENE' : item.status;
      await axios.patch(`${getApiBase()}/responders/me/status`, { status: responderStatus }, { headers });
      await axios.patch(
        `${getApiBase()}/responders/me/location`,
        { latitude: item.lat, longitude: item.lng, status: responderStatus },
        { headers },
      );
      const incidentPath =
        item.status === 'ARRIVED'
          ? `${getApiBase()}/incidents/${item.incidentId}/arrive`
          : `${getApiBase()}/incidents/${item.incidentId}/respond`;
      await axios.patch(incidentPath, {}, { headers });
    } else {
      await axios.patch(
        `${getApiBase()}/responders/me/location`,
        { latitude: item.lat, longitude: item.lng, ...(item.status ? { status: item.status } : {}) },
        { headers },
      );
    }

    if (socket?.connected) {
      socket.emit('responder:locationUpdate', {
        lat: item.lat,
        lng: item.lng,
        status: item.status,
        offlineTs: item.ts,
      });
    }

    await set(QUEUE_KEY, remaining);
    return true;
  } catch {
    await set(QUEUE_KEY, [item, ...remaining]);
    return false;
  }
}
