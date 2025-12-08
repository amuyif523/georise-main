import { get, set } from "idb-keyval";
import api from "../lib/api";

const QUEUE_KEY = "offline_incident_queue";

export interface OfflineIncident {
  tempId: string;
  payload: any;
  createdAt: string;
}

export async function addToIncidentQueue(payload: any) {
  const queue: OfflineIncident[] = ((await get(QUEUE_KEY)) as OfflineIncident[]) || [];
  const item: OfflineIncident = {
    tempId: `temp_${Date.now()}`,
    payload,
    createdAt: new Date().toISOString(),
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
  const queue = await getIncidentQueue();
  const results: { tempId: string; success: boolean; serverId?: number }[] = [];

  for (const item of queue) {
    try {
      const res = await api.post("/incidents", item.payload);
      results.push({ tempId: item.tempId, success: true, serverId: res.data.id });
      await clearIncidentFromQueue(item.tempId);
    } catch (err) {
      console.error("Failed to sync incident:", item.tempId, err);
      results.push({ tempId: item.tempId, success: false });
    }
  }

  return results;
}
