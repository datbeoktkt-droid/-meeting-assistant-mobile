const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    const res = await pool.query(`
      UPDATE public.billiard_sessions
      SET status = 'CANCELLED'
      WHERE status = 'ACTIVE' AND table_id IN (
        SELECT table_id FROM public.billiard_tables WHERE status != 'OCCUPIED'
      )
      RETURNING session_id;
    `);
    console.log(`Cleaned up ${res.rowCount} orphaned sessions:`, res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
