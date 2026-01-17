import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;

// Manually load .env from backend root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    await client.connect();

    console.log('Querying Staff Info (via pg)...');

    const query = `
    SELECT 
        u.email, 
        u."fullName",
        a.name as "agencyName", 
        a.type as "agencyType", 
        a.city,
        sc.name as "primarySubCity",
        w.name as "primaryWoreda"
    FROM "User" u
    JOIN "AgencyStaff" ast ON u.id = ast."userId"
    JOIN "Agency" a ON ast."agencyId" = a.id
    LEFT JOIN "SubCity" sc ON a."subCityId" = sc.id
    LEFT JOIN "Woreda" w ON a."woredaId" = w.id
    WHERE u.email = $1
  `;

    // Check for police@georise.com by default
    const email = 'police@georise.com';
    const res = await client.query(query, [email]);

    if (res.rows.length === 0) {
        console.log(`No staff found for email: ${email}`);
    } else {
        console.log('Staff Details:', res.rows[0]);
    }

    await client.end();
}

main().catch(console.error);
