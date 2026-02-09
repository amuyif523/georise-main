import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditMiddleware } from '../src/middleware/audit';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

// Mock Prisma
vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  const mockCreate = vi.fn();
  return {
    ...actual,
    PrismaClient: vi.fn(() => ({
      $extends: vi.fn(() => ({
        auditLog: {
          create: mockCreate,
        },
        $disconnect: vi.fn(),
        $executeRawUnsafe: vi.fn(),
      })),
      auditLog: {
        create: mockCreate,
      },
      $disconnect: vi.fn(),
      $executeRawUnsafe: vi.fn(),
    })),
  };
});

describe('auditMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: any;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      method: 'POST',
      baseUrl: '/api/incidents',
      body: { title: 'Test Incident' },
      params: {},
      query: {},
      ip: '127.0.0.1',
      user: { id: 1, role: 'ADMIN' } as any,
      socket: { remoteAddress: '127.0.0.1' } as any,
    } as any;

    // Mock response with event emitter capability
    const callbacks: Record<string, (...args: any[]) => void> = {};
    res = {
      statusCode: 200,
      on: vi.fn((event, cb) => {
        callbacks[event] = cb;
        return res as Response;
      }),
      send: vi.fn(),
    };

    // Helper to trigger finish
    (res as any).triggerFinish = async () => {
      if (callbacks['finish']) {
        await callbacks['finish']();
      }
    };

    next = vi.fn();

    // Get the mock instance
    mockPrisma = new PrismaClient();
  });

  it('should skip non-state-changing methods', () => {
    req.method = 'GET';
    auditMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    // Finish shouldn't trigger audit
    (res as any).triggerFinish();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('should log valid POST request', async () => {
    req.method = 'POST';
    auditMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();

    await (res as any).triggerFinish();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CREATE_INCIDENTS',
          actorId: 1,
          targetType: 'INCIDENT',
          ipAddress: '127.0.0.1',
          payload: expect.objectContaining({
            body: { title: 'Test Incident' },
          }),
        }),
      }),
    );
  });

  it('should capture resource ID from route params for PUT/PATCH', async () => {
    req.method = 'PATCH';
    req.baseUrl = '/api/incidents';
    req.params = { id: '123' };

    auditMiddleware(req as Request, res as Response, next);
    await (res as any).triggerFinish();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE_INCIDENTS', // Logic might append s if baseurl ends in s
          targetId: 123,
        }),
      }),
    );
  });

  it('should not log if status >= 400', async () => {
    res.statusCode = 400;
    auditMiddleware(req as Request, res as Response, next);
    await (res as any).triggerFinish();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});
