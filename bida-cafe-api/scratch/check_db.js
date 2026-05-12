const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkOrders() {
  try {
    const res = await pool.query(`
      SELECT o.order_id, o.session_id, o.status, o.order_type, bt.table_number 
      FROM public.orders o 
      JOIN public.billiard_sessions bs ON bs.session_id = o.session_id 
      JOIN public.billiard_tables bt ON bt.table_id = bs.table_id 
      WHERE bt.table_number = '2' AND bs.status = 'ACTIVE'
    `);
    console.log('--- ORDERS FOR TABLE 2 (ACTIVE SESSION) ---');
    console.log(JSON.stringify(res.rows, null, 2));
    
    const res2 = await pool.query(`
      SELECT session_id, table_id, status FROM public.billiard_sessions 
      WHERE table_id = (SELECT table_id FROM public.billiard_tables WHERE table_number = '2')
      ORDER BY session_id DESC LIMIT 5
    `);
    console.log('--- RECENT SESSIONS FOR TABLE 2 ---');
    console.log(JSON.stringify(res2.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

checkOrders();
