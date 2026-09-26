import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, ensureUserProfile } from '@/lib/server/supabaseServer';


// GET /api/social/feed — paginated social posts with author info
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

    const db = getSupabaseAdmin(request);
    // Authentication and the public post query do not depend on each other.
    // Start both so an authenticated feed does not pay their combined latency.
    const currentUserPromise = getUserFromRequest(request);

    const basePostSelect = `
        id,
        content,
        image_url,
        likes_count,
        comments_count,
        reposts_count,
        is_story,
        is_pinned,
        created_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        )
      `;
    const enhancedPostSelect = `
        id,
        content,
        image_url,
        likes_count,
        comments_count,
        reposts_count,
        is_story,
        is_pinned,
        caption,
        show_comments_count,
        show_likes_count,
        allow_reshare,
        allow_save,
        allow_share,
        created_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url,
          role
        )
      `;
    const fetchPosts = (select: string) => db
      .from('posts')
      .select(select)
      .eq('is_story', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    let { data, error } = await fetchPosts(enhancedPostSelect);
    // Older projects can serve the feed before migration 006 adds the
    // composer-option columns. Retrying with the durable base schema keeps
    // feeds available while the migration is applied.
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find.*column/i.test(error.message || ''))) {
      ({ data, error } = await fetchPosts(basePostSelect));
    }

    if (error) throw error;

    const { user: currentUser } = await currentUserPromise;
    const postIds = (data || []).map((post: any) => post.id);
    const [reactionsResult, bookmarksResult, repostsResult] = currentUser && postIds.length > 0
      ? await Promise.all([
          db.from('reactions').select('post_id').eq('user_id', currentUser.id).eq('reaction_type', 'like').in('post_id', postIds),
          db.from('bookmarks').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds),
          db.from('reposts').select('post_id').eq('user_id', currentUser.id).in('post_id', postIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
    const { data: bookmarkRows, error: bookmarkRowsError } = postIds.length > 0
      ? await db.from('bookmarks').select('post_id').in('post_id', postIds)
      : { data: [], error: null };
    if (bookmarkRowsError) throw bookmarkRowsError;
    const savesCountByPost = new Map<string, number>();
    for (const row of bookmarkRows || []) {
      savesCountByPost.set(row.post_id, (savesCountByPost.get(row.post_id) || 0) + 1);
    }
    const likedPostIds = new Set((reactionsResult.data || []).map((row: any) => row.post_id));
    const bookmarkedPostIds = new Set((bookmarksResult.data || []).map((row: any) => row.post_id));
    const repostedPostIds = new Set((repostsResult.data || []).map((row: any) => row.post_id));

    const posts = (data || []).map((p: any) => ({
      id: p.id,
      user_id: p.users?.id,
      user: {
        id: p.users?.id,
        username: p.users?.username,
        full_name: p.users?.display_name,
        display_name: p.users?.display_name,
        avatar_url: p.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${p.users?.username || 'user'}`,
        role: p.users?.role,
      },
      content: p.content,
      image_url: p.image_url,
      media_type: p.image_url ? 'image' : 'none',
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      reposts_count: p.reposts_count || 0,
      saves_count: savesCountByPost.get(p.id) || 0,
      is_story: p.is_story,
      is_pinned: p.is_pinned,
      caption: p.caption,
      show_comments_count: p.show_comments_count,
      show_likes_count: p.show_likes_count,
      allow_reshare: p.allow_reshare,
      allow_save: p.allow_save,
      allow_share: p.allow_share,
      is_liked_by_user: likedPostIds.has(p.id),
      is_bookmarked_by_user: bookmarkedPostIds.has(p.id),
      is_reposted_by_user: repostedPostIds.has(p.id),
      created_at: p.created_at,
    }));

    return NextResponse.json(posts, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
  } catch (error: any) {
    console.error('Social feed error:', error);
    return NextResponse.json(
      { error: 'Failed to load feed', detail: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/feed — create a new post
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (authError || !user) {
      return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { content, image_url, is_story, caption, show_comments_count, show_likes_count, allow_reshare, allow_save, allow_share } = body;

    let finalContent = (content || '').trim();
    if (!finalContent) {
      if (image_url || is_story) {
        finalContent = '📊 Shared media attachment';
      } else {
        return NextResponse.json({ detail: 'Content is required' }, { status: 400 });
      }
    }

    // getUserFromRequest already verifies that the signed-in user has a
    // provisioned active profile; avoid a second provisioning round trip.
    const db = getSupabaseAdmin(request);
    const basePost = {
      user_id: user.id,
      content: finalContent,
      image_url: image_url || null,
      is_story: !!is_story,
      expires_at: is_story ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
    };
    const enhancedPost = {
      ...basePost,
      caption: typeof caption === 'string' ? caption.trim().slice(0, 200) || null : null,
      show_comments_count: typeof show_comments_count === 'boolean' ? show_comments_count : true,
      show_likes_count: typeof show_likes_count === 'boolean' ? show_likes_count : true,
      allow_reshare: typeof allow_reshare === 'boolean' ? allow_reshare : true,
      allow_save: typeof allow_save === 'boolean' ? allow_save : true,
      allow_share: typeof allow_share === 'boolean' ? allow_share : true,
    };
    const createPost = (payload: typeof enhancedPost | typeof basePost) =>
      db.from('posts').insert(payload).select().single();
    let { data, error } = await createPost(enhancedPost);
    if (error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find.*column/i.test(error.message || ''))) {
      ({ data, error } = await createPost(basePost));
    }

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Create post error:', error);
    return NextResponse.json(
      { error: 'Failed to create post', detail: error?.message },
      { status: 500 }
    );
  }
}
