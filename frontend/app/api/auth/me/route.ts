import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

// GET /api/auth/me — returns user profile from public.users via the session token
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request);

    if (error || !user) {
      return NextResponse.json({ detail: error || 'Not authenticated' }, { status: 401 });
    }

    const db = getSupabaseAdmin(request);

    // Fetch profile from public.users
    const { data: profile, error: profileError } = await db
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      // Profile row missing in public.users — auto-create and save it
      const meta = user.user_metadata || {};
      const username = meta.username || user.email?.split('@')[0] || `trader_${user.id.substring(0, 4)}`;
      const displayName = meta.display_name || meta.full_name || meta.name || username;
      const role = meta.role || 'trader';
      const avatarUrl = meta.avatar_url || meta.picture || null;
      const bio = meta.bio || '';

      const newProfile = {
        id: user.id,
        email: user.email || '',
        username,
        display_name: displayName,
        avatar_url: avatarUrl,
        bio,
        role,
        followers_count: 0,
        following_count: 0,
        created_at: user.created_at || new Date().toISOString(),
      };

      try {
        await db.from('users').upsert(newProfile, { onConflict: 'id' });
      } catch (e) {
        console.warn('Auto-create user profile row notice:', e);
      }

      return NextResponse.json(newProfile);
    }

    return NextResponse.json(profile);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to fetch profile', detail: err?.message },
      { status: 500 }
    );
  }
}

// PUT /api/auth/me — update user profile in public.users
export async function PUT(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request);

    if (error || !user) {
      return NextResponse.json({ detail: error || 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { username, display_name, bio, avatar_url } = body;

    const db = getSupabaseAdmin(request);

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updatePayload.username = username;
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (bio !== undefined) updatePayload.bio = bio;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;

    const { data: updated, error: updateError } = await db
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Also update Supabase auth metadata so buildUserFromSession stays in sync
    if (updated) {
      try {
        await db.auth.admin.updateUserById(user.id, {
          user_metadata: {
            username: updated.username,
            display_name: updated.display_name,
            bio: updated.bio,
            avatar_url: updated.avatar_url,
          },
        });
      } catch (_) {}
    }

    return NextResponse.json(updated || { id: user.id, ...updatePayload });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to update profile', detail: err?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/me — delete account completely (Auth + DB)
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request);

    if (error || !user) {
      return NextResponse.json({ detail: error || 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;
    const db = getSupabaseAdmin(request);

    // Delete related records in public tables
    await Promise.allSettled([
      db.from('posts').delete().eq('user_id', userId),
      db.from('comments').delete().eq('user_id', userId),
      db.from('follows').delete().eq('follower_id', userId),
      db.from('follows').delete().eq('following_id', userId),
      db.from('session_participants').delete().eq('user_id', userId),
      db.from('users').delete().eq('id', userId),
    ]);

    // Delete from Supabase Auth if admin client available
    try {
      await db.auth.admin.deleteUser(userId);
    } catch (e: any) {
      console.warn('Supabase auth deleteUser notice:', e?.message);
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted' });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to delete account', detail: err?.message },
      { status: 500 }
    );
  }
}
