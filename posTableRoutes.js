router.post('/table/start', async (req, res) => {
  const { tableId } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Kiểm tra bàn đã có session ACTIVE chưa
    const existingSession = await client.query(
      `SELECT session_id
       FROM public.billiard_sessions
       WHERE table_id = $1
         AND status = 'ACTIVE'
       LIMIT 1`,
      [tableId]
    );

    if (existingSession.rowCount > 0) {
      throw new Error('Ban dang co phien choi hoat dong');
    }

    // Tạo session không cần user
    const sessionResult = await client.query(
      `INSERT INTO public.billiard_sessions
       (table_id, user_id, start_time, status)
       VALUES ($1, NULL, NOW(), 'ACTIVE')
       RETURNING session_id`,
      [tableId]
    );

    // Cập nhật trạng thái bàn
    await client.query(
      `UPDATE public.billiard_tables
       SET status = 'OCCUPIED'
       WHERE table_id = $1`,
      [tableId]
    );

    await client.query('COMMIT');

    notificationHub.broadcast('table:status_updated', {
      table_id: Number(tableId),
      status: 'OCCUPIED'
    });

    res.json({
      success: true,
      message: 'Da mo ban',
      session_id: sessionResult.rows[0].session_id,
      table_id: Number(tableId)
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});
