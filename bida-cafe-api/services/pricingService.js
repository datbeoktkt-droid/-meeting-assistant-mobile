const { toNumber } = require('../utils/common');

async function getCurrentPricePerHour(client) {
  const now = new Date();
  const isWeekend = now.getDay() === 0;
  const currentTime = now.toTimeString().slice(0, 8);

  const activeConfig = await client.query(
    `SELECT price_per_hour
     FROM public.price_configs
     WHERE is_weekend = $1
       AND (
         (start_time <= end_time AND $2::time >= start_time AND $2::time < end_time)
         OR
         (start_time > end_time AND ($2::time >= start_time OR $2::time < end_time))
       )
     ORDER BY config_id ASC
     LIMIT 1`,
    [isWeekend, currentTime]
  );

  if (activeConfig.rowCount > 0) {
    return toNumber(activeConfig.rows[0].price_per_hour, 50000);
  }

  const fallbackConfig = await client.query(
    'SELECT price_per_hour FROM public.price_configs ORDER BY is_weekend DESC, config_id ASC LIMIT 1'
  );

  return fallbackConfig.rowCount > 0
    ? toNumber(fallbackConfig.rows[0].price_per_hour, 50000)
    : 50000;
}

module.exports = { getCurrentPricePerHour };
