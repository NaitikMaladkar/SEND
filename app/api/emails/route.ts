import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { getResendClient } from '@/lib/resend';
import { getMailDomain } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { profile } = await getAuthenticatedUser();
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';

    if (!['inbox', 'sent', 'trash'].includes(folder)) {
      return NextResponse.json(
        { error: 'Invalid folder' },
        { status: 400 },
      );
    }

    const { data: emails, error } = await supabase
      .from('emails')
      .select('*')
      .eq('user_id', profile.id)
      .eq('folder', folder)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ emails });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { profile } = await getAuthenticatedUser();
    const supabase = await createSupabaseServerClient();

    const body = await request.json();
    const { to, subject, body: emailBody } = body as {
      to?: string;
      subject?: string;
      body?: string;
    };

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Recipient, subject, and body are required' },
        { status: 400 },
      );
    }

    // Validate recipient email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid recipient email address' },
        { status: 400 },
      );
    }

    const domain = getMailDomain();
    const fromEmail = `${profile.username}@${domain}`;

    // Send via Resend
    const resend = getResendClient();
    const { error: resendError } = await resend.emails.send({
      from: `${profile.username} <${fromEmail}>`,
      to: [to],
      subject,
      text: emailBody,
    });

    if (resendError) {
      return NextResponse.json(
        { error: resendError.message },
        { status: 500 },
      );
    }

    // Save a copy to sent folder
    const { error: dbError } = await supabase.from('emails').insert({
      user_id: profile.id,
      folder: 'sent',
      sender_email: fromEmail,
      sender_name: profile.username,
      recipient_email: to,
      subject,
      body_text: emailBody,
      is_read: true,
    });

    if (dbError) {
      console.error('Failed to save sent email:', dbError.message);
      // Don't fail the request since email was already sent
    }

    return NextResponse.json({ message: 'Email sent successfully' });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
