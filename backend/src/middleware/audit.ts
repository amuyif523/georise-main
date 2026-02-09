import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Only audit state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const originalSend = res.send;
  let responseBody: any;

  // Intercept response to capture body if needed for resourceId
  res.send = function (body) {
    responseBody = body;
    // eslint-disable-next-line prefer-rest-params
    return originalSend.apply(this, arguments as any);
  };

  res.on('finish', async () => {
    // Only log successful requests (or maybe all? Requirement says "intercept all successful state-changing requests")
    if (res.statusCode >= 400) return;

    try {
      if (!req.user || !req.user.id) return; // No authenticated user

      const action = deriveAction(req); // Helper to determine action name
      const targetType = deriveTargetType(req);
      const targetId = deriveTargetId(req, responseBody);

      const payload = {
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await prisma.auditLog.create({
        data: {
          actorId: req.user.id,
          action,
          targetType,
          targetId: targetId ? Number(targetId) : null,
          payload: payload as any, // Json
          ipAddress: req.ip || req.socket.remoteAddress,
          note: `Status: ${res.statusCode}`,
        } as any,
      });
    } catch (error) {
      console.error('Audit Log Error:', error);
    }
  });

  next();
};

function deriveAction(req: Request): string {
  // Heuristic based on method and path
  // e.g., POST /api/incidents -> CREATE_INCIDENT
  // PUT /api/incidents/:id -> UPDATE_INCIDENT
  const pathParts = req.baseUrl.split('/').filter(Boolean); // api, incidents
  const resource = pathParts[pathParts.length - 1] || 'UNKNOWN';

  switch (req.method) {
    case 'POST':
      return `CREATE_${resource.toUpperCase()}`;
    case 'PUT':
    case 'PATCH':
      return `UPDATE_${resource.toUpperCase()}`;
    case 'DELETE':
      return `DELETE_${resource.toUpperCase()}`;
    default:
      return `${req.method}_${resource.toUpperCase()}`;
  }
}

function deriveTargetType(req: Request): string {
  const pathParts = req.baseUrl.split('/').filter(Boolean);
  const resource = pathParts[pathParts.length - 1]; // e.g. 'incidents'
  // Singularize roughly
  if (resource.endsWith('s')) return resource.slice(0, -1).toUpperCase();
  return resource.toUpperCase();
}

function deriveTargetId(req: Request, resBody: any): number | null {
  if (req.params.id) return Number(req.params.id);
  if (resBody) {
    try {
      const parsed = typeof resBody === 'string' ? JSON.parse(resBody) : resBody;
      if (parsed.id) return Number(parsed.id);
    } catch (_e) {
      // ignore
    }
  }
  return null;
}
