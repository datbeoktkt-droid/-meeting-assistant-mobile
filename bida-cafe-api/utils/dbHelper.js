/**
 * [DB HELPER]
 * Cac ham tien ich lien quan den Database
 */

/**
 * withTransaction
 * Tu dong quan ly BEGIN, COMMIT va ROLLBACK.
 * @param {Pool} pool - Connection pool cua pg
 * @param {Function} callback - Ham chua logic truy van (nhan vao client)
 */
async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
