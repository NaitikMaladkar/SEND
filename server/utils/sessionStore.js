import crypto from 'node:crypto';

/**
 * In-memory session store.
 * Maps sessionId → { email, password, lastAccessed }.
 * Passwords are held only server-side and never sent to the browser.
 * Sessions expire after SESSION_TTL_MS of inactivity.
 */
const sessions = new Map();

let ttlMs = Number(process.env.SESSION_TTL_MS) || 30 * 60 * 1000; // 30 minutes
let cleanupIntervalMs = Number(process.env.SESSION_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes

export function configureSessionStore() {
  ttlMs = Number(process.env.SESSION_TTL_MS) || 30 * 60 * 1000;
  cleanupIntervalMs = Number(process.env.SESSION_CLEANUP_INTERVAL_MS) || 5 * 60 * 1000;
}

export function createSession(email, password) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, {
    email,
    password,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.lastAccessed > ttlMs) {
    sessions.delete(sessionId);
    return null;
  }
  session.lastAccessed = Date.now();
  return session;
}

export function deleteSession(sessionId) {
  sessions.delete(sessionId);
}

export function startSessionCleanup() {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastAccessed > ttlMs) {
        sessions.delete(id);
      }
    }
  }, cleanupIntervalMs);

  // Allow the process to exit even if the interval is still running
  if (interval.unref) interval.unref();
}
