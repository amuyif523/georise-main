import prisma from "../../prisma";

export class GisService {
  async findAdministrativeAreaForPoint(lat: number, lng: number) {
    const pointWkt = `SRID=4326;POINT(${lng} ${lat})`;
    const subCity = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, code
      FROM "SubCity"
      WHERE jurisdiction IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), jurisdiction)
      LIMIT 1;
    `, pointWkt);

    const woreda = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, code, "subCityId"
      FROM "Woreda"
      WHERE boundary IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), boundary)
      LIMIT 1;
    `, pointWkt);

    return {
      subCity: subCity[0] || null,
      woreda: woreda[0] || null,
    };
  }

  async findCandidateAgenciesForIncident(category: string, lat: number, lng: number) {
    const pointWkt = `SRID=4326;POINT(${lng} ${lat})`;
    const rules = await prisma.dispatchRule.findMany({ where: { category } });
    const agencyTypes = rules.map((r) => r.defaultAgencyType);
    if (agencyTypes.length === 0) return [];

    const agenciesWithin = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "type",
        ST_Distance(jurisdiction, ST_GeomFromText($1)) as distance
      FROM "Agency"
      WHERE "type" = ANY($2::"AgencyType"[])
        AND jurisdiction IS NOT NULL
        AND ST_Within(ST_GeomFromText($1), jurisdiction)
      ORDER BY distance ASC
      LIMIT 5;
    `, pointWkt, agencyTypes);
    if (agenciesWithin.length > 0) return agenciesWithin;

    const nearest = await prisma.$queryRawUnsafe<any[]>(`
      SELECT id, name, "type",
        ST_Distance(
          ST_SetSRID(ST_MakePoint("centerLongitude","centerLatitude"),4326),
          ST_GeomFromText($1)
        ) as distance
      FROM "Agency"
      WHERE "type" = ANY($2::"AgencyType"[])
      ORDER BY distance ASC
      LIMIT 5;
    `, pointWkt, agencyTypes);

    return nearest;
  }
}

export const gisService = new GisService();
