import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envPath = path.join(process.cwd(), '.env');

function rotateSecrets() {
  if (!fs.existsSync(envPath)) {
    console.error('.env file not found. Please create it from .env.example first.');
    return;
  }

  let content = fs.readFileSync(envPath, 'utf8');

  const newSecret = crypto.randomBytes(32).toString('hex');
  const newRefreshSecret = crypto.randomBytes(32).toString('hex');

  content = content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${newSecret}`);
  content = content.replace(/JWT_REFRESH_SECRET=.*/, `JWT_REFRESH_SECRET=${newRefreshSecret}`);

  fs.writeFileSync(envPath, content);
  console.log('✅ JWT Secrets rotated successfully in .env');
  console.log('⚠️  All existing sessions are now invalid. Users must log in again.');
}

rotateSecrets();
