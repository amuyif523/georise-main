import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../../prisma';
import logger from '../../logger';
import { UPLOAD_DIR } from '../../config/env';
import { getIO } from '../../socket';

/**
 * POST /api/users/verify
 * Citizen submits an ID document for verification.
 * Accepts multipart/form-data: { idNumber: string, idPhoto: File }
 */
export const submitVerificationRequest = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { idNumber } = req.body as { idNumber?: string };

  if (!idNumber || typeof idNumber !== 'string' || idNumber.trim().length < 3) {
    return res.status(400).json({ message: 'idNumber is required (min 3 chars).' });
  }

  // Expect the file middleware (e.g. multer) to attach req.file
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ message: 'idPhoto file is required.' });
  }

  // ─── Multi-Submit Guard ───────────────────────────────────────────────────
  // Block if there is already an active (PENDING) or successful (APPROVED) request.
  // Only allow re-submission when the previous request was REJECTED.
  const existing = await prisma.verificationRequest.findUnique({ where: { userId } });
  if (existing && (existing.status === 'PENDING' || existing.status === 'APPROVED')) {
    // Clean up the uploaded file since we won't use it
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    const msg =
      existing.status === 'APPROVED'
        ? 'Your identity has already been verified.'
        : 'You already have a verification request under review. Please wait for the outcome.';
    return res.status(409).json({ message: msg });
  }
  // ─── End Guard ────────────────────────────────────────────────────────────

  // Build a public-accessible URL (relative to UPLOAD_DIR)
  const relPath = path.relative(UPLOAD_DIR, file.path).replace(/\\/g, '/');
  const idPhotoUrl = `/uploads/${relPath}`;

  try {
    // Upsert so a user can re-submit after previous REJECTION
    const request = await prisma.verificationRequest.upsert({
      where: { userId },
      update: {
        idNumber: idNumber.trim(),
        idPhotoUrl,
        status: 'PENDING',
        reviewNote: null,
      },
      create: {
        userId,
        idNumber: idNumber.trim(),
        idPhotoUrl,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'SUBMIT_VERIFICATION_REQUEST',
        targetType: 'User',
        targetId: userId,
      },
    });

    logger.info({ userId, requestId: request.id }, 'Verification request submitted');
    return res.status(201).json({ message: 'Verification request submitted.', request });
  } catch (err: any) {
    // Clean up the uploaded file on DB error
    try {
      fs.unlinkSync(file.path);
    } catch {
      /* ignore */
    }
    logger.error({ userId, err }, 'Failed to submit verification request');
    return res.status(500).json({ message: 'Internal error. Please try again.' });
  }
};

/**
 * GET /api/users/verify/status
 * Returns the current verification request status for the authenticated user.
 */
export const getVerificationStatus = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const request = await prisma.verificationRequest.findUnique({ where: { userId } });
  return res.json({ verificationRequest: request ?? null });
};

/**
 * PATCH /api/admin/verify-request/:id
 * Admin approves or rejects a verification request.
 */
export const updateVerificationStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, reviewNote } = req.body as {
    status: 'APPROVED' | 'REJECTED';
    reviewNote?: string;
  };

  try {
    const requestId = Number(id);
    if (isNaN(requestId)) return res.status(400).json({ message: 'Invalid request ID' });

    const verReq = await prisma.verificationRequest.findUnique({ where: { id: requestId } });
    if (!verReq) return res.status(404).json({ message: 'Verification request not found' });

    const updated = await prisma.verificationRequest.update({
      where: { id: requestId },
      data: { status, reviewNote: reviewNote ?? null },
    });

    let isVerified = false;
    if (status === 'APPROVED') {
      isVerified = true;
      // Set user as verified and grant +25 trust score bonus
      await prisma.user.update({
        where: { id: verReq.userId },
        data: { isVerified: true },
      });
      const { reputationService } = await import('../reputation/reputation.service');
      await reputationService.adjustTrust(verReq.userId, 25);
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user!.id,
        action: `VERIFICATION_${status}`,
        targetType: 'User',
        targetId: verReq.userId,
        note: reviewNote,
      },
    });

    // Real-time socket notification
    try {
      const io = getIO();
      if (io) {
        io.to(`user:${verReq.userId}`).emit('identity_verified', {
          status,
          isVerified,
        });
        logger.info({ userId: verReq.userId, status }, 'Emitted identity_verified socket event');
      }
    } catch (socketErr) {
      logger.error({ err: socketErr }, 'Failed to emit socket notification');
    }

    return res.json({ message: `Verification request ${status.toLowerCase()}.`, request: updated });
  } catch (err: any) {
    logger.error({ err }, 'Failed to update verification request');
    return res.status(500).json({ message: err?.message || 'Internal error' });
  }
};
