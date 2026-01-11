import prisma from '../../prisma';
import redis from '../../redis';

const ADMIN_AREA_CACHE_TTL_SECONDS = 300;

export class GisService {
  async findAdministrativeAreaForPoint(lat: number, lng: number) {
    const cacheKey = `gis:admin-area:${lat.toFixed(4)}:${lng.toFixed(4)}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          // fall through on parse error
        }
      }
    } catch (_err) {
      // Cache unavailable, continue with DB lookup
    }

    const pointWkt = `SRID=4326;POINT(${lng} ${lat})`;
    const subCity = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, code
      FROM "SubCity"
      WHERE jurisdiction IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), jurisdiction)
      LIMIT 1;
    `,
      pointWkt,
    );

    const woreda = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, code, "subCityId"
      FROM "Woreda"
      WHERE boundary IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), boundary)
      LIMIT 1;
    `,
      pointWkt,
    );

    const result = {
      subCity: subCity[0] || null,
      woreda: woreda[0] || null,
    };

    try {
      await redis.setex(cacheKey, ADMIN_AREA_CACHE_TTL_SECONDS, JSON.stringify(result));
    } catch {
      // Ignore cache failures
    }
    return result;
  }

  async findCandidateAgenciesForIncident(category: string, lat: number, lng: number) {
    const pointWkt = `SRID=4326;POINT(${lng} ${lat})`;
    const rules = await prisma.dispatchRule.findMany({ where: { category } });
    const agencyTypes = rules.map((r) => r.defaultAgencyType);
    if (agencyTypes.length === 0) return [];

    const agenciesWithin = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, "type",
        ST_Distance(jurisdiction, ST_GeomFromText($1)) as distance
      FROM "Agency"
      WHERE "type" = ANY($2::"AgencyType"[])
        AND jurisdiction IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), jurisdiction)
      ORDER BY distance ASC
      LIMIT 5;
    `,
      pointWkt,
      agencyTypes,
    );
    if (agenciesWithin.length > 0) return agenciesWithin;

    const nearest = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, "type",
        ST_Distance(
          ST_SetSRID(ST_MakePoint("centerLongitude","centerLatitude"),4326),
          ST_GeomFromText($1)
        ) as distance
      FROM "Agency"
      WHERE "type" = ANY($2::"AgencyType"[])
      ORDER BY distance ASC
      LIMIT 5;
    `,
      pointWkt,
      agencyTypes,
    );

    return nearest;
  }
}

export const gisService = new GisService();
