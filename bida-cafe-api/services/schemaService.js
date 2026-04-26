async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.table_bookings (
      booking_id SERIAL PRIMARY KEY,
      table_id INTEGER NOT NULL REFERENCES public.billiard_tables(table_id) ON DELETE CASCADE,
      user_id INTEGER NULL REFERENCES public.users(user_id) ON DELETE SET NULL,
      customer_name VARCHAR(100),
      customer_phone VARCHAR(20),
      booking_start TIMESTAMP NOT NULL,
      booking_end TIMESTAMP NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      notes TEXT,
      checked_in_at TIMESTAMP NULL,
      cancelled_at TIMESTAMP NULL,
      expired_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_table_bookings_table_time
    ON public.table_bookings (table_id, booking_start, booking_end);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_table_bookings_status_start
    ON public.table_bookings (status, booking_start);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.auth_refresh_tokens (
      refresh_id SERIAL PRIMARY KEY,
      staff_id INTEGER NOT NULL REFERENCES public.staff(staff_id) ON DELETE CASCADE,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NULL,
      ip_address VARCHAR(45),
      user_agent TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_staff
    ON public.auth_refresh_tokens (staff_id, expires_at, revoked_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_auth_refresh_tokens (
      refresh_id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      token_hash VARCHAR(128) NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NULL,
      device_name VARCHAR(100),
      user_agent TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_auth_refresh_tokens_user
    ON public.user_auth_refresh_tokens (user_id, expires_at, revoked_at);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.wallet_topup_requests (
      request_id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
      amount NUMERIC(12,2) NOT NULL,
      payment_method VARCHAR(20),
      note TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      reviewed_by INTEGER NULL REFERENCES public.staff(staff_id) ON DELETE SET NULL,
      reviewed_at TIMESTAMP NULL,
      reject_reason TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_wallet_topup_requests_user
    ON public.wallet_topup_requests (user_id, status, created_at);
  `);
}

module.exports = { ensureSchema };
