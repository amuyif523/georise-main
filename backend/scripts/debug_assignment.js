import pg from 'pg';

const { Client } = pg;
const client = new Client({
  connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public',
});

async function main() {
  await client.connect();

  // Get Incident 1212 details
  const incidentRes = await client.query(`
    SELECT id, title, status, "assignedAgencyId", category 
    FROM "Incident" 
    WHERE id = 1212
  `);

  // Get Staff1 Agency details
  const staffRes = await client.query(`
    SELECT u.email, s."agencyId", a.name as "agencyName", a.type as "agencyType"
    FROM "User" u
    JOIN "AgencyStaff" s ON u.id = s."userId"
    JOIN "Agency" a ON s."agencyId" = a.id
    WHERE u.email = 'staff1@example.com'
  `);

  console.log('Incident:', incidentRes.rows[0]);
  console.log('Staff1:', staffRes.rows[0]);

  if (incidentRes.rows[0] && staffRes.rows[0]) {
    const match = incidentRes.rows[0].assignedAgencyId === staffRes.rows[0].agencyId;
    console.log('Match?', match);
  }

  await client.end();
}

main().catch(console.error);
