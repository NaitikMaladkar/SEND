import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMailDomain, verifyMailgunSignature } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // Verify Mailgun signature
    const timestamp = request.headers.get('timestamp') || '';
    const token = request.headers.get('token') || '';
    const signature = request.headers.get('signature') || '';

    if (!verifyMailgunSignature(timestamp, token, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 },
      );
    }

    const formData = await request.formData();
    const recipient = formData.get('recipient') as string | null;
    const sender = formData.get('sender') as string | null;
    const subject = formData.get('subject') as string | null;
    const bodyPlain = formData.get('body-plain') as string | null;
    const bodyHtml = formData.get('body-html') as string | null;

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

    // Look up user by username using service role key
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
