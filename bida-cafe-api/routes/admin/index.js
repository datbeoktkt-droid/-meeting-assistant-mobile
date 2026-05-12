const express = require('express');
const { createStaffRouter } = require('./staffRoutes');
const { createMemberRouter } = require('./memberRoutes');
const { createTableRouter } = require('./tableRoutes');
const { createProductRouter } = require('./productRoutes');
const { createBookingRouter } = require('./bookingRoutes');
const { createTopupRouter } = require('./topupRoutes');
const { createReportRouter } = require('./reportRoutes');
const { createMiscRouter } = require('./miscRoutes');
const { createKitchenRouter } = require('../kitchenRoutes');
const { createMenuRouter } = require('../menuRoutes');

const { requireAuth } = require('../../middlewares/authMiddleware');

/**
 * [ADMIN MAIN ROUTER]
 * Gom tat ca cac domain nho vao day
 */
function createAdminMainRouter({ pool, notificationHub }) {
  const router = express.Router();

  // Bat buoc tat ca route admin phai dang nhap
  router.use(requireAuth);

  // /api/admin/staff
  router.use('/staff', createStaffRouter({ pool }));

  // /api/admin/members
  router.use('/members', createMemberRouter({ pool }));

  // /api/admin/tables
  router.use('/tables', createTableRouter({ pool, notificationHub }));

  // /api/admin/products
  router.use('/products', createProductRouter({ pool }));

  // /api/admin/bookings
  router.use('/bookings', createBookingRouter({ pool, notificationHub }));

  // /api/admin/topup-requests
  router.use('/topup-requests', createTopupRouter({ pool, notificationHub }));

  // /api/admin/reports
  router.use('/reports', createReportRouter({ pool }));

  // /api/admin/kitchen
  router.use('/kitchen', createKitchenRouter({ pool, notificationHub }));

  // /api/admin/menu
  router.use('/menu', createMenuRouter({ pool }));

  // /api/admin/misc (Pricing, Logs, etc.)
  router.use('/', createMiscRouter({ pool }));

  return router;
}

module.exports = { createAdminMainRouter };
