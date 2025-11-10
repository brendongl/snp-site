/**
 * HTTP-to-HTTPS Webhook Bridge for Nintendo Switch
 *
 * This server accepts HTTP webhooks from Nintendo Switch homebrew
 * and forwards them to the HTTPS production endpoint.
 *
 * Deploy this on a service that supports HTTP (like Railway with a separate service)
 */

const express = require('express');
const axios = require('axios');
const app = express();

// Configuration
const PORT = process.env.PORT || 3001;
const FORWARD_TO_URL = process.env.FORWARD_TO_URL || 'https://sipnplay.cafe/api/switch-webhook';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware for browser testing
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} from ${req.ip}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'Nintendo Switch Webhook Bridge',
    mode: 'HTTP to HTTPS',
    forwardTo: FORWARD_TO_URL,
    httpEndpoint: `http://${req.headers.host}/webhook`,
    timestamp: new Date().toISOString()
  });
});

// Main webhook endpoint - accepts HTTP and forwards to HTTPS
app.post('/webhook', async (req, res) => {
  try {
    console.log('[WEBHOOK] Received from Switch:', JSON.stringify(req.body, null, 2));

    // Validate required fields
    const { action, title_name, title_id } = req.body;

    if (!action || !title_name) {
      console.error('[WEBHOOK] Missing required fields');
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: action and title_name'
      });
    }

    // Forward to HTTPS endpoint
    console.log(`[FORWARD] Sending to ${FORWARD_TO_URL}`);

    const response = await axios.post(FORWARD_TO_URL, req.body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': req.ip,
        'X-Original-Host': req.headers.host,
        'User-Agent': req.headers['user-agent'] || 'Switch-Webhook-Bridge/1.0'
      },
      timeout: 10000,
      // Ignore SSL certificate errors (if needed for development)
      httpsAgent: process.env.IGNORE_SSL === 'true' ?
        new (require('https').Agent)({ rejectUnauthorized: false }) :
        undefined
    });

    console.log(`[FORWARD] Success: ${response.status} - Notified ${response.data.clients || 0} clients`);

    // Return the response from the HTTPS endpoint
    res.status(response.status).json(response.data);

  } catch (error) {
    console.error('[ERROR]', error.message);

    if (error.response) {
      // Forward error from HTTPS endpoint
      console.error('[ERROR] Response:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // No response received
      console.error('[ERROR] No response from HTTPS endpoint');
      res.status(502).json({
        status: 'error',
        message: 'Failed to reach HTTPS endpoint',
        details: error.message
      });
    } else {
      // Other error
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Test endpoint - simulates a Switch webhook
app.post('/test', async (req, res) => {
  const testData = {
    serial: "XKK10006076602",
    hos_version: "20.4.0",
    ams_version: "1.9.4",
    action: "Launch",
    title_id: "0100000000010000",
    title_version: "1.3.0",
    title_name: "Test Game - Super Mario Odyssey",
    controller_count: 1
  };

  try {
    const response = await axios.post(`http://localhost:${PORT}/webhook`, testData);
    res.json({
      status: 'success',
      message: 'Test webhook sent',
      response: response.data
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Test failed',
      error: error.message
    });
  }
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('Nintendo Switch HTTP Webhook Bridge');
  console.log('='.repeat(60));
  console.log(`HTTP Server listening on port ${PORT}`);
  console.log(`Forwarding to: ${FORWARD_TO_URL}`);
  console.log('='.repeat(60));
  console.log('Endpoints:');
  console.log(`  Health Check: http://0.0.0.0:${PORT}/`);
  console.log(`  Webhook:      http://0.0.0.0:${PORT}/webhook`);
  console.log(`  Test:         http://0.0.0.0:${PORT}/test`);
  console.log(`  Stats:        http://0.0.0.0:${PORT}/stats`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});