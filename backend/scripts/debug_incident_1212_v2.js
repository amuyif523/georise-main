import pg from 'pg';

const { Client } = pg;
const client = new Client({
    connectionString: 'postgresql://georisem:georisem123@localhost:54320/georisem_db?schema=public'
});

async function main() {
    await client.connect();

    const res = await client.query(`
    SELECT id, title, status, "reviewStatus", category 
    FROM "Incident" 
    WHERE id = 1212
  `);

    console.log('Incident 1212 Details:', JSON.stringify(res.rows[0], null, 2));
    await client.end();
}

main().catch(console.error);
