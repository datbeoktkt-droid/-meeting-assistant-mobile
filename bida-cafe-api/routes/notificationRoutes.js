const express = require('express');

function createNotificationRouter({ notificationHub }) {
  const router = express.Router();

  router.get('/stream', (req, res) => {
    notificationHub.registerClient(req, res);
  });

  return router;
}

module.exports = { createNotificationRouter };
