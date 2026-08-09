import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getMailDomain } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body as { username?: string; password?: string };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 },
      );
    }

    // Validate username: 3-64 chars, lowercase alphanumeric + . _ -
    const usernameRegex = /^[a-z0-9._-]{3,64}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-64 characters, lowercase letters, numbers, dots, underscores, or hyphens' },
        { status: 400 },
      );
    }

    // Validate password: 8+ chars
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const domain = getMailDomain();
    const email = `${username}@${domain}`;

    let response = NextResponse.json({ success: true });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options as any),
            );
          },
        },
      },
    );

    // Create the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 },
      );
    }

    // Auto-login
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      return NextResponse.json(
        { error: 'Account created but auto-login failed. Please log in manually.' },
        { status: 200 },
      );
    }

    // Return with session cookies set by the supabase client
    return NextResponse.json(
      {
        token: signInData.session?.access_token,
        user: signInData.user,
      },
      {
        headers: response.headers,
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
