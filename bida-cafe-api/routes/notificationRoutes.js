const express = require('express');

function createNotificationRouter({ notificationHub }) {
  const router = express.Router();

  router.get('/stream', (req, res) => {
    console.log('[SSE] New client connected');
    notificationHub.registerClient(req, res);
  });

  return router;
}

module.exports = { createNotificationRouter };
