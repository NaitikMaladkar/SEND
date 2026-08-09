import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getResendClient } from '@/lib/resend';
import { getMailDomain } from '@/lib/utils';

/**
 * GET /api/emails?folder=inbox
 * List emails for the authenticated user.
 */
export async function GET(request) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';

    if (!['inbox', 'sent', 'trash'].includes(folder)) {
      return NextResponse.json({ error: 'Invalid folder.' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', profile.id)
      .eq('folder', folder)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Emails fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch emails.' }, { status: 500 });
    }

    return NextResponse.json({ emails: data || [] });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Emails GET error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/emails
 * Send an email via Resend.
 * Body: { to, subject, body }
 */
export async function POST(request) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { to, subject, body } = await request.json();
    const mailDomain = getMailDomain();

    // Validate recipient
    if (!to || typeof to !== 'string' || !to.trim()) {
      return NextResponse.json({ error: 'Recipient is required.' }, { status: 400 });
    }

    const recipientEmail = to.trim().toLowerCase();

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
      return NextResponse.json({ error: 'Message body is required.' }, { status: 400 });
    }

    const senderEmail = `${profile.username}@${mailDomain}`;

    // Send via Resend
    const resend = getResendClient();
    const { error: sendError } = await resend.emails.send({
      from: `${profile.username} <${senderEmail}>`,
      to: [recipientEmail],
      subject: subject.trim(),
      text: body.trim(),
    });

    if (sendError) {
      console.error('Resend error:', sendError);
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      );
    }

    // Save a copy in the user's "sent" folder
    const supabase = await createSupabaseServerClient();
    await supabase.from('emails').insert({
      user_id: profile.id,
      folder: 'sent',
      sender_email: senderEmail,
      sender_name: profile.username,
      recipient_email: recipientEmail,
      subject: subject.trim(),
      body_text: body.trim(),
      is_read: true,
    });

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Emails POST error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
