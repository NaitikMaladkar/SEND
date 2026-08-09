import { createHmac } from 'node:crypto';

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
