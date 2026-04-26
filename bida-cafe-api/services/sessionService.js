async function startTableSession(client, { tableId, userId, allowReserved = false }) {
  const tableResult = await client.query(
    'SELECT table_id, status FROM public.billiard_tables WHERE table_id = $1 FOR UPDATE',
    [tableId]
  );

  if (tableResult.rowCount === 0) {
    throw new Error('Khong tim thay ban');
  }

  const currentStatus = tableResult.rows[0].status;
  if (currentStatus === 'OCCUPIED') {
    throw new Error('Ban dang duoc su dung');
  }

  if (currentStatus === 'RESERVED' && !allowReserved) {
    throw new Error('Ban dang duoc dat truoc');
  }

  await client.query(
    'UPDATE public.billiard_tables SET status = $1 WHERE table_id = $2',
    ['OCCUPIED', tableId]
  );
  await client.query(
    `INSERT INTO public.billiard_sessions (table_id, user_id, start_time, status)
     VALUES ($1, $2, NOW(), $3)`,
    [tableId, userId, 'ACTIVE']
  );
}

module.exports = { startTableSession };
