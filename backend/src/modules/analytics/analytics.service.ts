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
        AVG(EXTRACT(EPOCH FROM (i."arrivalAt" - i."createdAt"))/60.0) AS avg_response_minutes,
        AVG(EXTRACT(EPOCH FROM (i."resolvedAt" - i."createdAt"))/60.0) AS avg_resolution_minutes
      FROM "Incident" i
      WHERE 1=1 ${where}
        AND i."arrivalAt" IS NOT NULL
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
        ST_X(i.location) AS lng,
        COALESCE(i."severityScore", 3) AS weight
      FROM "Incident" i
      WHERE i.location IS NOT NULL
      ${where};
    `);
    return rows;
  }

  async getResponseTimeDistribution(filters: AnalyticsFilters) {
    const where = buildTimeWhere(filters);
    // Buckets: 0-5, 5-10, 10-15, 15-30, 30-60, 60+
    // We calculate minutes between createdAt and arrivalAt
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        CASE
          WHEN diff < 5 THEN '0-5m'
          WHEN diff < 10 THEN '5-10m'
          WHEN diff < 15 THEN '10-15m'
          WHEN diff < 30 THEN '15-30m'
          WHEN diff < 60 THEN '30-60m'
          ELSE '60m+'
        END AS bucket,
        COUNT(*)::int AS count
      FROM (
        SELECT EXTRACT(EPOCH FROM ("arrivalAt" - "createdAt"))/60.0 AS diff
        FROM "Incident" i
        WHERE "arrivalAt" IS NOT NULL ${where}
      ) sub
      GROUP BY bucket
      ORDER BY MIN(diff);
    `);
    return rows;
  }

  async getTimeOfDayHeatmap(filters: AnalyticsFilters) {
    const where = buildTimeWhere(filters);
    // 0=Sunday, 6=Saturday
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        EXTRACT(DOW FROM "createdAt")::int AS day_of_week,
        EXTRACT(HOUR FROM "createdAt")::int AS hour_of_day,
        COUNT(*)::int AS count
      FROM "Incident" i
      WHERE 1=1 ${where}
      GROUP BY day_of_week, hour_of_day
      ORDER BY day_of_week, hour_of_day;
    `);
    return rows;
  }

  async getResourceUtilization(filters: AnalyticsFilters) {
    const where = buildTimeWhere(filters);
    // Group by Agency
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        a.name AS agency_name,
        COUNT(i.id)::int AS incident_count,
        AVG(EXTRACT(EPOCH FROM (i."resolvedAt" - i."dispatchedAt"))/60.0)::float AS avg_handling_time_mins
      FROM "Incident" i
      JOIN "Agency" a ON i."assignedAgencyId" = a.id
      WHERE i."resolvedAt" IS NOT NULL AND i."dispatchedAt" IS NOT NULL ${where}
      GROUP BY a.name
      ORDER BY incident_count DESC;
    `);
    return rows;
  }
}

export const analyticsService = new AnalyticsService();
