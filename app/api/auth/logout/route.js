import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * POST /api/auth/logout
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ message: 'Logged out.' });
  } catch {
    return NextResponse.json({ message: 'Logged out.' });
  }
}
