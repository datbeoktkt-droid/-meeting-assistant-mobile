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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.payment_receivers (
        receiver_id SERIAL PRIMARY KEY,
        display_name VARCHAR(100) NOT NULL,
        bank_name VARCHAR(100) NOT NULL,
        bank_code VARCHAR(30) NOT NULL DEFAULT '',
        account_name VARCHAR(120) NOT NULL,
        account_number VARCHAR(50) NOT NULL,
        qr_code_url TEXT,
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

    await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_receivers_account_unique
    ON public.payment_receivers (bank_name, account_number);
  `);

  await pool.query(`
    ALTER TABLE public.payment_receivers
    ADD COLUMN IF NOT EXISTS bank_code VARCHAR(30) NOT NULL DEFAULT '';
  `);

  await pool.query(`
    INSERT INTO public.payment_receivers (
      display_name, bank_name, bank_code, account_name, account_number, qr_code_url, notes, is_active, sort_order
    )
    VALUES (
      'Vietcombank',
      'Vietcombank',
      'VIETCOMBANK',
      'Nguyen Quoc Dat',
      '1023165478',
      NULL,
      'Tai khoan chuyen khoan mac dinh',
      TRUE,
      1
    )
    ON CONFLICT (bank_name, account_number) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        bank_code = EXCLUDED.bank_code,
        account_name = EXCLUDED.account_name,
        qr_code_url = EXCLUDED.qr_code_url,
        notes = EXCLUDED.notes,
        is_active = TRUE,
        sort_order = LEAST(public.payment_receivers.sort_order, EXCLUDED.sort_order),
        updated_at = NOW();
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_payment_receivers_active_sort
    ON public.payment_receivers (is_active, sort_order, receiver_id);
  `);

  await pool.query(`
    ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS kitchen_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
  `);

  await pool.query(`
    ALTER TABLE public.order_details
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_orders_kitchen_status_created
    ON public.orders (kitchen_status, created_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_order_details_order_status
    ON public.order_details (order_id, status);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.categories (
      category_id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate existing distinct categories from products if any exist and table is empty
  await pool.query(`
    INSERT INTO public.categories (name)
    SELECT DISTINCT category FROM public.products WHERE category IS NOT NULL AND category != ''
    ON CONFLICT (name) DO NOTHING;
  `);
}

module.exports = { ensureSchema };
