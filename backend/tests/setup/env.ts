import dotenv from 'dotenv';
import path from 'node:path';

const backendRoot = path.resolve(__dirname, '../..');

dotenv.config({
  path: path.join(backendRoot, '.env'),
  override: true
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured for backend tests');
}
