import { Router } from 'express';
import { verifyImapCredentials } from '../utils/mail.js';
import { createSession, deleteSession } from '../utils/sessionStore.js';
import jwt from 'jsonwebtoken';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates against Dovecot IMAP and returns a JWT.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // --- Input validation ---
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required.' });
    }

    // Normalize email to lowercase and trim
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email syntax
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Ensure email belongs to the configured mail domain
    const domain = normalizedEmail.split('@')[1];
    const mailDomain = process.env.MAIL_DOMAIN;
    if (domain !== mailDomain) {
      return res
        .status(400)
        .json({ error: `Only @${mailDomain} addresses are allowed.` });
    }

    // --- IMAP authentication ---
    let authenticated = false;
    try {
      authenticated = await verifyImapCredentials(normalizedEmail, password);
    } catch {
      // IMAP connection failure — treat as invalid credentials
      authenticated = false;
    }

    if (!authenticated) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // --- Create server-side session (stores password temporarily) ---
    const sessionId = createSession(normalizedEmail, password);

    // --- Issue JWT (contains email + sessionId, NOT the password) ---
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';
    const token = jwt.sign(
      { email: normalizedEmail, sessionId },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    return res.json({
      token,
      user: { email: normalizedEmail },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 * Invalidates the server-side session.
 */
router.post('/logout', (req, res) => {
  // This route can optionally be protected, but for simplicity
  // we accept the token and try to invalidate the session.
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.sessionId) {
        deleteSession(payload.sessionId);
      }
    } catch {
      // Token is invalid/expired — session is already gone or irrelevant
    }
  }

  return res.json({ message: 'Logged out successfully.' });
});

export default router;
