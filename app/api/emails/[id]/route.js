import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * PATCH /api/emails/[id]
 * Body: { action: 'read' | 'unread' | 'trash' | 'restore' }
 */
export async function PATCH(request, { params }) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { id } = await params;
    const { action } = await request.json();

    const supabase = await createSupabaseServerClient();

    if (action === 'read' || action === 'unread') {
      const { error } = await supabase
        .from('emails')
        .update({ is_read: action === 'read' })
        .eq('id', id)
        .eq('user_id', profile.id);

      if (error) {
        console.error('Email update error:', error.message);
        return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
      }

      return NextResponse.json({ message: `Email marked as ${action}.` });
    }

    if (action === 'trash') {
      const { error } = await supabase
        .from('emails')
        .update({ folder: 'trash' })
        .eq('id', id)
        .eq('user_id', profile.id);

      if (error) {
        console.error('Trash error:', error.message);
        return NextResponse.json({ error: 'Failed to move to trash.' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Email moved to trash.' });
    }

    if (action === 'restore') {
      const { error } = await supabase
        .from('emails')
        .update({ folder: 'inbox' })
        .eq('id', id)
        .eq('user_id', profile.id)
        .eq('folder', 'trash');

      if (error) {
        console.error('Restore error:', error.message);
        return NextResponse.json({ error: 'Failed to restore.' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Email restored to inbox.' });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Email PATCH error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}

/**
 * DELETE /api/emails/[id]
 * Permanently delete an email (from trash only).
 */
export async function DELETE(request, { params }) {
  try {
    const { profile } = await getAuthenticatedUser();
    const { id } = await params;

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from('emails')
      .delete()
      .eq('id', id)
      .eq('user_id', profile.id)
      .eq('folder', 'trash');

    if (error) {
      console.error('Delete error:', error.message);
      return NextResponse.json({ error: 'Failed to delete.' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Email permanently deleted.' });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('Email DELETE error:', err.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}