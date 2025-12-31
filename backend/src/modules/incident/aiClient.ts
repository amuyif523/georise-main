import axios from 'axios';
import logger from '../../logger';

const AI_BASE =
  process.env.AI_ENDPOINT?.replace(/\/classify$/, '') ||
  process.env.AI_BASE_URL ||
  'http://localhost:8001';
const CLASSIFY_URL =
  process.env.AI_ENDPOINT && process.env.AI_ENDPOINT.includes('/classify')
    ? process.env.AI_ENDPOINT
    : `${AI_BASE}/classify`;
const HEALTH_URL = `${AI_BASE}/health`;

type MetadataPayload = { model?: string; metadata?: Record<string, any> };

let metadataCache: { expiresAt: number; value: MetadataPayload | null } | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function classifyWithBackoff(payload: Record<string, any>) {
  const attempts = [0, 250, 750];
  let lastError: any;
  for (const delay of attempts) {
    if (delay) await sleep(delay);
    try {
      const res = await axios.post(CLASSIFY_URL, payload, { timeout: 4500 });
      return res.data;
    } catch (err) {
      lastError = err;
      logger.warn({ err }, 'AI classify attempt failed');
    }
  }
  throw lastError;
}

export async function fetchAiMetadata(force = false): Promise<MetadataPayload | null> {
  if (!force && metadataCache && metadataCache.expiresAt > Date.now()) {
    return metadataCache.value;
  }
  try {
    const res = await axios.get(HEALTH_URL, { timeout: 2000 });
    const payload: MetadataPayload = {
      model: res.data?.model,
      metadata: res.data?.metadata,
    };
    metadataCache = { value: payload, expiresAt: Date.now() + 5 * 60 * 1000 };
    return payload;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch AI metadata');
    return metadataCache?.value ?? null;
  }
}
