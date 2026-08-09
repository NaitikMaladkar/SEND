import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyMailgunSignature, stripHtml, getMailDomain } from '@/lib/utils';

/**
 * POST /api/receive
 * Webhook endpoint for Mailgun inbound emails.
 * Mailgun sends a POST with the parsed email data.
 *
 * Security: Verifies the Mailgun HMAC signature.
 */
export async function POST(request) {
  try {
    const formData = await request.formData();
    const timestamp = formData.get('timestamp');
    const token = formData.get('token');
    const signature = formData.get('signature');

    // Verify Mailgun signature
    if (!verifyMailgunSignature(timestamp, token, signature)) {
      console.warn('Invalid Mailgun signature on /api/receive');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const recipient = formData.get('recipient');      // alice@send.dedyn.io
    const sender = formData.get('sender');              // person@example.com
    const senderName = formData.get('From') || '';
    const subject = formData.get('subject') || '(No Subject)';
    const bodyPlain = formData.get('body-plain') || '';
    const bodyHtml = formData.get('body-html') || '';

    if (!recipient) {
      return NextResponse.json({ error: 'Missing recipient.' }, { status: 400 });
    }

    const mailDomain = getMailDomain();

    // Extract the local part (username) from the recipient
    const localPart = recipient.split('@')[0]?.toLowerCase();
    if (!localPart) {
      return NextResponse.json({ error: 'Invalid recipient.' }, { status: 400 });
    }

    // Check if the recipient domain matches ours
    const recipientDomain = recipient.split('@')[1]?.toLowerCase();
    if (recipientDomain !== mailDomain) {
      // Not our domain — don't process
      return NextResponse.json({ error: 'Domain mismatch.' }, { status: 400 });
    }

    // Look up the user by username in the profiles table
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', localPart)
      .single();

    if (profileError || !profile) {
      // User doesn't exist — return 404 so Mailgun doesn't retry
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Determine the text body (prefer plain text, fallback to stripped HTML)
    const textBody = bodyPlain.trim() || stripHtml(bodyHtml);

    // Store the email in the inbox
    const { error: insertError } = await supabaseAdmin.from('emails').insert({
      user_id: profile.id,
      folder: 'inbox',
      sender_email: sender || 'unknown@unknown.com',
      sender_name: senderName || '',
      recipient_email: recipient,
      subject,
      body_text: textBody,
      body_html: bodyHtml || null,
      is_read: false,
    });

    if (insertError) {
      console.error('Insert email error:', insertError.message);
      return NextResponse.json({ error: 'Storage failed.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Email received.' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
