const { Pool } = require('pg');
const config = require('../src/config');

const isProduction = config.nodeEnv === 'production' || process.env.DATABASE_URL?.includes('sslmode=require');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
