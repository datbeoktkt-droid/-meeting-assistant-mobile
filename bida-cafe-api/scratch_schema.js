require('dotenv').config();
const { pool } = require('./db');

async function getDB() {
  try {
    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("TABLES:", tables.rows);
  } catch (e) { console.error(e); } finally { pool.end(); }
}
getDB();