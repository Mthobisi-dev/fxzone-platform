import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/users/[id] — Fetch user profile by ID or username
export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ detail: 'User ID parameter missing' }, { status: 400 });
    }

    const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(userId);

    let data: any = null;

    if (isUuid) {
      // Query users table by UUID
      const { data: byId } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, avatar_url, bio, role, preferred_broker, followers_count, following_count, created_at')
        .eq('id', userId)
        .maybeSingle();
      data = byId;

      // Fallback: Check Supabase Auth if not yet synced in users table
      if (!data) {
        try {
          const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (authUserData?.user) {
            const u = authUserData.user;
            const meta = u.user_metadata || {};
            const username = meta.username || u.email?.split('@')[0] || 'trader';
            const displayName = meta.display_name || meta.full_name || username;

            // Auto-upsert into public.users table
            const { data: created } = await supabaseAdmin
              .from('users')
              .upsert({
                id: u.id,
                email: u.email,
                username,
                display_name: displayName,
                avatar_url: meta.avatar_url || null,
                role: meta.role || 'trader',
                preferred_broker: meta.preferred_broker || 'Exness',
              })
              .select('id, username, display_name, avatar_url, bio, role, preferred_broker, followers_count, following_count, created_at')
              .maybeSingle();

            data = created || {
              id: u.id,
              username,
              display_name: displayName,
              avatar_url: meta.avatar_url || null,
              bio: meta.bio || '',
              role: meta.role || 'trader',
              preferred_broker: meta.preferred_broker || 'Exness',
              followers_count: 0,
              following_count: 0,
              created_at: u.created_at,
            };
          }
        } catch (e) {
          console.warn('Auth user fallback lookup warning:', e);
        }
      }
    } else {
      // Query users table by username
      const { data: byUsername } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, avatar_url, bio, role, preferred_broker, followers_count, following_count, created_at')
        .eq('username', userId)
        .maybeSingle();
      data = byUsername;
    }

    if (!data) {
      // Return a clean fallback profile object if target ID is transient
      data = {
        id: userId,
        username: userId.includes('@') ? userId.split('@')[0] : userId,
        display_name: userId,
        avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userId)}`,
        bio: 'FxZone Market Trader',
        role: 'trader',
        preferred_broker: 'Exness',
        followers_count: 0,
        following_count: 0,
        created_at: new Date().toISOString(),
      };
    }

    return NextResponse.json({
      ...data,
      displayName: data.display_name || data.username,
      avatarUrl: data.avatar_url,
      preferredBroker: data.preferred_broker || 'Exness',
      preferred_broker: data.preferred_broker || 'Exness',
      followersCount: data.followers_count || 0,
      followingCount: data.following_count || 0,
    });
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile', detail: error?.message },
      { status: 500 }
    );
  }
}
