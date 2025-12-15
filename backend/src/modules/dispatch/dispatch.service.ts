import prisma from "../../prisma";

interface DispatchCandidate {
  agencyId: number;
  unitId: number | null;
  distanceKm: number | null;
  jurisdictionScore: number;
  severityScore: number;
  proximityScore: number;
  totalScore: number;
}

const normalize = (value: number | null, max: number) => {
  if (value === null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value / max));
};

const categoryPreferred = (category?: string | null, agencyType?: string | null): number => {
  if (!category || !agencyType) return 0;
  const cat = category.toLowerCase();
  const type = agencyType.toLowerCase();
  if (type === "fire" && (cat.includes("fire") || cat.includes("smoke"))) return 0.2;
  if (type === "medical" && (cat.includes("medical") || cat.includes("injury") || cat.includes("ambulance"))) return 0.2;
  if (type === "police" && (cat.includes("crime") || cat.includes("assault") || cat.includes("robbery"))) return 0.15;
  if (type === "traffic" && (cat.includes("traffic") || cat.includes("accident") || cat.includes("crash"))) return 0.15;
  return 0;
};

export class DispatchService {
  async recommendForIncident(incidentId: number): Promise<DispatchCandidate[]> {
    const incidentRows: any[] = await prisma.$queryRaw`
      SELECT id,
             severityScore,
             location,
             category
      FROM "Incident"
      WHERE id = ${incidentId}
      LIMIT 1;
    `;
    if (!incidentRows.length) {
      throw new Error("Incident not found");
    }
    const incident = incidentRows[0];
    const severityNorm = normalize(incident.severityscore ?? 3, 5);

    // load agencies with optional jurisdiction geometry
    const agencies: any[] = await prisma.$queryRaw`
      SELECT id,
             name,
             type,
             jurisdiction
      FROM "Agency"
      WHERE "isActive" = true
    `;

    // load available units with last known position
    const units: any[] = await prisma.$queryRaw`
      SELECT u.id,
             u."agencyId",
             u.name,
             u.status,
             u.latitude as "lastLat",
             u.longitude as "lastLon",
             CASE
               WHEN u.latitude IS NOT NULL AND u.longitude IS NOT NULL THEN
                 ST_DistanceSphere(
                   ST_SetSRID(ST_MakePoint(u.longitude, u.latitude), 4326),
                   ${incident.location}
                 ) / 1000
               ELSE NULL
             END AS distance_km
      FROM "Responder" u
      WHERE u.status = 'AVAILABLE';
    `;

    const candidates: DispatchCandidate[] = [];

    for (const agency of agencies) {
      // jurisdiction check if geometry available
      let inJurisdiction = false;
      if (agency.jurisdiction && incident.location) {
        const flag: any[] = await prisma.$queryRaw`
          SELECT ST_Contains(${agency.jurisdiction}::geometry, ${incident.location}::geometry) AS inside
        `;
        inJurisdiction = !!(flag[0]?.inside);
      }
      const jurisdictionScore = inJurisdiction ? 1 : 0.5;
      const agencyUnits = units.filter((u) => u.agencyid === agency.id || u.agencyId === agency.id);

      if (!agencyUnits.length) {
        const catBonus = categoryPreferred(incident.category, agency.type);
        const totalScore = jurisdictionScore * 0.5 + severityNorm * 0.4 + catBonus;
        candidates.push({
          agencyId: agency.id,
          unitId: null,
          distanceKm: null,
          jurisdictionScore,
          severityScore: severityNorm,
          proximityScore: 0,
          totalScore,
        });
        continue;
      }

      for (const unit of agencyUnits) {
        const distanceKm = unit.distance_km as number | null;
        const proximityScore = 1 - normalize(distanceKm, 15); // 15km cap
        const catBonus = categoryPreferred(incident.category, agency.type);
        const totalScore = jurisdictionScore * 0.35 + severityNorm * 0.3 + proximityScore * 0.25 + catBonus;
        candidates.push({
          agencyId: agency.id,
          unitId: unit.id,
          distanceKm,
          jurisdictionScore,
          severityScore: severityNorm,
          proximityScore,
          totalScore,
        });
      }
    }

    candidates.sort((a, b) => b.totalScore - a.totalScore);
    return candidates;
  }
}

export const dispatchService = new DispatchService();
