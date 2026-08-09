import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { fetchInbox, sendEmail } from '../utils/mail.js';
import { deleteSession } from '../utils/sessionStore.js';

const router = Router();

/**
 * GET /api/emails/inbox
 * Fetches all inbox messages for the authenticated user.
 */
router.get('/inbox', authMiddleware, async (req, res, next) => {
  try {
    const credentials = req.getCredentials();
    if (!credentials) {
      // Session was invalidated between middleware check and here
      deleteSession(req.user.sessionId);
      return res
        .status(401)
        .json({ error: 'Session expired. Please log in again.' });
    }

    const messages = await fetchInbox(credentials.email, credentials.password);
    return res.json({ messages });
  } catch (err) {
    // Distinguish connection errors from other failures
    const msg =
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.message?.includes('connect')
        ? 'Unable to connect to the mail server. Please try again later.'
        : 'Failed to fetch inbox.';
    console.error('Inbox fetch error:', err.message);
    return res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/emails/send
 * Sends an email. Only internal recipients are allowed.
 *
 * The frontend sends { to: "jane", subject: "...", body: "..." }.
 * The backend constructs jane@send.dedyn.io and validates the domain.
 */
router.post('/send', authMiddleware, async (req, res, next) => {
  try {
    const { to, subject, body } = req.body;
    const mailDomain = process.env.MAIL_DOMAIN;

    // --- Validate recipient ---
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ error: 'Recipient is required.' });
    }

    const trimmedTo = to.trim().toLowerCase();

    // If the user already included a full address, parse it
    let recipientLocalPart;
    let recipientDomain;

    if (trimmedTo.includes('@')) {
      // Full address provided — validate it properly
      const parts = trimmedTo.split('@');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return res.status(400).json({ error: 'Invalid recipient format.' });
      }
      recipientLocalPart = parts[0];
      recipientDomain = parts[1];
    } else {
      // Username only — append the configured domain
      if (!/^[a-zA-Z0-9._-]+$/.test(trimmedTo)) {
        return res
          .status(400)
          .json({
            error:
              'Invalid username. Use only letters, numbers, dots, hyphens, and underscores.',
          });
      }
      recipientLocalPart = trimmedTo;
      recipientDomain = mailDomain;
    }

    // CRITICAL: Enforce internal-only sending
    if (recipientDomain !== mailDomain) {
      return res
        .status(403)
        .json({ error: 'External recipients are not allowed.' });
    }

    const recipientAddress = `${recipientLocalPart}@${recipientDomain}`;

    // Validate the full address one more time for safety
    const fullEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!fullEmailRegex.test(recipientAddress)) {
      return res.status(400).json({ error: 'Invalid recipient address.' });
    }

    // --- Validate subject and body ---
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required.' });
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Message body is required.' });
    }

    // --- Derive sender from JWT (never trust the frontend) ---
    const senderEmail = req.user.email;

    // --- Send via SMTP ---
    await sendEmail(senderEmail, recipientAddress, subject.trim(), body.trim());

    return res.json({ message: 'Email sent successfully' });
  } catch (err) {
    // Distinguish SMTP errors from other failures
    const msg =
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.message?.includes('connect')
        ? 'Unable to connect to the mail server. Please try again later.'
        : 'Failed to send email. Please try again.';
    console.error('Send error:', err.message);
    return res.status(500).json({ error: msg });
  }
});

export default router;
