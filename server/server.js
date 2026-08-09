import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
import emailRoutes from './routes/emails.js';
import { configureSessionStore, startSessionCleanup } from './utils/sessionStore.js';

// --- Validate critical environment variables ---
const requiredEnvVars = ['JWT_SECRET', 'IMAP_HOST', 'IMAP_PORT', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_DOMAIN'];
const missing = requiredEnvVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

if (process.env.JWT_SECRET === 'replace-with-a-long-random-secret') {
  console.error('ERROR: JWT_SECRET is still set to the default placeholder.');
  console.error('Generate a secure secret and set it in .env');
  process.exit(1);
}

// --- Configure session store and start cleanup ---
configureSessionStore();
startSessionCleanup();

// --- Express app ---
const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — allow the configured frontend origin
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientUrl,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limit for login attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// Parse JSON bodies
app.use(express.json({ limit: '1mb' }));

// --- Routes ---
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Centralized error handling ---
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// --- Start server ---
app.listen(PORT, () => {
  console.log(`SEND Webmail server running on port ${PORT}`);
  console.log(`Frontend origin: ${clientUrl}`);
  console.log(`Mail domain: ${process.env.MAIL_DOMAIN}`);
});
