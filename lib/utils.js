import crypto from 'node:crypto';

const MAIL_DOMAIN = process.env.NEXT_PUBLIC_MAIL_DOMAIN || 'send.dedyn.io';

export function getMailDomain() {
  return MAIL_DOMAIN;
}

export function buildEmailAddress(username) {
  return `${username}@${MAIL_DOMAIN}`;
}

export function extractUsername(email) {
  if (!email) return null;
  const parts = email.split('@');
  return parts[0] || null;
}

/**
 * Verify a Mailgun webhook signature.
 */
export function verifyMailgunSignature(timestamp, token, signature) {
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return false;

  const encodedToken = crypto
    .createHmac('sha256', signingKey)
    .update(timestamp.concat(token))
    .digest('base64');

  return encodedToken === signature;
}

/**
 * Safely strip HTML to plain text.
 */
export function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n  * ')
    .replace(/<hr[^>]*>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
