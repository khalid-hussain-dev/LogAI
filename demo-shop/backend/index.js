require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// LogAI Integration Logger
const logToLogAI = async (level, message, meta = {}) => {
  const LOGAI_URL = process.env.LOGAI_API_URL;
  const LOGAI_KEY = process.env.LOGAI_API_KEY;
  if (!LOGAI_URL || !LOGAI_KEY) {
    console.log(`[${level.toUpperCase()}] ${message}`);
    return;
  }
  try {
    await axios.post(`${LOGAI_URL}/api/v1/logs/ingest`, {
      level,
      message,
      service: 'demo-shop-backend',
      meta
    }, {
      headers: {
        'x-api-key': LOGAI_KEY
      }
    });
  } catch (error) {
    console.error('Failed to send log to LogAI:', error.message);
  }
};

// Global Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (res.statusCode >= 500) {
      logToLogAI('error', `${req.method} ${req.url} failed with ${res.statusCode}`, { duration, method: req.method, url: req.url });
    } else if (res.statusCode >= 400) {
      logToLogAI('warn', `${req.method} ${req.url} returned ${res.statusCode}`, { duration, method: req.method, url: req.url });
    } else {
      logToLogAI('info', `${req.method} ${req.url} processed successfully`, { duration, method: req.method, url: req.url });
    }
  });
  next();
});

// Chaos State
let dbLocked = false;
let paymentOutage = false;

// Chaos Endpoints
app.post('/api/chaos/toggle-db-lock', (req, res) => {
  dbLocked = !dbLocked;
  logToLogAI('warn', `Database lock chaos toggled: ${dbLocked}`, { dbLocked });
  res.json({ dbLocked });
});

app.post('/api/chaos/toggle-payment-outage', (req, res) => {
  paymentOutage = !paymentOutage;
  logToLogAI('warn', `Payment outage chaos toggled: ${paymentOutage}`, { paymentOutage });
  res.json({ paymentOutage });
});

app.post('/api/chaos/crash', (req, res) => {
  logToLogAI('critical', `Manual fatal crash initiated by admin!`, { reason: 'chaos_button' });
  res.json({ message: 'Crashing the server in 500ms...' });
  setTimeout(() => {
    process.exit(1);
  }, 500);
});

// E-commerce Routes
const products = [
  { id: 1, name: 'LogAI T-Shirt', price: 25.00 },
  { id: 2, name: 'Chaos Engineering Mug', price: 15.00 },
  { id: 3, name: 'SRE Hoodie', price: 55.00 }
];

app.get('/api/products', (req, res) => {
  res.json(products);
});

app.post('/api/checkout', async (req, res) => {
  const { cart, total } = req.body;
  
  // 1. Simulate DB lock latency
  if (dbLocked) {
    logToLogAI('warn', 'Checkout API experiencing high latency due to database lock on orders table', { latency: 5000 });
    await new Promise(resolve => setTimeout(resolve, 5000));
  } else {
    // Normal latency
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // 2. Simulate Payment Outage
  if (paymentOutage) {
    logToLogAI('error', 'Checkout failed: Payment gateway timeout while processing transaction intent', { cart_size: cart.length, total });
    return res.status(502).json({ error: 'Payment gateway error' });
  }

  // Success
  logToLogAI('info', 'Checkout successful', { total, items: cart.length });
  res.json({ success: true, orderId: `ORD-${Date.now()}` });
});

app.listen(PORT, () => {
  console.log(`Demo Shop Backend running on port ${PORT}`);
  logToLogAI('info', `Demo Shop Backend started on port ${PORT}`);
});
