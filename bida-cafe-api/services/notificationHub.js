class NotificationHub {
  constructor() {
    this.clients = new Map();
    this.sequence = 1;
  }

  registerClient(req, res) {
    const clientId = this.sequence++;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
    }, 25000);

    this.clients.set(clientId, { res, heartbeat });

    req.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(clientId);
    });
  }

  broadcast(event, payload) {
    const body = `data: ${JSON.stringify({ type: event, data: payload })}\n\n`;
    console.log(`[DEBUG] Broadcasting event "${event}" to ${this.clients.size} clients`);

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.res.write(body);
      } catch (error) {
        clearInterval(client.heartbeat);
        this.clients.delete(clientId);
      }
    }
  }
}

module.exports = { NotificationHub };
