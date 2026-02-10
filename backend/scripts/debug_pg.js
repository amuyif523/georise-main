import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public',
});

async function main() {
  await client.connect();
  console.log('Connected');

  try {
    const res1 = await client.query('SELECT COUNT(*) FROM "Incident"');
    console.log('Incidents:', res1.rows[0]);

    const res2 = await client.query(
      'SELECT status, COUNT(*) as count FROM "Incident" GROUP BY status',
    );
    console.log('Status:', res2.rows);

    const res3 = await client.query('SELECT COUNT(*) FROM "User"');
    console.log('Users:', res3.rows[0]);

    const res4 = await client.query(`
        SELECT COUNT(*) FROM "User" u 
        JOIN "CitizenVerification" v ON u.id = v."userId" 
        WHERE v.status = 'VERIFIED'
      `);
    console.log('Verified:', res4.rows[0]);

    const res5 = await client.query(`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "reportedAt"))/3600) as avg_resolution_hours 
        FROM "Incident" 
        WHERE "resolvedAt" IS NOT NULL
      `);
    console.log('AVG:', res5.rows[0]);

    const res6 = await client.query(
      'SELECT "severityScore", COUNT(*) as count FROM "Incident" GROUP BY "severityScore"',
    );
    console.log('Severity:', res6.rows);
  } catch (e) {
    console.error('Query failed:', e);
  }

  await client.end();
}

main().catch(console.error);
