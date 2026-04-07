import { IncidentStatus, ResponderStatus, VerificationRequestStatus } from '@prisma/client';
import prisma from '../../prisma';

const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.RECEIVED,
  IncidentStatus.UNDER_REVIEW,
  IncidentStatus.ASSIGNED,
  IncidentStatus.RESPONDING,
];

export async function getAdminDashboardStats() {
  const [
    totalIncidents,
    activeIncidents,
    resolvedIncidents,
    activeResponders,
    totalAgencies,
    pendingVerifications,
    totalUsers,
    byCategoryRaw,
  ] = await Promise.all([
    prisma.incident.count({ where: { deletedAt: null } }),
    prisma.incident.count({
      where: {
        deletedAt: null,
        status: { in: ACTIVE_INCIDENT_STATUSES },
      },
    }),
    prisma.incident.count({ where: { deletedAt: null, status: IncidentStatus.RESOLVED } }),
    prisma.responder.count({
      where: {
        deletedAt: null,
        isActive: true,
        status: { not: ResponderStatus.OFFLINE },
      },
    }),
    prisma.agency.count({ where: { deletedAt: null } }),
    prisma.verificationRequest.count({ where: { status: VerificationRequestStatus.PENDING } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.incident.groupBy({
      by: ['category'],
      where: { deletedAt: null },
      _count: { _all: true },
      _avg: { severityScore: true },
    }),
  ]);

  const byCategory = byCategoryRaw
    .map((row) => ({
      id: row.category ?? 'UNCATEGORIZED',
      label: row.category ?? 'Uncategorized',
      count: row._count._all,
      sev: Math.max(1, Math.min(5, Math.round(row._avg.severityScore ?? 1))),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totals: {
      totalIncidents,
      activeIncidents,
      resolvedIncidents,
      activeResponders,
      totalAgencies,
      pendingVerifications,
      totalUsers,
    },
    byCategory,
    lastUpdated: new Date().toISOString(),
  };
}
