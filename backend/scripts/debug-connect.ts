import 'dotenv/config';
import fs from 'fs';
import prisma from '../src/prisma';

function log(msg: string) {
  console.log(msg);
  fs.appendFileSync('debug-output.txt', msg + '\n');
}

async function main() {
  fs.writeFileSync('debug-output.txt', 'Starting debug-connect...\n');
  log('Running debug-connect...');

  let success = false;

  try {
    log('Attempting prisma.$connect()...');
    await prisma.$connect();
    log('✅ prisma.$connect() succeeded');
    success = true;
  } catch (e: any) {
    log(`❌ prisma.$connect() failed: ${e.message}`);
  }

  await prisma.$disconnect();

  if (success) {
    log('✅ Connected');
    process.exit(0);
  } else {
    log('❌ Failed');
    process.exit(1);
  }
}

main().catch((err) => {
  fs.appendFileSync('debug-output.txt', `Fatal error: ${err}\n`);
  process.exit(1);
});
