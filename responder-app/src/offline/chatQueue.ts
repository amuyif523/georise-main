import { get, set } from 'idb-keyval';

const CHAT_QUEUE_KEY = 'responder_chat_queue';

type SyncState = 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';

export interface OfflineChatMessage {
  clientId: string;
  incidentId: number;
  message: string;
  ts: string;
}

const getApiBase = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

export async function getChatQueue(): Promise<OfflineChatMessage[]> {
  return ((await get(CHAT_QUEUE_KEY)) as OfflineChatMessage[]) || [];
}

async function setChatQueue(queue: OfflineChatMessage[]) {
  await set(CHAT_QUEUE_KEY, queue);
}

export async function addChatMessageToQueue(incidentId: number, message: string) {
  const queue = await getChatQueue();
  const item: OfflineChatMessage = {
    clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    incidentId,
    message,
    ts: new Date().toISOString(),
  };
  queue.push(item);
  await setChatQueue(queue);
  return item;
}

async function processChatItem(item: OfflineChatMessage, token: string) {
  const axiosModule = await import('axios');
  const axios = axiosModule.default;
  await axios.post(
    `${getApiBase()}/incidents/${item.incidentId}/chat`,
    { message: item.message },
    { headers: { Authorization: `Bearer ${token}` } },
  );
}

export async function flushChatQueue(options?: {
  onStateChange?: (clientId: string, state: SyncState) => void;
}) {
  while (await flushNextChatMessage(options)) {
    // continue draining
  }
}

export async function flushNextChatMessage(options?: {
  onStateChange?: (clientId: string, state: SyncState) => void;
}): Promise<boolean> {
  const queue = await getChatQueue();
  if (!queue.length) return false;

  const token = localStorage.getItem('responder_token');
  if (!token) return false;

  const sorted = [...queue].sort((a, b) => a.ts.localeCompare(b.ts));
  const [next, ...remaining] = sorted;

  try {
    options?.onStateChange?.(next.clientId, 'SYNCING');
    await processChatItem(next, token);
    options?.onStateChange?.(next.clientId, 'SYNCED');
    await setChatQueue(remaining);
    return true;
  } catch {
    options?.onStateChange?.(next.clientId, 'FAILED');
    await setChatQueue([next, ...remaining]);
    return false;
  }
}
