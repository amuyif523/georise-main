import prisma from '../../src/prisma';
import redis from '../../src/redis';

const TABLES = [
  'Notification',
  'BroadcastLog',
  'ActivityLog',
  'IncidentChat',
  'SharedIncident',
  'IncidentStatusHistory',
  'IncidentAIOutput',
  'Incident',
  'Responder',
  'AgencyJurisdiction',
  'DispatchRule',
  'AgencyStaff',
  'Agency',
  'CitizenVerification',
  'AuditLog',
  'SystemConfig',
  'User',
  'SubCity',
  'Woreda',
];

export const resetDatabase = async () => {
  const quoted = TABLES.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
  await redis.flushall();
};
