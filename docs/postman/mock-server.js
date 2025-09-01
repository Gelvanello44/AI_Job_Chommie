const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mock data
let authToken = 'mock-jwt-token-123456';
let sessions = {};

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email && password) {
    res.json({
      token: authToken,
      user: {
        id: '123',
        email: email,
        name: 'Test User'
      }
    });
  } else {
    res.status(400).json({ error: 'Email and password required' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.includes(authToken)) {
    res.json({ valid: true, user: { id: '123', email: 'test@example.com' } });
  } else {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

// Payment endpoints
app.post('/api/payment', (req, res) => {
  const sessionId = 'cs_test_' + Date.now();
  sessions[sessionId] = {
    id: sessionId,
    status: 'open',
    payment_status: 'unpaid',
    ...req.body
  };
  
  res.json({
    url: `https://checkout.stripe.com/pay/${sessionId}`,
    sessionId: sessionId
  });
});

app.get('/api/payment/session/:sessionId', (req, res) => {
  const session = sessions[req.params.sessionId];
  if (session) {
    res.json({
      id: session.id,
      status: session.status || 'complete',
      payment_status: session.payment_status || 'paid',
      amount_total: 1000,
      currency: 'usd'
    });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

app.get('/api/payment/history', (req, res) => {
  res.json([
    {
      id: 'pi_123456',
      amount: 1000,
      status: 'succeeded',
      created: new Date().toISOString(),
      description: 'AI Job Chommie Subscription'
    },
    {
      id: 'pi_789012',
      amount: 1000,
      status: 'succeeded',
      created: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'AI Job Chommie Subscription'
    }
  ]);
});

app.post('/api/payment/portal', (req, res) => {
  res.json({
    url: 'https://billing.stripe.com/session/mock_portal_session_123',
    created: new Date().toISOString()
  });
});

app.post('/api/payment/webhook', (req, res) => {
  console.log('Webhook received:', req.body.type);
  res.json({ received: true });
});

// Start server
app.listen(port, () => {
  console.log(`Mock API server running at http://localhost:${port}`);
  console.log('Press Ctrl+C to stop the server');
});
