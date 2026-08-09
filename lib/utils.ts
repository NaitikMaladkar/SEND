import { createHmac } from 'node:crypto';

export function getMailDomain(): string {
  return process.env.NEXT_PUBLIC_MAIL_DOMAIN || 'send.dedyn.io';
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<\/p>/gi, '')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<li[^>]*>/gi, '\u2022 ')
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

export function verifyWebhookSignature(
  payload: string,
  signature: string,
): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return expected === signature;
}
