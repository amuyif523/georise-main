import { Worker, Job } from 'bullmq';
import { REDIS_URL } from '../config/env';
import prisma from '../prisma';
import { classifyWithBackoff } from '../modules/incident/aiClient';
import { emitIncidentUpdated, toIncidentPayload } from '../events/incidentEvents';
import { notificationService } from '../modules/notifications/notification.service';
import { dispatchService } from '../modules/dispatch/dispatch.service';
import logger from '../logger';
import { metrics } from '../metrics/metrics.service';

export const aiWorker = new Worker(
  'incident-ai',
  async (job: Job) => {
    const { incidentId, title, description, reporterId } = job.data;
    logger.info({ incidentId }, 'Processing AI classification job');

    const start = process.hrtime.bigint();
    let aiSuccess = false;
    let aiOutput: any = null;

    try {
      // 1. Call AI Service
      aiOutput = await classifyWithBackoff({ title, description });
      aiSuccess = true;
    } catch (err) {
      logger.error({ err, incidentId }, 'AI Service failed in worker');
      // Fallback
      aiOutput = {
        predicted_category: 'UNSPECIFIED',
        severity_score: 2,
        confidence: 0,
        model_version: 'worker-fallback',
        summary: null,
      };
    } finally {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      metrics.logAiCall({ durationMs: Number(durationMs.toFixed(2)), success: aiSuccess });
    }

    // 2. Update Database
    const updated = await prisma.incident.update({
      where: { id: incidentId },
      data: {
        category: aiOutput.predicted_category,
        severityScore: aiOutput.severity_score,
        // If the AI took a while, we might want to checking if status changed?
        // For now, simple update.
        aiOutput: {
          upsert: {
            create: {
              modelVersion: aiOutput.model_version,
              predictedCategory: aiOutput.predicted_category,
              severityScore: aiOutput.severity_score,
              confidence: aiOutput.confidence,
              summary: aiOutput.summary,
            },
            update: {
              modelVersion: aiOutput.model_version,
              predictedCategory: aiOutput.predicted_category,
              severityScore: aiOutput.severity_score,
              confidence: aiOutput.confidence,
              summary: aiOutput.summary,
            },
          },
        },
      },
      include: { aiOutput: true },
    });

    // 3. Emit Real-time Update
    emitIncidentUpdated(toIncidentPayload(updated));
    logger.info({ incidentId, category: updated.category }, 'Incident AI analysis complete');

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
  },
);

aiWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'AI Worker job failed');
});

logger.info('AI Worker started');
