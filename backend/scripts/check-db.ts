import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  console.log('Checking DB State (Adapter Mode)...');

  const agencies = await prisma.agency.findMany();
  const users = await prisma.user.findMany({
    where: { email: { in: ['police@georise.com', 'police_unit@georise.com'] } },
  });
  const staff = await prisma.agencyStaff.findMany({
    where: { userId: { in: users.map((u) => u.id) } },
  });
  const responders = await prisma.responder.findMany();

  const output = {
    agencies: agencies.map((a) => ({ id: a.id, name: a.name })),
    users: users.map((u) => ({ id: u.id, email: u.email })),
    staff: staff.map((s) => ({ userId: s.userId, agencyId: s.agencyId, role: s.staffRole })),
    responders: responders.map((r) => ({ id: r.id, name: r.name, agencyId: r.agencyId })),
  };
  fs.writeFileSync('db_state.json', JSON.stringify(output, null, 2));
  console.log('Written detailed state to db_state.json');

  // Check specific linkage for police dispatcher
  const dispatcher = users.find((u) => u.email === 'police@georise.com');
  if (dispatcher) {
    const dStaff = staff.find((s) => s.userId === dispatcher.id);
    if (dStaff) {
      const agencyResponders = responders.filter((r) => r.agencyId === dStaff.agencyId);
      console.log(`Dispatcher Agency ID: ${dStaff.agencyId}`);
      console.log(`Responders in this Agency directly: ${agencyResponders.length}`);
    } else {
      console.log('Dispatcher has no staff record!');
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
