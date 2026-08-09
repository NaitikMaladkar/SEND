import jwt from 'jsonwebtoken';
import { getSession } from '../utils/sessionStore.js';

/**
 * JWT authentication middleware.
 * Verifies the Bearer token and attaches req.user = { email, sessionId }.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    if (!payload.email || !payload.sessionId) {
      return res.status(401).json({ error: 'Invalid token payload.' });
    }

    // Verify the server-side session still exists
    const session = getSession(payload.sessionId);
    if (!session) {
      return res
        .status(401)
        .json({ error: 'Session expired. Please log in again.' });
    }

    req.user = {
      email: payload.email,
      sessionId: payload.sessionId,
    };

    // Expose a helper to get credentials from the session store
    req.getCredentials = () => {
      const s = getSession(payload.sessionId);
      if (!s) return null;
      return { email: s.email, password: s.password };
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res
        .status(401)
        .json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
