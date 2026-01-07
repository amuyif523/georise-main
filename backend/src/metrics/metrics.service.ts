import logger from '../logger';

type RequestSample = {
  path: string;
  method: string;
  status: number;
  durationMs: number;
};

type DbSample = {
  model: string;
  action: string;
  durationMs: number;
  success: boolean;
};

type AiSample = {
  durationMs: number;
  success: boolean;
};

const MAX_SAMPLES = 200;

const state = {
  requests: [] as RequestSample[],
  db: [] as DbSample[],
  ai: [] as AiSample[],
  counters: {
    requests: 0,
    requestErrors: 0,
    dbQueries: 0,
    dbErrors: 0,
    aiCalls: 0,
    aiErrors: 0,
  },
};

const clamp = (arr: unknown[]) => {
  if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES);
};

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

const summarize = (durations: number[]) => {
  if (!durations.length) {
    return { avgMs: 0, p95Ms: 0, p99Ms: 0, maxMs: 0 };
  }
  const total = durations.reduce((acc, cur) => acc + cur, 0);
  return {
    avgMs: Number((total / durations.length).toFixed(2)),
    p95Ms: Number(percentile(durations, 95).toFixed(2)),
    p99Ms: Number(percentile(durations, 99).toFixed(2)),
    maxMs: Math.max(...durations),
  };
};

export const metrics = {
  logRequest(sample: RequestSample) {
    state.counters.requests += 1;
    if (sample.status >= 500) state.counters.requestErrors += 1;
    state.requests.push(sample);
    clamp(state.requests);

    if (sample.durationMs > 2000) {
      logger.warn(
        {
          path: sample.path,
          method: sample.method,
          status: sample.status,
          durationMs: sample.durationMs,
        },
        'Slow request detected',
      );
    }
  },

  logDbQuery(sample: DbSample) {
    state.counters.dbQueries += 1;
    if (!sample.success) state.counters.dbErrors += 1;
    state.db.push(sample);
    clamp(state.db);

    if (sample.durationMs > 500) {
      logger.warn(
        {
          model: sample.model,
          action: sample.action,
          durationMs: sample.durationMs,
        },
        'Slow DB query detected',
      );
    }
  },

  logAiCall(sample: AiSample) {
    state.counters.aiCalls += 1;
    if (!sample.success) state.counters.aiErrors += 1;
    state.ai.push(sample);
    clamp(state.ai);
  },

  snapshot() {
    const requestDurations = state.requests.map((r) => r.durationMs);
    const dbDurations = state.db.map((d) => d.durationMs);
    const aiDurations = state.ai.map((a) => a.durationMs);

    return {
      counters: { ...state.counters },
      requests: {
        ...summarize(requestDurations),
        recent: state.requests.slice(-20),
      },
      db: {
        ...summarize(dbDurations),
        recent: state.db.slice(-20),
      },
      ai: {
        ...summarize(aiDurations),
        recent: state.ai.slice(-20),
      },
      errorRates: {
        requests:
          state.counters.requests === 0
            ? 0
            : Number((state.counters.requestErrors / state.counters.requests).toFixed(3)),
        db:
          state.counters.dbQueries === 0
            ? 0
            : Number((state.counters.dbErrors / state.counters.dbQueries).toFixed(3)),
        ai:
          state.counters.aiCalls === 0
            ? 0
            : Number((state.counters.aiErrors / state.counters.aiCalls).toFixed(3)),
      },
    };
  },
};

export type MetricsSnapshot = ReturnType<typeof metrics.snapshot>;
