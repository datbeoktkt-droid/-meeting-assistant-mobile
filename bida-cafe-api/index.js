const express = require('express');
const path = require('path');
require('dotenv').config();

const { pool } = require('./db');
const { NotificationHub } = require('./services/notificationHub');
const { ensureSchema } = require('./services/schemaService');
const { createBackgroundJobs } = require('./services/backgroundJobs');
const { createCoreRouter } = require('./routes/coreRoutes');
const { createLoyaltyRouter } = require('./routes/loyaltyRoutes');
const { createDashboardRouter } = require('./routes/dashboardRoutes');
const { createBookingRouter } = require('./routes/bookingRoutes');
const { createNotificationRouter } = require('./routes/notificationRoutes');
const { createAdminAuthRouter } = require('./routes/adminAuthRoutes');
const { createAdminRouter } = require('./routes/adminRoutes');
const { createKitchenRouter } = require('./routes/kitchenRoutes');
const { createAppRouter } = require('./routes/appRoutes');
const { createDocsRouter } = require('./routes/docsRoutes');
const { createMenuRouter } = require('./routes/menuRoutes');

const app = express();
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const notificationHub = new NotificationHub();

const backgroundJobs = createBackgroundJobs({ pool, notificationHub });

app.use('/api/app', createAppRouter({ pool, notificationHub }));
app.use('/api', createCoreRouter({ pool, notificationHub }));
app.use('/api/membership', createLoyaltyRouter({ pool }));
app.use('/api/dashboard', createDashboardRouter({ pool }));
app.use('/api/bookings', createBookingRouter({ pool, notificationHub }));
app.use('/api/notifications', createNotificationRouter({ notificationHub }));
app.use('/api/admin/auth', createAdminAuthRouter({ pool }));
app.use('/api/admin', createAdminRouter({ pool, notificationHub }));
app.use('/api/admin/kitchen', createKitchenRouter({ pool, notificationHub }));
app.use('/api/docs', createDocsRouter());
app.use('/api/admin/menu', createMenuRouter({ pool }));

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await ensureSchema(pool);
  await backgroundJobs.processBookings();
  await backgroundJobs.monitorWallets();
  backgroundJobs.start();

  app.listen(PORT, () => console.log(`Server ready at: ${PORT}`));
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error.message);
  process.exit(1);
});
