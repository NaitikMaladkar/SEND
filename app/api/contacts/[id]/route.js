import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * DELETE /api/contacts/[id]
 */
export async function DELETE(request, { params }) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { id } = await params;
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', profile.id);

    if (error) {
      console.error('Contact delete error:', error.message);
      return NextResponse.json({ error: 'Failed to delete contact.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Contact deleted.' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Contact DELETE error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
