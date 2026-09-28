import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { apiError } from '@/lib/api-error';

// Fetch posts and chart analyses published by a profile. The route accepts both
// a UUID and a username because profile URLs use either form.
export async function GET(request: NextRequest, context: { params: { id: string } | Promise<{ id: string }> }) {
  try {
    const { id: profileIdentifier } = await Promise.resolve(context.params);
    if (!profileIdentifier) return apiError('BAD_REQUEST', 'A profile identifier is required.', 400);

    const db = getSupabaseAdmin(request);
    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(profileIdentifier);
    const { data: profile, error: profileError } = isUuid
      ? await db.from('users').select('id').eq('id', profileIdentifier).maybeSingle()
      : await db.from('users').select('id').eq('username', profileIdentifier).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return NextResponse.json([]);

    const { data: posts, error, count } = await db
      .from('posts')
      .select('id, content, image_url, caption, asset_tags, likes_count, comments_count, reposts_count, is_story, is_pinned, created_at, users:user_id (id, username, display_name, avatar_url, role)', { count: 'exact' })
      .eq('user_id', profile.id)
      .eq('is_story', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;

    const mappedPosts = (posts || []).map((post: any) => ({
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
    }));
    const includeTotal = new URL(request.url).searchParams.get('include_total') === '1';
    return NextResponse.json(includeTotal ? { posts: mappedPosts, total: count || 0 } : mappedPosts);
  } catch (error: unknown) {
    console.error('Error fetching user posts:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load profile posts.', 500);
  }
}
