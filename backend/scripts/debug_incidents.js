import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public',
});

async function main() {
  await client.connect();

  const res = await client.query(`
    SELECT id, title, description, status, category, "severityScore", "reporterId", "createdAt"
    FROM "Incident"
    ORDER BY "createdAt" DESC
    LIMIT 5
  `);

  console.log('Recent Incidents:', res.rows);
  await client.end();
}

main().catch(console.error);
