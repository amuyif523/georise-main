import { Worker, Job } from 'bullmq';
import { REDIS_URL } from '../config/env';
import prisma from '../prisma';
import { classifyWithBackoff } from '../modules/incident/aiClient';
import { emitIncidentUpdated, toIncidentPayload } from '../events/incidentEvents';
import { notificationService } from '../modules/notifications/notification.service';
import { dispatchService } from '../modules/dispatch/dispatch.service';
import logger from '../logger';
import { metrics } from '../metrics/metrics.service';

const ALLOWED_INCIDENT_CATEGORIES = new Set([
  'FIRE',
  'MEDICAL',
  'TRAFFIC',
  'CRIME',
  'INFRASTRUCTURE',
  'OTHER',
]);

const CATEGORY_ALIASES: Record<string, string> = {
  POLICE: 'CRIME',
  ACCIDENT: 'TRAFFIC',
  UTILITY: 'INFRASTRUCTURE',
  UNSPECIFIED: 'OTHER',
  UNKNOWN: 'OTHER',
};

const normalizeCategory = (value?: string | null) => {
  if (!value) return '';
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return CATEGORY_ALIASES[normalized] ?? normalized;
};

const inferCategoryFromText = (text: string, manualCategory?: string | null) => {
  const body = text.toLowerCase();
  const keywordGroups: Array<[string, string[]]> = [
    ['CRIME', ['thief', 'thieves', 'robber', 'robbery', 'burglary', 'break-in', 'breaking in', 'intruder', 'stolen', 'crime', 'ሌባ', 'ወንጀል']],
    ['FIRE', ['fire', 'smoke', 'flame', 'burn', 'explosion', 'እሳት', 'ጭስ']],
    ['MEDICAL', ['medical', 'injury', 'injured', 'blood', 'ambulance', 'hospital', 'ሕክምና', 'ደም']],
    ['TRAFFIC', ['traffic', 'accident', 'crash', 'collision', 'vehicle', 'car', 'truck', 'ትራፊክ', 'መኪና']],
    ['INFRASTRUCTURE', ['bridge', 'pothole', 'electric', 'power', 'water', 'flood', 'internet', 'road', 'መብራት', 'ውሃ']],
  ];

  for (const [category, keywords] of keywordGroups) {
    if (keywords.some((keyword) => body.includes(keyword))) {
      return category;
    }
  }

  const normalizedManual = normalizeCategory(manualCategory);
  if (ALLOWED_INCIDENT_CATEGORIES.has(normalizedManual)) {
    return normalizedManual;
  }

  return 'OTHER';
};

const validateIncidentCategory = (
  aiCategory: string | null | undefined,
  title: string,
  description: string,
  manualCategory?: string | null,
) => {
  const normalized = normalizeCategory(aiCategory);
  if (ALLOWED_INCIDENT_CATEGORIES.has(normalized)) {
    return normalized;
  }

  return inferCategoryFromText(`${title} ${description}`.trim(), manualCategory);
};

export const aiWorker = new Worker(
  'incident-ai',
  async (job: Job) => {
    const { incidentId, title, description, reporterId, initialTrustScore, manualCategory } =
      job.data;
    logger.info({ incidentId }, 'Processing AI classification job');

    const start = process.hrtime.bigint();
    let aiSuccess = false;
    let aiOutput: any = null;

    try {
      // 1. Call AI Service
      aiOutput = await classifyWithBackoff({ title, description });
      aiSuccess = true;
    } catch (err: any) {
      const errorDetails = err.response?.data || err.message || 'Unknown error';
      const statusCode = err.response?.status;

      logger.error({ err, incidentId, statusCode, errorDetails }, 'AI Service failed in worker');

      // Fallback with visible error summary
      aiOutput = {
        predicted_category: 'UNSPECIFIED',
        severity_score: 2,
        confidence: 0,
        model_version: 'worker-fallback',
        summary: `AI Error: ${typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails}`,
      };
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      metrics.logAiCall({ durationMs: Number(durationMs.toFixed(2)), success: aiSuccess });
    }

    // 2. Update Database
    try {
      const currentIncident = await prisma.incident.findUnique({
        where: { id: incidentId },
        select: {
          severityScore: true,
          spatialScore: true,
          volumeBoost: true,
          needsManualReview: true,
        },
      });

      const trustMultiplier = initialTrustScore ?? 0.5;
      const aiScore = aiOutput.severity_score ?? 1;
      const aiConfidence = aiOutput.confidence ?? 0;
      const validatedCategory = validateIncidentCategory(
        aiOutput.predicted_category,
        title,
        description,
        manualCategory,
      );
      const spatialScore = currentIncident?.spatialScore ?? currentIncident?.severityScore ?? 1;
      const volumeBoost = currentIncident?.volumeBoost ?? 0;
      const spatialBase = Math.min(5, spatialScore + volumeBoost);
      const aiWeightedScore = Math.max(1, Math.round(aiScore * trustMultiplier));

      const updateData: Record<string, any> = {
        category: validatedCategory,
        aiScore,
        needsManualReview: aiConfidence < 0.6,
        aiOutput: {
          upsert: {
            create: {
              modelVersion: aiOutput.model_version,
              predictedCategory: validatedCategory,
              severityScore: aiScore,
              confidence: aiOutput.confidence,
              summary: aiOutput.summary,
            },
            update: {
              modelVersion: aiOutput.model_version,
              predictedCategory: validatedCategory,
              severityScore: aiScore,
              confidence: aiOutput.confidence,
              summary: aiOutput.summary,
            },
          },
        },
      };

      if (aiConfidence >= 0.6) {
        updateData.severityScore = Math.max(spatialBase, aiWeightedScore);
      }

      const updated = await prisma.incident.update({
        where: { id: incidentId },
        data: updateData,
        include: { aiOutput: true },
      });

      // 3. Emit Real-time Update
      emitIncidentUpdated(toIncidentPayload(updated));
      const durationMs = Number((process.hrtime.bigint() - start) / 1_000_000n);
      logger.info(
        { incidentId, category: updated.category, durationMs },
        'Incident AI analysis complete',
      );

      // 4. Auto-Pilot Dispatch (Task 1 of Sprint 5)
      try {
        const autoResult = await dispatchService.executeAutoAssignment(incidentId);
        if (autoResult) {
          logger.info(
            { incidentId, unit: autoResult.unit.name },
            'Auto-Pilot successfully dispatched incident',
          );
        }
      } catch (err) {
        logger.error({ err, incidentId }, 'Auto-Pilot dispatch check failed');
      }

      // 5. Critical Alert Logic (Async)
      if (updated.severityScore && updated.severityScore >= 4) {
        await notificationService.send({
          userId: reporterId,
          title: 'High Severity Alert',
          message: `Your report #${updated.id} has been analyzed as HIGH severity (${updated.category}). Help is being prioritized.`,
          type: 'INCIDENT_UPDATE',
          data: { incidentId: updated.id },
          channels: ['SMS', 'PUSH', 'IN_APP'],
        });
      }
    } catch (error: any) {
      if (error.code === 'P2025') {
        logger.info(
          { incidentId },
          `ℹ️ Skipping AI update: Incident ${incidentId} was deleted before processing.`,
        );
        return;
      }
      throw error;
    }
  },
  {
    connection: {
      url: REDIS_URL,
    },
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000,
    },
    lockDuration: 30000, // 30s to allow model warm-up/processing
  },
);

aiWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'AI Worker job failed');
});

logger.info('AI Worker started');
