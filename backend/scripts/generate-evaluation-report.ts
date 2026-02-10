import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// Use pg directly to fallback if Prisma fails
const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public',
});

async function generateReport() {
  try {
    await client.connect();
    console.log('Successfully connected to DB via pg');
  } catch (e: any) {
    console.error('Failed to connect to DB', e);
    process.exit(1);
  }
  console.log('Generating evaluation report...');

  const {
    rows: [{ count: totalIncidents }],
  } = await client.query('SELECT COUNT(*) FROM "Incident"');

  const { rows: statusRows } = await client.query(
    'SELECT status, COUNT(*) as count FROM "Incident" GROUP BY status',
  );
  const incidentsByStatus = statusRows.map((row: any) => ({
    status: row.status,
    _count: { id: parseInt(row.count) || 0 },
  }));

  const {
    rows: [{ count: totalUsers }],
  } = await client.query('SELECT COUNT(*) FROM "User"');

  // Verified users: those with a related CitizenVerification record with status VERIFIED
  const {
    rows: [{ count: verifiedUsers }],
  } = await client.query(`
        SELECT COUNT(*) FROM "User" u 
        JOIN "CitizenVerification" v ON u.id = v."userId" 
        WHERE v.status = 'VERIFIED'
    `);

  // Avg Resolution Time (MTTR)
  // Diff between resolvedAt and reportedAt
  const {
    rows: [{ avg_resolution_hours }],
  } = await client.query(`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "reportedAt"))/3600) as avg_resolution_hours 
        FROM "Incident" 
        WHERE "resolvedAt" IS NOT NULL
    `);

  const { rows: severityRows } = await client.query(
    'SELECT "severityScore", COUNT(*) as count FROM "Incident" GROUP BY "severityScore"',
  );
  const incidentsBySeverity = severityRows.map((row: any) => ({
    severityScore: row.severityScore,
    _count: { id: parseInt(row.count) || 0 },
  }));

  const report = `
# System Evaluation Report
Generated: ${new Date().toISOString()}

## Executive Summary
- **Total Incidents**: ${totalIncidents}
- **Total Users**: ${totalUsers}
- **Verified Citizens**: ${verifiedUsers}
- **Average Resolution Time (MTTR)**: ${parseFloat(avg_resolution_hours + '').toFixed(2)} hours

## Incident Status Distribution
${incidentsByStatus.map((s: any) => `- ${s.status}: ${s._count.id}`).join('\n')}

## Severity Analysis
${incidentsBySeverity.map((s: any) => `- Severity ${s.severityScore}: ${s._count.id}`).join('\n')}

## Recommendations
1. Focus on reducing MTTR for high-severity incidents.
2. Increase campaign for citizen verification to boost "Gold Tier" reporters.
3. Monitor "Crisis Mode" usage to ensure it is not overused.
`;

  const outputPath = path.join(__dirname, '../../evaluation_report.md');
  await fs.writeFile(outputPath, report.trim());
  console.log(`Report generated at: ${outputPath}`);
  await client.end();
}

generateReport().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
