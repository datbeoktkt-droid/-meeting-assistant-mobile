async function writeActivityLog(poolOrClient, { staffId = null, actionType, description, ipAddress = null }) {
  try {
    await poolOrClient.query(
      `INSERT INTO public.activity_logs (staff_id, action_type, description, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [staffId, actionType, description, ipAddress]
    );
  } catch (error) {
    console.error('activity log error:', error.message);
  }
}

module.exports = { writeActivityLog };
