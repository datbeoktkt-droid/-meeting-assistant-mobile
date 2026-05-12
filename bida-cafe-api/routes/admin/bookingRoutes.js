const express = require('express');
const asyncHandler = require('../../middlewares/asyncHandler');
const bookingService = require('../../services/bookingService');
const { requireAuth } = require('../../middlewares/authMiddleware');
const { writeActivityLog } = require('../../services/activityLogService');
const { withTransaction } = require('../../utils/dbHelper');

function createBookingRouter({ pool, notificationHub }) {
  const router = express.Router();

  const log = async (req, type, desc) => {
    await writeActivityLog(pool, {
      staffId: req.auth.staff_id, actionType: type, description: desc, ipAddress: req.ip,
    });
  };

  router.use(requireAuth);

  router.get('/', asyncHandler(async (req, res) => {
    const list = await bookingService.getBookings(pool, req.query);
    res.json(list);
  }));

  router.patch('/:id', asyncHandler(async (req, res) => {
    const booking = await bookingService.updateBooking(pool, req.params.id, req.body);
    if (!booking) return res.status(404).json({ error: 'Khong tim thay booking' });
    
    await log(req, 'BOOKING_UPDATE', `Cap nhat booking ID ${req.params.id}`);
    notificationHub.broadcast('booking:updated', booking);
    res.json({ success: true, booking });
  }));

  router.post('/:id/check-in', asyncHandler(async (req, res) => {
    const booking = await withTransaction(pool, async (client) => {
      return await bookingService.checkIn(client, req.params.id);
    });

    if (!booking) return res.status(404).json({ error: 'Khong tim thay booking' });

    await log(req, 'BOOKING_CHECKIN', `Check-in cho booking ID ${req.params.id}`);
    notificationHub.broadcast('table:status_updated', { table_id: booking.table_id, status: 'OCCUPIED' });
    notificationHub.broadcast('booking:updated', booking);

    res.json({ success: true, booking });
  }));

  return router;
}

module.exports = { createBookingRouter };
