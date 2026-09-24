import { NextRequest, NextResponse } from 'next/server';
import { ensureUserProfile, getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';

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

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      const provisioned = await ensureUserProfile(db, user);
      if (!provisioned) {
        return NextResponse.json({ detail: 'Profile provisioning failed' }, { status: 503 });
      }

      const { data: provisionedProfile, error: provisionError } = await db
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (provisionError || !provisionedProfile) {
        throw provisionError || new Error('Profile was not available after provisioning');
      }
      return NextResponse.json(provisionedProfile);
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
    const { username, display_name, bio, avatar_url, preferred_broker } = body;

    const db = getSupabaseAdmin(request);

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updatePayload.username = username;
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (bio !== undefined) updatePayload.bio = bio;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;
    if (preferred_broker !== undefined) updatePayload.preferred_broker = preferred_broker;

    let updated: any = null;
    let updateError: any = null;

    try {
      const res = await db
        .from('users')
        .update(updatePayload)
        .eq('id', user.id)
        .select()
        .maybeSingle();
      updated = res.data;
      updateError = res.error;
    } catch (e: any) {
      updateError = e;
    }

    // If database update failed because preferred_broker column does not exist yet on public.users table, fallback to updating without it
    if (updateError && preferred_broker !== undefined) {
      console.warn('[PUT /api/auth/me] DB update with preferred_broker failed, retrying without column in table update:', updateError.message || updateError);
      const fallbackPayload = { ...updatePayload };
      delete fallbackPayload.preferred_broker;

      const retryRes = await db
        .from('users')
        .update(fallbackPayload)
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (!retryRes.error) {
        updated = { ...(retryRes.data || { id: user.id, ...fallbackPayload }), preferred_broker };
        updateError = null;
      }
    }

    if (updateError) {
      console.error('[PUT /api/auth/me] Update failed:', updateError);
      return NextResponse.json({ detail: updateError.message || 'Failed to update profile' }, { status: 400 });
    }

    // Always update Supabase Auth user metadata so buildUserFromSession stays in sync
    try {
      await db.auth.admin.updateUserById(user.id, {
        user_metadata: {
          username: updated?.username || username || user.user_metadata?.username,
          display_name: updated?.display_name || display_name || user.user_metadata?.display_name,
          bio: updated?.bio || bio || user.user_metadata?.bio,
          avatar_url: updated?.avatar_url || avatar_url || user.user_metadata?.avatar_url,
          preferred_broker: preferred_broker || updated?.preferred_broker || user.user_metadata?.preferred_broker || 'Exness',
        },
      });
    } catch (e: any) {
      console.warn('[PUT /api/auth/me] Auth user_metadata update warning:', e?.message);
    }

    const responseData = updated || { id: user.id, ...updatePayload };
    if (!responseData.preferred_broker && preferred_broker) {
      responseData.preferred_broker = preferred_broker;
    }

    return NextResponse.json(responseData);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to update profile', detail: err?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/me — delete account completely (Auth + DB) with strict verification
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await getUserFromRequest(request);

    if (error || !user) {
      return NextResponse.json({ detail: error || 'Not authenticated' }, { status: 401 });
    }

    const userId = user.id;
    const db = getSupabaseAdmin(request);

    // 1. Delete user-owned dependent records
    const tablesToDelete = [
      { name: 'posts', key: 'user_id' },
      { name: 'comments', key: 'user_id' },
      { name: 'reactions', key: 'user_id' },
      { name: 'bookmarks', key: 'user_id' },
      { name: 'messages', key: 'sender_id' },
      { name: 'conversation_members', key: 'user_id' },
      { name: 'session_participants', key: 'user_id' },
      { name: 'notifications', key: 'user_id' },
      { name: 'watchlists', key: 'user_id' },
    ];

    for (const item of tablesToDelete) {
      const { error: delErr } = await db.from(item.name).delete().eq(item.key, userId);
      if (delErr) {
        console.error(`[Account Delete] Failed to delete ${item.name} for user ${userId}:`, delErr.message);
      }
    }

    // Delete follow relationships (both directions)
    await db.from('follows').delete().eq('follower_id', userId);
    await db.from('follows').delete().eq('following_id', userId);

    // 2. Delete public.users profile row
    const { error: userDelErr } = await db.from('users').delete().eq('id', userId);
    if (userDelErr) {
      console.error(`[Account Delete] Failed to delete public.users profile for user ${userId}:`, userDelErr.message);
      return NextResponse.json(
        { success: false, error: 'ACCOUNT_DELETE_FAILED', detail: 'Could not delete application profile record.' },
        { status: 500 }
      );
    }

    // 3. Delete Supabase Auth user identity
    try {
      const { error: authDelErr } = await db.auth.admin.deleteUser(userId);
      if (authDelErr) {
        console.error(`[Account Delete] Supabase auth deleteUser error:`, authDelErr.message);
      }
    } catch (e: any) {
      console.warn('[Account Delete] Supabase auth deleteUser exception:', e?.message);
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete account', detail: err?.message },
      { status: 500 }
    );
  }
}
