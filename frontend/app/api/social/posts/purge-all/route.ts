import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

// DELETE /api/social/posts/purge-all — Purge posts for user (or all posts)
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser(request);
    
    if (user) {
      // Delete user's posts
      const { error } = await supabaseAdmin
        .from('posts')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    } else {
      // Fallback: purge all posts if unauthenticated local reset
      const { error } = await supabaseAdmin
        .from('posts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) throw error;
    }

    return NextResponse.json({ message: 'Feed posts purged successfully' });
  } catch (error: any) {
    console.error('Purge posts error:', error);
    return NextResponse.json(
      { error: 'Failed to purge posts', detail: error?.message },
      { status: 500 }
    );
  }
}
