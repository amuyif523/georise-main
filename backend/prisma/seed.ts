import { PrismaClient, Role, AgencyType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const agencies = [
    { name: "Bole Police Dept", type: "POLICE", city: "Bole", lat: 9.0106, lng: 38.7835 },
    { name: "Piassa Fire Station", type: "FIRE", city: "Arada", lat: 9.037, lng: 38.756 },
    { name: "CMC Ambulance Center", type: "MEDICAL", city: "Yeka", lat: 9.0405, lng: 38.834 },
    { name: "Teklehaymanot Traffic Post", type: "TRAFFIC", city: "Lideta", lat: 9.012, lng: 38.741 },
    { name: "Summit Utility Response", type: "ELECTRIC", city: "Yeka", lat: 9.047, lng: 38.813 },
    { name: "Aware Flood Response Unit", type: "DISASTER", city: "Akaki", lat: 8.963, lng: 38.807 },
    { name: "AAWSA Water Ops - Megenagna", type: "WATER", city: "Yeka", lat: 9.019, lng: 38.811 },
    { name: "Environmental Hazard Unit - Gullele", type: "ENVIRONMENT", city: "Gullele", lat: 9.056, lng: 38.722 },
    { name: "Public Health Rapid Response", type: "PUBLIC_HEALTH", city: "Addis Ababa", lat: 9.025, lng: 38.77 },
    { name: "Construction Safety Corps", type: "CONSTRUCTION", city: "Addis Ababa", lat: 9.015, lng: 38.77 },
    { name: "City Administration Ops", type: "ADMINISTRATION", city: "Addis Ababa", lat: 9.03, lng: 38.75 },
    { name: "General Support Unit", type: "OTHER", city: "Addis Ababa", lat: 9.02, lng: 38.79 },
  ];

  const createdAgencies = [];
  for (const a of agencies) {
    let agency = await prisma.agency.findFirst({ where: { name: a.name } });
    if (!agency) {
      agency = await prisma.agency.create({
        data: {
          name: a.name,
          city: a.city,
          type: a.type as AgencyType,
          description: `${a.type} unit in ${a.city}`,
          isApproved: true,
          isActive: true,
        },
      });
    } else {
      agency = await prisma.agency.update({
        where: { id: agency.id },
        data: {
          city: a.city,
          type: a.type as AgencyType,
          isApproved: true,
          isActive: true,
        },
      });
    }

    await prisma.$executeRaw`
      UPDATE "Agency"
      SET "centerLatitude" = ${a.lat},
          "centerLongitude" = ${a.lng},
          type = ${a.type}::"AgencyType",
          boundary = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 1200)::geometry,
          jurisdiction = ST_Buffer(ST_SetSRID(ST_MakePoint(${a.lng}, ${a.lat}), 4326)::geography, 1200)::geometry
      WHERE id = ${agency.id};
    `;
    createdAgencies.push(agency);
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      fullName: "System Admin",
      email: "admin@example.com",
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const agencyUser = await prisma.user.upsert({
    where: { email: "police1@example.com" },
    update: {},
    create: {
      fullName: "Police Officer One",
      email: "police1@example.com",
      passwordHash,
      role: Role.AGENCY_STAFF,
    },
  });

  const fireUser = await prisma.user.upsert({
    where: { email: "fire1@example.com" },
    update: {},
    create: {
      fullName: "Fire Chief One",
      email: "fire1@example.com",
      passwordHash,
      role: Role.AGENCY_STAFF,
    },
  });

  const medicalUser = await prisma.user.upsert({
    where: { email: "medical1@example.com" },
    update: {},
    create: {
      fullName: "Medic One",
      email: "medical1@example.com",
      passwordHash,
      role: Role.AGENCY_STAFF,
    },
  });

  const trafficUser = await prisma.user.upsert({
    where: { email: "traffic1@example.com" },
    update: {},
    create: {
      fullName: "Traffic Officer One",
      email: "traffic1@example.com",
      passwordHash,
      role: Role.AGENCY_STAFF,
    },
  });

  const citizen = await prisma.user.upsert({
    where: { email: "citizen1@example.com" },
    update: {},
    create: {
      fullName: "Citizen One",
      email: "citizen1@example.com",
      passwordHash,
      role: Role.CITIZEN,
    },
  });

  const policeAgencyId = createdAgencies.find((a) => a.type === "POLICE")?.id ?? createdAgencies[0]?.id;
  await prisma.agencyStaff.upsert({
    where: { userId: agencyUser.id },
    update: { agencyId: policeAgencyId },
    create: {
      userId: agencyUser.id,
      agencyId: policeAgencyId,
      position: "Dispatcher",
    },
  });

  const fireAgencyId = createdAgencies.find((a) => a.type === "FIRE")?.id;
  if (fireAgencyId) {
    await prisma.agencyStaff.upsert({
      where: { userId: fireUser.id },
      update: { agencyId: fireAgencyId },
      create: { userId: fireUser.id, agencyId: fireAgencyId, position: "Station Chief" },
    });
  }

  const medicalAgencyId = createdAgencies.find((a) => a.type === "MEDICAL")?.id;
  if (medicalAgencyId) {
    await prisma.agencyStaff.upsert({
      where: { userId: medicalUser.id },
      update: { agencyId: medicalAgencyId },
      create: { userId: medicalUser.id, agencyId: medicalAgencyId, position: "Head Medic" },
    });
  }

  const trafficAgencyId = createdAgencies.find((a) => a.type === "TRAFFIC")?.id;
  if (trafficAgencyId) {
    await prisma.agencyStaff.upsert({
      where: { userId: trafficUser.id },
      update: { agencyId: trafficAgencyId },
      create: { userId: trafficUser.id, agencyId: trafficAgencyId, position: "Traffic Controller" },
    });
  }

  const incidents = [
    {
      title: "Apartment fire near Bole",
      description: "Smoke visible from 3rd floor apartment near Bole Medhanealem.",
      category: "FIRE",
      severityScore: 4,
      latitude: 9.0123,
      longitude: 38.7612,
    },
    {
      title: "Traffic crash near Mexico",
      description: "Two-car collision near Mexico roundabout, injuries reported.",
      category: "TRAFFIC",
      severityScore: 3,
      latitude: 9.0105,
      longitude: 38.7471,
    },
    {
      title: "Medical emergency at Stadium",
      description: "Person collapsed at Addis Ababa Stadium stands, needs medical help.",
      category: "MEDICAL",
      severityScore: 3,
      latitude: 9.032,
      longitude: 38.7615,
    },
  ];

  for (const inc of incidents) {
    const created = await prisma.incident.create({
      data: {
        title: inc.title,
        description: inc.description,
        reporterId: citizen.id,
        category: inc.category,
        severityScore: inc.severityScore,
        latitude: inc.latitude,
        longitude: inc.longitude,
      },
    });
    await prisma.$executeRaw`
      UPDATE "Incident"
      SET location = ST_SetSRID(ST_MakePoint(${inc.longitude}, ${inc.latitude}), 4326)
      WHERE id = ${created.id};
    `;
  }

  // Dispatch rules seed (basic)
  const rules = [
    { category: "FIRE", defaultAgencyType: "FIRE" },
    { category: "TRAFFIC", defaultAgencyType: "TRAFFIC" },
    { category: "MEDICAL", defaultAgencyType: "MEDICAL" },
    { category: "CRIME", defaultAgencyType: "POLICE" },
    { category: "DISASTER", defaultAgencyType: "DISASTER" },
  ];
  await prisma.dispatchRule.deleteMany();
  await prisma.dispatchRule.createMany({
    data: rules.map((r) => ({
      category: r.category,
      defaultAgencyType: r.defaultAgencyType as AgencyType,
    })),
  });

  console.log("Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
