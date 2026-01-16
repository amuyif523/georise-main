import pg from 'pg';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public'
});

async function main() {
    await client.connect();

    const res = await client.query(`
    SELECT u.id, u.email, u.role, s."agencyId", a.name, a.type
    FROM "User" u
    LEFT JOIN "AgencyStaff" s ON u.id = s."userId"
    LEFT JOIN "Agency" a ON s."agencyId" = a.id
    WHERE u.email = 'staff1@example.com'
  `);

    console.log('Result:', res.rows[0]);
    await client.end();
}

main().catch(console.error);
