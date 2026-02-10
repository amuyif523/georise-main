import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

// Use a direct instance to avoid importing src/prisma.ts which brings in Redis/Metrics dependencies
const prisma = new PrismaClient();

async function generateReport() {
  console.log('Generating evaluation report...');

  const totalIncidents = await prisma.incident.count();
  const incidentsByStatus = await prisma.incident.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const incidentsBySeverity = await prisma.incident.groupBy({
    by: ['severityScore'],
    _count: { id: true },
  });

  const report = `
# System Evaluation Report
Generated at: ${new Date().toISOString()}

## Incident Metrics
- **Total Incidents**: ${totalIncidents}

### By Status
${incidentsByStatus.map((g) => `- **${g.status}**: ${g._count.id}`).join('\n')}

### By Severity
${incidentsBySeverity.map((g) => `- **Severity ${g.severityScore ?? 'N/A'}**: ${g._count.id}`).join('\n')}

## AI Performance
(Note: Real-time accuracy metrics should be viewed in the Agency Dashboard)

## System Health
- Database Connection: OK
- Prisma Client: OK
`;

  const outputPath = path.join(__dirname, '../../evaluation_report.md');
  await fs.writeFile(outputPath, report.trim());
  console.log(`Report generated at: ${outputPath}`);
}

generateReport()
  .catch((e) => {
    console.error('FULL ERROR:', JSON.stringify(e, null, 2));
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
