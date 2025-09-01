import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

const { Client } = pg;

export default async function globalTeardown() {
  console.log('\n Cleaning up test environment...\n');

  // Load test environment
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

  // Parse database URL
  const dbUrl = process.env.DATABASE_URL;
  const matches = dbUrl?.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (!matches) {
    console.warn('  Could not parse DATABASE_URL for cleanup');
    return;
  }

  const [, user, password, host, port, database] = matches;

  // Connect to postgres database to drop test database
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();

    // Drop test database
    console.log(`  Dropping test database ${database}...`);
    await client.query(`DROP DATABASE IF EXISTS ${database}`);

    await client.end();
    
    console.log('\n Test environment cleaned up!\n');
  } catch (error) {
    console.error('  Failed to cleanup test database:', error);
    // Don't throw - we don't want to fail tests because of cleanup
  }
}
