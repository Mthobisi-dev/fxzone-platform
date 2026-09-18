import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// GET /api/social/users — list all registered accounts from public.users with follow state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const { user: currentUser } = await getUserFromRequest(request);
    const db = getSupabaseAdmin(request);

    // 1. Query registered accounts from public.users table
    let query = db
      .from('users')
      .select('id, email, username, display_name, avatar_url, bio, role, followers_count, following_count, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (q.trim()) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }

    const { data: usersData, error } = await query;
    if (error) throw error;

    let users = usersData || [];

    // 2. If authenticated user, annotate with follow status
    if (currentUser && users.length > 0) {
      const userIds = users.map((u: any) => u.id);
      
      // Fetch user's following list
      const { data: followings } = await db
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)
        .in('following_id', userIds);

      const followingSet = new Set((followings || []).map((f: any) => f.following_id));

      // Fetch user's followers list (to check mutuals)
      const { data: followers } = await db
        .from('follows')
        .select('follower_id')
        .eq('following_id', currentUser.id)
        .in('follower_id', userIds);

      const followerSet = new Set((followers || []).map((f: any) => f.follower_id));

      users = users.map((u: any) => {
        const isFollowing = followingSet.has(u.id);
        const isFollower = followerSet.has(u.id);
        return {
          ...u,
          is_following: isFollowing,
          is_follower: isFollower,
          is_mutual: isFollowing && isFollower,
        };
      });
    }

    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Error fetching social users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', detail: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/users — create/add trader to public.users or follow user
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);
    const body = await request.json();
    const { username, display_name, role, bio, avatar_url, following_id } = body;

    // Follow action
    if (following_id) {
      const { data, error } = await db
        .from('follows')
        .insert({ follower_id: user.id, following_id })
        .select()
        .single();

      if (error && error.code !== '23505') throw error;
      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    // Create / Add trader to network directory
    if (username) {
      const newId = crypto.randomUUID();
      const { data: created, error: createError } = await db
        .from('users')
        .insert({
          id: newId,
          username: username.trim(),
          display_name: (display_name || username).trim(),
          role: role || 'trader',
          bio: (bio || '').trim() || null,
          avatar_url: avatar_url || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      return NextResponse.json(created, { status: 201 });
    }

    return NextResponse.json({ detail: 'Invalid request body' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in social users POST:', error);
    return NextResponse.json(
      { error: 'Operation failed', detail: error?.message },
      { status: 500 }
    );
  }
}
