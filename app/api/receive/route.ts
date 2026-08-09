import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMailDomain } from '@/lib/utils';
import { verifyWebhookSignature } from '@/lib/webhook';

/**
 * Inbound email webhook endpoint.
 * Called by the Cloudflare Email Worker when a new email arrives.
 *
 * Expected JSON body:
 * {
 *   "to": "user@send.dedyn.io",
 *   "from": "Sender Name <sender@example.com>",
 *   "subject": "Hello",
 *   "body_text": "Plain text body",
 *   "body_html": "<p>HTML body</p>",
 *   "sig": "hmac-sha256-signature"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: Record<string, unknown>;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 },
      );
    }

    // Verify webhook signature
    const sig = request.headers.get('x-webhook-sig') || (body.sig as string) || '';
    if (!verifyWebhookSignature(rawBody, sig)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 },
      );
    }

    const recipient = body.to as string | null;
    const sender = body.from as string | null;
    const subject = body.subject as string | null;
    const bodyPlain = body.body_text as string | null;
    const bodyHtml = body.body_html as string | null;

    if (!recipient || !sender) {
      return NextResponse.json(
        { error: 'Missing recipient or sender' },
        { status: 400 },
      );
    }

    const domain = getMailDomain();
    const recipientLocal = recipient.split('@')[0];

    if (!recipientLocal) {
      return NextResponse.json(
        { error: 'Invalid recipient address' },
        { status: 400 },
      );
    }

    // Look up user by username
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', recipientLocal)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    // Parse sender name and email
    const senderMatch = sender.match(/^"?([^"<]+)"?\s*<(.+)>$/);
    const senderEmail = senderMatch ? senderMatch[2] : sender;
    const senderName = senderMatch ? senderMatch[1].trim() : null;

    // Store the email
    const { error: insertError } = await supabaseAdmin
      .from('emails')
      .insert({
        user_id: profile.id,
        folder: 'inbox',
        sender_email: senderEmail,
        sender_name: senderName,
        recipient_email: recipient,
        subject,
        body_text: bodyPlain,
        body_html: bodyHtml,
        is_read: false,
      });

    if (insertError) {
      console.error('Failed to store email:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to store email' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
