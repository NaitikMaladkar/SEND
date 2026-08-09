import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { buildEmailAddress } from '@/lib/utils';

/**
 * POST /api/auth/register
 * Body: { username, password }
 * Creates a Supabase Auth user and profile.
 */
export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    const trimmed = username.trim().toLowerCase();

    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(trimmed) || trimmed.length < 3 || trimmed.length > 64) {
      return NextResponse.json(
        { error: 'Username must be 3-64 characters. Use only lowercase letters, numbers, dots, hyphens, and underscores.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }

    const email = buildEmailAddress(trimmed);
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: trimmed },
      },
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        return NextResponse.json(
          { error: 'This username is already taken.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Registration failed. Please try again.' },
        { status: 400 }
      );
    }

    // The trigger auto-creates the profile, but if using service role
    // we might need to wait. The client handles session after email verification.
    return NextResponse.json({
      message: 'Account created successfully. You can now sign in.',
      user: { email, username: trimmed },
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    return NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 }
    );
  }
}
