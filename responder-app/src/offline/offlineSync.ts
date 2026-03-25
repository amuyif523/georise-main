import { flushChatQueue, getChatQueue } from './chatQueue';
import {
  flushLocationQueue,
  flushNextLocationQueueItem,
  getLocationQueueSnapshot,
} from './responderLocationQueue';
import { flushNextChatMessage } from './chatQueue';

// Flushes both queues by oldest enqueue timestamp to preserve offline action intent.
export async function flushOfflineQueuesChronologically(options?: {
  onChatStateChange?: (clientId: string, state: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED') => void;
}) {
  let safetyCounter = 0;
  while (safetyCounter < 500) {
    safetyCounter += 1;

    const chatQueue = await getChatQueue();
    const locationQueue = await getLocationQueueSnapshot();

    if (!chatQueue.length && !locationQueue.length) {
      return;
    }

    const firstChat = chatQueue.length ? [...chatQueue].sort((a, b) => a.ts.localeCompare(b.ts))[0] : null;
    const firstLocation = locationQueue.length
      ? [...locationQueue].sort((a, b) => a.ts.localeCompare(b.ts))[0]
      : null;

    if (firstChat && firstLocation) {
      const flushed =
        firstChat.ts <= firstLocation.ts
          ? await flushNextChatMessage({ onStateChange: options?.onChatStateChange })
          : await flushNextLocationQueueItem();

      if (!flushed) {
        return;
      }
      continue;
    }

    if (firstChat) {
      await flushChatQueue({ onStateChange: options?.onChatStateChange });
      return;
    }

    await flushLocationQueue();
    return;
  }
}
