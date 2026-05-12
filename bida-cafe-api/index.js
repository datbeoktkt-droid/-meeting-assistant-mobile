const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const { createAdminAuthRouter } = require('./routes/adminAuthRoutes');
const { createAdminMainRouter } = require('./routes/admin/index');
const { createAppRouter } = require('./routes/appRoutes');
const { createCoreRouter } = require('./routes/coreRoutes');
const { createLoyaltyRouter } = require('./routes/loyaltyRoutes');
const { createDashboardRouter } = require('./routes/dashboardRoutes');
const { createBookingRouter } = require('./routes/bookingRoutes');
const { createNotificationRouter } = require('./routes/notificationRoutes');
const { createDocsRouter } = require('./routes/docsRoutes');

const { NotificationHub } = require('./services/notificationHub');
const { createBackgroundJobs } = require('./services/backgroundJobs');
const { ensureSchema } = require('./services/schemaService');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const app = express();

// Middleware CORS
// Middleware CORS - Toi uu cho Flutter Web
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Length, X-JSON');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const notificationHub = new NotificationHub();
const backgroundJobs = createBackgroundJobs({ pool, notificationHub });

// --- ROUTES ---

// 1. Auth & Public
app.use('/api/admin/auth', createAdminAuthRouter({ pool }));
app.use('/api/notifications', createNotificationRouter({ notificationHub }));
app.use('/api/docs', createDocsRouter());

// 2. Admin APIs (Modular)
app.use('/api/admin', createAdminMainRouter({ pool, notificationHub }));

// 3. Application APIs
app.use('/api/app', createAppRouter({ pool, notificationHub }));
app.use('/api', createCoreRouter({ pool, notificationHub }));
app.use('/api/membership', createLoyaltyRouter({ pool }));
app.use('/api/dashboard', createDashboardRouter({ pool }));
app.use('/api/bookings', createBookingRouter({ pool, notificationHub }));

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  await ensureSchema(pool);
  backgroundJobs.start();
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`   SERVER BIDA CAFE READY ON PORT ${PORT}`);
    console.log(`=========================================`);
  });
}

bootstrap().catch((error) => {
  console.error('CRITICAL STARTUP ERROR:', error);
  process.exit(1);
});
