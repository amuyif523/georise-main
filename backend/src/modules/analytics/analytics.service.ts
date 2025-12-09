import prisma from "../../prisma";

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  agencyId?: number;
}

const buildTimeWhere = (filters: AnalyticsFilters) => {
  const clauses: string[] = [];
  if (filters.from) clauses.push(`i."createdAt" >= '${filters.from}'`);
  if (filters.to) clauses.push(`i."createdAt" <= '${filters.to}'`);
  if (filters.agencyId) clauses.push(`i."assignedAgencyId" = ${filters.agencyId}`);
  return clauses.length ? `AND ${clauses.join(" AND ")}` : "";
};

class AnalyticsService {
  async getOverview(filters: AnalyticsFilters) {
    const where = buildTimeWhere(filters);

    const totalResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total
      FROM "Incident" i
      WHERE 1=1 ${where};
    `);

    const byCategory: any[] = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(i."category",'Uncategorized') AS category, COUNT(*)::int AS count
      FROM "Incident" i
      WHERE 1=1 ${where}
      GROUP BY category
      ORDER BY count DESC;
    `);

    const byStatus: any[] = await prisma.$queryRawUnsafe(`
      SELECT i."status", COUNT(*)::int AS count
      FROM "Incident" i
      WHERE 1=1 ${where}
      GROUP BY i."status";
    `);

    const byDay: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('day', i."createdAt")::date AS day,
        COUNT(*)::int AS count
      FROM "Incident" i
      WHERE 1=1 ${where}
      GROUP BY day
      ORDER BY day;
    `);

    const timeAgg: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (ia."arrivedAt" - i."createdAt"))/60.0) AS avg_response_minutes,
        AVG(EXTRACT(EPOCH FROM (ia."completedAt" - i."createdAt"))/60.0) AS avg_resolution_minutes
      FROM "Incident" i
      JOIN "IncidentAssignment" ia ON ia."incidentId" = i.id
      WHERE 1=1 ${where}
        AND ia."arrivedAt" IS NOT NULL
    `);

    return {
      totalIncidents: totalResult[0]?.total ?? 0,
      byCategory,
      byStatus,
      byDay,
      avgResponseMinutes: timeAgg[0]?.avg_response_minutes ?? null,
      avgResolutionMinutes: timeAgg[0]?.avg_resolution_minutes ?? null,
    };
  }

  async getHeatmapPoints(filters: AnalyticsFilters) {
    const where = buildTimeWhere(filters);
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        ST_Y(i.location) AS lat,
        ST_X(i.location) AS lon,
        COALESCE(i."severityScore", 3) AS weight
      FROM "Incident" i
      WHERE i.location IS NOT NULL
      ${where};
    `);
    return rows;
  }
}

export const analyticsService = new AnalyticsService();
