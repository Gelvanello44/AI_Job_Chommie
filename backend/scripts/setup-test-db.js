#!/usr/bin/env node

import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '../.env.test') });

const { Client } = pg;

async function setupTestDatabase() {
  console.log('Setting up test database...');

  // Parse database URL
  const dbUrl = process.env.DATABASE_URL;
  const matches = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  
  if (!matches) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = matches;

  // Connect to postgres database to create test database
  const client = new Client({
    host,
    port: parseInt(port),
    user,
    password,
    database: 'postgres',
  });

  try {
    await client.connect();

    // Drop existing test database if it exists
    console.log(`Dropping database ${database} if it exists...`);
    await client.query(`DROP DATABASE IF EXISTS ${database}`);

    // Create test database
    console.log(`Creating database ${database}...`);
    await client.query(`CREATE DATABASE ${database}`);

    await client.end();

    // Run Prisma migrations
    console.log('Running Prisma migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
      cwd: path.join(__dirname, '..'),
    });

    // Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    console.log(' Test database setup complete!');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupTestDatabase();
}

export { setupTestDatabase };
