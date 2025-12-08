import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Clear existing demo data (optional; keep minimal to avoid destructive ops)
  // await prisma.incident.deleteMany({});
  // await prisma.user.deleteMany({});
  // await prisma.agency.deleteMany({});

  const passwordHash = await bcrypt.hash("password123", 10);

  // Agencies
  const police = await prisma.agency.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Addis Police",
      city: "Addis Ababa",
      type: "POLICE",
      description: "City police department",
      isApproved: true,
      isActive: true,
    },
  });
  const fire = await prisma.agency.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Addis Fire & Rescue",
      city: "Addis Ababa",
      type: "FIRE",
      description: "Fire and rescue",
      isApproved: true,
      isActive: true,
    },
  });

  // Users
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

  await prisma.agencyStaff.upsert({
    where: { userId: agencyUser.id },
    update: { agencyId: police.id },
    create: {
      userId: agencyUser.id,
      agencyId: police.id,
      position: "Dispatcher",
    },
  });

  const incidents = [
    {
      title: "እሳት በደራሲ ቦሌ ሱቅ",
      description: "እሳት ተነሳ በደራሲ ያለው ሱቅ ውስጥ፣ ሰዎች እየተሰማሩ ናቸው",
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
