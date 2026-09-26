import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// Fetch posts and chart analyses published by a profile. The route accepts both
// a UUID and a username because profile URLs use either form.
export async function GET(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { id: profileIdentifier } = await Promise.resolve(context.params);
    if (!profileIdentifier) return NextResponse.json([]);

    const db = getSupabaseAdmin(request);
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(profileIdentifier);
    const { data: profile, error: profileError } = isUuid
      ? await db.from('users').select('id').eq('id', profileIdentifier).maybeSingle()
      : await db.from('users').select('id').eq('username', profileIdentifier).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json([]);

    const { data: posts, error } = await db
      .from('posts')
      .select('id, content, image_url, caption, asset_tags, likes_count, comments_count, reposts_count, is_story, is_pinned, created_at, users:user_id (id, username, display_name, avatar_url, role)')
      .eq('user_id', profile.id)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json((posts || []).map((post: any) => ({
      ...post,
      user_id: post.users?.id || profile.id,
      user: {
        id: post.users?.id || profile.id,
        username: post.users?.username || 'trader',
        display_name: post.users?.display_name || post.users?.username || 'Trader',
        avatar_url: post.users?.avatar_url || null,
        role: post.users?.role || 'trader',
      },
      likes_count: post.likes_count || 0,
      comments_count: post.comments_count || 0,
      reposts_count: post.reposts_count || 0,
    })));
  } catch (error: any) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json([], { status: 200 });
  }
}
