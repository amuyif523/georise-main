import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../../prisma';
import logger from '../../logger';
import { UPLOAD_DIR } from '../../config/env';

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

  // Build a public-accessible URL (relative to UPLOAD_DIR)
  const relPath = path.relative(UPLOAD_DIR, file.path).replace(/\\/g, '/');
  const idPhotoUrl = `/uploads/${relPath}`;

  try {
    // Upsert so a user can re-submit if previously rejected
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
