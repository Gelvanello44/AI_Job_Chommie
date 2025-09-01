import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  console.log('\n Setting up test environment...\n');

  // Load test environment
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

  try {
    // Setup test database
    console.log(' Creating test database...');
    execSync('node scripts/setup-test-db.js', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('\n Test environment ready!\n');
  } catch (error) {
    console.error(' Failed to setup test environment:', error);
    throw error;
  }
}
