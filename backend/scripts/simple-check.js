import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function check() {
  try {
    console.log('Connecting to:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
    await client.connect();
    console.log('✅ Connected successfully to Postgres');
    const res = await client.query('SELECT NOW()');
    console.log('Time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('❌ Connection failed:', err);
    process.exit(1);
  }
}

check();
