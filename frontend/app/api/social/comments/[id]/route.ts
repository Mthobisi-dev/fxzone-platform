import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, role, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const { id } = await context.params;
    const db = getSupabaseAdmin(request);
    const { data: comment, error: commentError } = await db
      .from('comments')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (commentError || !comment) return NextResponse.json({ detail: 'Comment not found' }, { status: 404 });
    if (comment.user_id !== user.id && role !== 'admin') return NextResponse.json({ detail: 'Not authorized to delete this comment' }, { status: 403 });

    const { error } = await db.from('comments').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ detail: error?.message || 'Unable to delete comment' }, { status: 500 });
  }
}
