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

CREATE INDEX IF NOT EXISTS idx_table_bookings_table_time
ON public.table_bookings (table_id, booking_start, booking_end);

CREATE INDEX IF NOT EXISTS idx_table_bookings_status_start
ON public.table_bookings (status, booking_start);
