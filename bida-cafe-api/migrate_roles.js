// Script: Cap nhat role ADMIN -> MANAGER va BARISTA -> STAFF
// Chay 1 lan: node migrate_roles.js
require('dotenv').config();
const { pool } = require('./db');

async function migrate() {
  try {
    // Cap nhat ADMIN -> MANAGER
    const r1 = await pool.query(
      "UPDATE public.staff SET role = 'MANAGER' WHERE role = 'ADMIN' RETURNING staff_id, username, role"
    );
    console.log('ADMIN -> MANAGER:', r1.rows);

    // Cap nhat BARISTA -> STAFF (neu co)
    const r2 = await pool.query(
      "UPDATE public.staff SET role = 'STAFF' WHERE role NOT IN ('MANAGER','STAFF','CASHIER') RETURNING staff_id, username, role"
    );
    console.log('Role khac -> STAFF:', r2.rows);

    // Hien thi ket qua
    const all = await pool.query('SELECT staff_id, username, role, is_active FROM public.staff ORDER BY staff_id');
    console.log('\nDanh sach sau khi cap nhat:');
    console.table(all.rows);
  } catch (e) {
    console.error('Loi:', e.message);
  } finally {
    await pool.end();
  }
}

migrate();
