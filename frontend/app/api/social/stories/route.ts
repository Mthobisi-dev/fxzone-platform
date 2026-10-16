import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { storyAudienceIds } from '@/lib/storyAudience';
// GET /api/social/stories — fetch active (non-expired) story posts
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return apiError('UNAUTHORIZED', 'Authentication required', 401);

    const db = getSupabaseAdmin(request);
    const [outgoing, incoming] = await Promise.all([
      db.from('follows').select('following_id').eq('follower_id', user.id),
      db.from('follows').select('follower_id').eq('following_id', user.id),
    ]);
    if (outgoing.error) throw outgoing.error;
    if (incoming.error) throw incoming.error;

    const audienceIds = storyAudienceIds(user.id, outgoing.data || [], incoming.data || []);
    const { data, error } = await db
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        likes_count,
        created_at,
        expires_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('is_story', true)
      .in('user_id', audienceIds)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const storyIds = (data || []).map((story: any) => story.id);
    const liked = storyIds.length > 0
      ? await db.from('reactions')
          .select('post_id')
          .eq('user_id', user.id)
          .eq('reaction_type', 'like')
          .in('post_id', storyIds)
      : { data: [], error: null };
    if (liked.error) throw liked.error;
    const likedIds = new Set((liked.data || []).map((reaction: any) => reaction.post_id));

    const stories = (data || []).map((s: any) => ({
      id: s.id,
      content: s.content,
      image_url: s.image_url,
      created_at: s.created_at,
      expires_at: s.expires_at,
      likes_count: s.likes_count || 0,
      is_liked_by_user: likedIds.has(s.id),
      has_unseen: true, // Can be enhanced with a seen-tracking table later
      user: {
        id: s.users?.id,
        username: s.users?.username,
        display_name: s.users?.display_name,
        avatar_url: s.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${s.users?.username}`,
      },
    }));

    return NextResponse.json(stories, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
  } catch (error: unknown) {
    console.error('Stories fetch error:', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load stories.', 500);
  }
}
