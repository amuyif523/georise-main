import { get, set } from 'idb-keyval';
import api from '../lib/api';

const QUEUE_KEY = 'offline_incident_queue';
const SYNCED_ID_MAP_KEY = 'offline_incident_id_map';

let syncInFlight = false;

export interface IncidentPayload {
  title?: string;
  description?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  localCreatedAt?: string;
  [key: string]: unknown;
}

export interface OfflineIncident {
  tempId: string;
  payload: IncidentPayload;
  createdAt: string;
}

type SyncedIdMap = Record<string, number>;

async function getSyncedIdMap(): Promise<SyncedIdMap> {
  return ((await get(SYNCED_ID_MAP_KEY)) as SyncedIdMap) || {};
}

async function setSyncedIdMap(map: SyncedIdMap) {
  await set(SYNCED_ID_MAP_KEY, map);
}

async function recordSyncedId(tempId: string, serverId: number) {
  const current = await getSyncedIdMap();
  current[tempId] = serverId;
  await setSyncedIdMap(current);
}

export async function addToIncidentQueue(payload: IncidentPayload) {
  const queue: OfflineIncident[] = ((await get(QUEUE_KEY)) as OfflineIncident[]) || [];
  const createdAt = new Date().toISOString();
  const item: OfflineIncident = {
    tempId: `temp_${Date.now()}`,
    payload: {
      ...payload,
      localCreatedAt: typeof payload.localCreatedAt === 'string' ? payload.localCreatedAt : createdAt,
    },
    createdAt,
  };
  queue.push(item);
  await set(QUEUE_KEY, queue);
  return item;
}

export async function getIncidentQueue(): Promise<OfflineIncident[]> {
  return ((await get(QUEUE_KEY)) as OfflineIncident[]) || [];
}

export async function clearIncidentFromQueue(tempId: string) {
  const queue: OfflineIncident[] = ((await get(QUEUE_KEY)) as OfflineIncident[]) || [];
  const filtered = queue.filter((i) => i.tempId !== tempId);
  await set(QUEUE_KEY, filtered);
}

export async function syncIncidentQueue() {
  if (syncInFlight) {
    return [];
  }

  syncInFlight = true;

  const queue = await getIncidentQueue();
  const results: { tempId: string; success: boolean; serverId?: number }[] = [];
  const syncedIdMap = await getSyncedIdMap();

  try {
    for (const item of queue) {
      const hydratedId = syncedIdMap[item.tempId];
      if (typeof hydratedId === 'number') {
        results.push({ tempId: item.tempId, success: true, serverId: hydratedId });
        await clearIncidentFromQueue(item.tempId);
        continue;
      }

      try {
        const res = await api.post('/incidents', item.payload);
        const serverId = Number(res.data?.incident?.id ?? res.data?.id);
        if (Number.isFinite(serverId)) {
          await recordSyncedId(item.tempId, serverId);
          results.push({ tempId: item.tempId, success: true, serverId });
        } else {
          results.push({ tempId: item.tempId, success: true });
        }
        await clearIncidentFromQueue(item.tempId);
      } catch (err) {
        console.error('Failed to sync incident:', item.tempId, err);
        // If validation error (400), remove from queue to prevent infinite loop
        // @ts-expect-error Accessing response on unknown type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (err?.response?.status === 400) {
          // @ts-expect-error Accessing response on unknown type
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          console.error('SERVER VALIDATION ERROR:', JSON.stringify(err.response.data, null, 2));
          console.warn('Discarding invalid incident from queue:', item.tempId);
          await clearIncidentFromQueue(item.tempId);
        }
        results.push({ tempId: item.tempId, success: false });
      }
    }
  } finally {
    syncInFlight = false;
  }

  return results;
}
