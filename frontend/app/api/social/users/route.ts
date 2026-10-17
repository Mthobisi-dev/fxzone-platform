import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest, syncAuthProfiles } from '@/lib/supabase';
import { isHiddenSystemAccount } from '@/lib/systemAccounts';
import { mutualConnectionIds } from '@/lib/mutualConnections';

// These were seeded as blog demonstrations and must not be suggested as live
// community accounts while the deliberate maintenance script removes them.
const LEGACY_DEMO_USERNAMES = new Set([
  'blog_demo_taylor',
  'blog_demo_alex',
  'blog_demo_jamie',
]);

// GET /api/social/users — list all registered accounts from public.users with follow state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const requestedLimit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;

    const { user: currentUser } = await getUserFromRequest(request);
    const db = getSupabaseAdmin(request);

    // Messages only suggests mutual connections; filter before pagination.
    const mutualOnly = searchParams.get('mutual') === 'true';
    let mutualIds: string[] = [];
    if (mutualOnly) {
      if (!currentUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const [outgoing, incoming] = await Promise.all([
        db.from('follows').select('following_id').eq('follower_id', currentUser.id),
        db.from('follows').select('follower_id').eq('following_id', currentUser.id),
      ]);
      if (outgoing.error) throw outgoing.error;
      if (incoming.error) throw incoming.error;
      mutualIds = mutualConnectionIds(currentUser.id, outgoing.data || [], incoming.data || []);
      if (!mutualIds.length) return NextResponse.json([], { headers: { 'Cache-Control': 'private, no-store' } });
    }

    // 1. Query registered accounts from public.users table
    const loadUsers = () => {
      let query = db
        .from('users')
        .select('id, username, display_name, avatar_url, bio, role, followers_count, following_count, created_at')
        .order('created_at', { ascending: false })
        // Overscan lets us hide legacy demonstrations without returning a
        // short Discover page when they are newest records.
        .limit(Math.min(limit + LEGACY_DEMO_USERNAMES.size + 1, 100));

      if (currentUser) query = query.neq('id', currentUser.id);
      if (mutualOnly) query = query.in('id', mutualIds);
      if (q.trim()) {
        const safeQuery = q.trim().replace(/[^\w .-]/g, '').slice(0, 80);
        if (safeQuery) {
          query = query.or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`);
        }
      }
      return query;
    };

    let { data: usersData, error } = await loadUsers();
    // A legacy installation can have real auth.accounts but only the current
    // user's public profile. Repair that gap before returning Discover data.
    if (!mutualOnly && !error && !q.trim() && (usersData || []).length <= 1) {
      try {
        await syncAuthProfiles();
      } catch (syncError) {
        // Discover can still return its existing public profiles if Auth is
        // temporarily unavailable. The next request retries the repair.
        console.warn('Discover profile sync notice:', syncError);
      }
      ({ data: usersData, error } = await loadUsers());
    }
    if (error) throw error;

    let users = (usersData || [])
      .filter((account: any) => !LEGACY_DEMO_USERNAMES.has(String(account.username || '').toLowerCase()) && !isHiddenSystemAccount(account.username))
      .slice(0, limit)
      .map((account: any) => ({
      ...account,
      is_following: false,
      is_follower: false,
      is_mutual: false,
      }));

    // 2. If authenticated user, annotate with follow status
    if (currentUser && users.length > 0) {
      const userIds = users.map((u: any) => u.id);
      
      const [followingsResult, followersResult] = await Promise.all([
        db
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUser.id)
          .in('following_id', userIds),
        db
          .from('follows')
          .select('follower_id')
          .eq('following_id', currentUser.id)
          .in('follower_id', userIds),
      ]);
      const followings = followingsResult.data;
      const followers = followersResult.data;
      if (followingsResult.error) throw followingsResult.error;
      if (followersResult.error) throw followersResult.error;

      const followingSet = new Set((followings || []).map((f: any) => f.following_id));
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

    return NextResponse.json(mutualOnly ? users.filter(account => account.is_mutual) : users, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error: any) {
    console.error('Error fetching social users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// Registered accounts are provisioned by the auth.users trigger. This route is
// intentionally not an account-creation endpoint: creating arbitrary public
// profiles made Discover show accounts that could not sign in.
export async function POST(request: NextRequest) {
  try {
    const { user, error: authErr } = await getUserFromRequest(request);
    if (authErr || !user) {
      return NextResponse.json({ detail: authErr || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);
    const body = await request.json();
    const { following_id } = body;

    // Follow action
    if (following_id) {
      if (following_id === user.id) {
        return NextResponse.json({ detail: 'Cannot follow yourself' }, { status: 400 });
      }
      const { data: target, error: targetError } = await db.from('users')
        .select('id, username, role').eq('id', following_id).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return NextResponse.json({ detail: 'Trader not found' }, { status: 404 });
      if (isHiddenSystemAccount(target.username) || ['jackbot_analysis', 'fxzone_bot', 'fxzone_admin'].includes(String(target.username).toLowerCase()) || target.role === 'admin') {
        return NextResponse.json({ detail: 'This system account cannot be followed.' }, { status: 403 });
      }
      const { data, error } = await db
        .from('follows')
        .insert({ follower_id: user.id, following_id })
        .select()
        .single();

      if (error && error.code !== '23505') throw error;
      return NextResponse.json({ success: true, data }, { status: 201 });
    }

    return NextResponse.json({ detail: 'Accounts must be created through Supabase Auth registration.' }, { status: 405 });
  } catch (error: any) {
    console.error('Error in social users POST:', error);
    return NextResponse.json(
      { error: 'Operation failed', detail: error?.message },
      { status: 500 }
    );
  }
}
