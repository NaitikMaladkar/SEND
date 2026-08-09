/**
 * SEND Inbound Email Worker
 *
 * Receives incoming emails via Cloudflare Email Routing,
 * parses them, and forwards to the SEND webapp webhook.
 *
 * Setup:
 * 1. Add dedyn.io zone in Cloudflare Dashboard
 * 2. Enable Email Routing for send.dedyn.io
 * 3. Deploy: cd cloudflare-worker && npm install && npx wrangler deploy
 * 4. In Cloudflare Dashboard > Email Routing > Routes:
 *    Set catch-all rule to "Send to Worker" → select "send-inbound-mail"
 * 5. In deSEC DNS, add MX records:
 *    route1.mx.cloudflare.net. (priority 0)
 *    route2.mx.cloudflare.net. (priority 0)
 *    route3.mx.cloudflare.net. (priority 0)
 */

import { createHmac } from 'node:crypto';

export default {
  async email(message, env, ctx) {
    const from = message.from;
    const to = message.to;

    // Read email parts
    let subject = '(no subject)';
    let bodyText = '';
    let bodyHtml = '';

    // Parse headers
    if (message.headers) {
      const subjHeader = message.headers.get('subject');
      if (subjHeader) subject = subjHeader;
    }

    // Read the raw email body
    const rawEmail = await new Response(message.raw).text();

    // Simple parsing: split text and HTML parts
    if (rawEmail.includes('Content-Type: text/plain')) {
      const textMatch = rawEmail.match(/Content-Type: text/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\nContent-Type)/);
      if (textMatch) bodyText = textMatch[1].trim();
    }
    if (rawEmail.includes('Content-Type: text/html')) {
      const htmlMatch = rawEmail.match(/Content-Type: text/html[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|$)/);
      if (htmlMatch) bodyHtml = htmlMatch[1].trim();
    }

    // Fallback: if no MIME parts found, use full raw body as text
    if (!bodyText && !bodyHtml) {
      bodyText = rawEmail
        .replace(/^Content-[\s\S]*?\r?\n\r?\n/, '')
        .trim();
    }

    // Build webhook payload
    const payload = JSON.stringify({
      to,
      from,
      subject,
      body_text: bodyText || null,
      body_html: bodyHtml || null,
    });

    // Sign the payload
    const sig = createHmac('sha256', env.WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    // Forward to the webapp
    const webhookUrl = env.WEBHOOK_URL || 'https://send.dedyn.io/api/receive';
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-sig': sig,
        },
        body: payload,
      });

      if (!response.ok) {
        console.error(`Webhook failed: ${response.status} ${await response.text()}`);
      }
    } catch (err) {
      console.error(`Webhook error: ${err.message}`);
    }

    // Always accept the email (don't bounce)
    message.setReject("Not rejected");
  },
};
