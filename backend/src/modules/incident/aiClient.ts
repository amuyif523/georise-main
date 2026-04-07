import axios from 'axios';
import logger from '../../logger';
import { INTERNAL_SERVICE_SECRET } from '../../config/env';

const configuredAiEndpoint =
  process.env.AI_ENDPOINT || process.env.AI_SERVICE_URL || process.env.AI_BASE_URL;

const CLASSIFY_URL = configuredAiEndpoint
  ? configuredAiEndpoint.includes('/classify')
    ? configuredAiEndpoint
    : `${configuredAiEndpoint.replace(/\/$/, '')}/classify`
  : 'http://localhost:8000/classify';

const AI_BASE = CLASSIFY_URL.replace(/\/classify$/, '');
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
      // Ensure payload matches Python Pydantic model: ClassifyRequest(title: str, description: str)
      const formattedPayload = {
        title: payload.title || payload.text?.substring(0, 50) || 'No Title',
        description: payload.description || payload.text || '',
        metadata: {
          initialTrustScore: payload.initialTrustScore,
          manualCategory: payload.manualCategory || payload.category || null,
        },
      };

      const res = await axios.post(CLASSIFY_URL, formattedPayload, {
        timeout: 4500,
        headers: { Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
      });
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
    const res = await axios.get(HEALTH_URL, {
      timeout: 2000,
      headers: { Authorization: `Bearer ${INTERNAL_SERVICE_SECRET}` },
    });
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
