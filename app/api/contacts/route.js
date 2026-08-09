import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/contacts
 * List the authenticated user's contacts.
 */
export async function GET() {
  try {
    const { profile } = await getAuthenticatedUser();
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', profile.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Contacts fetch error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch contacts.' }, { status: 500 });
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Contacts GET error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * POST /api/contacts
 * Add a new contact.
 * Body: { name, email }
 */
export async function POST(request) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: profile.id,
        name: trimmedName,
        email: trimmedEmail,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This contact already exists.' },
          { status: 409 }
        );
      }
      console.error('Contact insert error:', error.message);
      return NextResponse.json(
        { error: 'Failed to add contact.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Contacts POST error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
