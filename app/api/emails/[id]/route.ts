import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthenticatedUser } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile } = await getAuthenticatedUser();
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    const body = await request.json();
    const { action } = body as { action?: string };

    if (!action || !['read', 'unread', 'trash', 'restore'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be read, unread, trash, or restore.' },
        { status: 400 },
      );
    }

    // Verify email belongs to user
    const { data: email, error: fetchError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', id)
      .eq('user_id', profile.id)
      .single();

    if (fetchError || !email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case 'read':
        updateData = { is_read: true };
        break;
      case 'unread':
        updateData = { is_read: false };
        break;
      case 'trash':
        updateData = { folder: 'trash' };
        break;
      case 'restore':
        if (email.folder !== 'trash') {
          return NextResponse.json(
            { error: 'Email is not in trash' },
            { status: 400 },
          );
        }
        updateData = { folder: 'inbox' };
        break;
    }

    const { error: updateError } = await supabase
      .from('emails')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile } = await getAuthenticatedUser();
    const supabase = await createSupabaseServerClient();
    const { id } = await params;

    // Verify email belongs to user and is in trash
    const { data: email, error: fetchError } = await supabase
      .from('emails')
      .select('folder')
      .eq('id', id)
      .eq('user_id', profile.id)
      .single();

    if (fetchError || !email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 });
    }

    if (email.folder !== 'trash') {
      return NextResponse.json(
        { error: 'Only emails in trash can be permanently deleted' },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase
      .from('emails')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Response) return err;
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
