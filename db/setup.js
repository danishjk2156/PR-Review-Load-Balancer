require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function setup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is not defined in your .env file.');
    process.exit(1);
  }

  // Parse target DB name from DATABASE_URL
  const urlObj = new URL(databaseUrl);
  const targetDbName = urlObj.pathname.replace(/^\//, '') || 'pr_load_balancer';

  // 1. Connect to default 'postgres' database to ensure target DB exists
  urlObj.pathname = '/postgres';
  const rootConnString = urlObj.toString();

  console.log(`Connecting to default Postgres service to check for database '${targetDbName}'...`);
  const rootPool = new Pool({ connectionString: rootConnString });

  try {
    const res = await rootPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [targetDbName]
    );

    if (res.rows.length === 0) {
      console.log(`Database '${targetDbName}' does not exist. Creating it now...`);
      await rootPool.query(`CREATE DATABASE "${targetDbName}"`);
      console.log(`✅ Database '${targetDbName}' created!`);
    } else {
      console.log(`Database '${targetDbName}' already exists.`);
    }
  } catch (err) {
    console.warn(`Note when checking database creation: ${err.message}`);
  } finally {
    await rootPool.end();
  }

  // 2. Connect to the target database and execute schema.sql
  console.log(`Connecting to database '${targetDbName}'...`);
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Executing db/schema.sql...');
    await pool.query(schemaSql);
    console.log('🎉 Success: Database schema, tables, and review_load view created successfully!');
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

setup();
