import { createHmac } from 'node:crypto';

export function getMailDomain(): string {
  return process.env.NEXT_PUBLIC_MAIL_DOMAIN || 'send.dedyn.io';
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string,
): boolean {
  const apiKey = process.env.MAILGUN_SIGNING_KEY;
  if (!apiKey) return false;

  const encoded = Buffer.from(apiKey, 'utf-8').toString('base64');
  const data = `${timestamp}${token}`;
  const expected = createHmac('sha256', encoded).update(data).digest('hex');

  return expected === signature;
}
