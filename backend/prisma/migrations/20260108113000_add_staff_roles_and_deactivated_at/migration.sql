-- Add StaffRole enum
CREATE TYPE "StaffRole" AS ENUM ('DISPATCHER', 'RESPONDER', 'SUPERVISOR');

-- Add user deactivation tracking
ALTER TABLE "User" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

-- Extend agency staff with role + status flags
ALTER TABLE "AgencyStaff"
  ADD COLUMN "staffRole" "StaffRole" NOT NULL DEFAULT 'DISPATCHER',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deactivatedAt" TIMESTAMP(3);
