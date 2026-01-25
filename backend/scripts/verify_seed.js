import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public',
});

async function main() {
  await client.connect();

  console.log('Verifying Seed Data (via pg)...');

  const users = await client.query(`
    SELECT email, role FROM "User" 
    WHERE email IN ('admin@example.com', 'citizen@georise.com', 'police@georise.com', 'fire@georise.com')
  `);

  const agencies = await client.query(`
    SELECT name, type FROM "Agency"
  `);

  const incidents = await client.query(`
    SELECT title, category FROM "Incident"
  `);

  console.log('Users Found:', users.rows);
  console.log('Agencies Found:', agencies.rows);
  console.log('Incidents count:', incidents.rowCount);

  await client.end();
}

main().catch(console.error);
