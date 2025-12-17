import request from "supertest";
import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import app from "../src/app";
import prisma from "../src/prisma";
import { createAgency, createIncident, createUser, linkAgencyStaff } from "./utils/factories";

describe("Dispatch flows", () => {
  it("assigns an incident to an agency", async () => {
    const password = "password123";
    const adminEmail = `admin_${Date.now()}@example.com`;
    const admin = await createUser({ email: adminEmail, password, role: Role.ADMIN });

    const agency = await createAgency();
    await linkAgencyStaff(admin.id, agency.id);

    const reporter = await createUser({ email: `citizen_${Date.now()}@example.com` });
    const incident = await createIncident({ reporterId: reporter.id });

    const loginRes = await request(app).post("/api/auth/login").send({ email: adminEmail, password });
    const token = loginRes.body.token as string;

    const res = await request(app)
      .post("/api/dispatch/assign")
      .set("Authorization", `Bearer ${token}`)
      .send({ incidentId: incident.id, agencyId: agency.id });

    expect(res.status).toBe(200);

    const updated = await prisma.incident.findUnique({ where: { id: incident.id } });
    expect(updated?.assignedAgencyId).toBe(agency.id);
    expect(updated?.status).toBe("ASSIGNED");
  });
});
