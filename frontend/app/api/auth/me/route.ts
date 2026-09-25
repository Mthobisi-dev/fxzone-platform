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
    if (!await ensureUserProfile(db, user)) {
      return NextResponse.json({ detail: 'Your profile is still being provisioned. Please try again in a moment.' }, { status: 503 });
    }

    const cleanText = (value: unknown, maxLength: number) =>
      typeof value === 'string' ? value.trim().slice(0, maxLength) : undefined;
    const cleanUsername = cleanText(username, 48);
    const cleanDisplayName = cleanText(display_name, 100);
    const cleanBio = cleanText(bio, 1000);
    const cleanAvatarUrl = cleanText(avatar_url, 2000);
    const cleanBroker = cleanText(preferred_broker, 100);

    if (username !== undefined && (!cleanUsername || !/^[a-zA-Z0-9_]+$/.test(cleanUsername))) {
      return NextResponse.json({ detail: 'Username may only contain letters, numbers, and underscores.' }, { status: 400 });
    }
    if (preferred_broker !== undefined && !cleanBroker) {
      return NextResponse.json({ detail: 'Choose a valid preferred broker.' }, { status: 400 });
    }

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (cleanUsername !== undefined) updatePayload.username = cleanUsername;
    if (cleanDisplayName !== undefined) updatePayload.display_name = cleanDisplayName;
    if (cleanBio !== undefined) updatePayload.bio = cleanBio;
    if (cleanAvatarUrl !== undefined) updatePayload.avatar_url = cleanAvatarUrl;
    if (cleanBroker !== undefined) updatePayload.preferred_broker = cleanBroker;

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

    if (updateError) {
      console.error('[PUT /api/auth/me] Update failed:', updateError);
      const missingBrokerColumn = updateError.code === '42703' && cleanBroker !== undefined;
      return NextResponse.json(
        { detail: missingBrokerColumn ? 'Preferred broker is not configured yet. Apply migration 005 or later in Supabase.' : updateError.message || 'Failed to update profile' },
        { status: missingBrokerColumn ? 503 : 400 }
      );
    }
    if (!updated) {
      return NextResponse.json({ detail: 'Profile was not found after provisioning.' }, { status: 503 });
    }

    // Always update Supabase Auth user metadata so buildUserFromSession stays in sync
    try {
      await db.auth.admin.updateUserById(user.id, {
        user_metadata: {
          username: updated?.username || cleanUsername || user.user_metadata?.username,
          display_name: updated?.display_name || cleanDisplayName || user.user_metadata?.display_name,
          bio: updated?.bio || cleanBio || user.user_metadata?.bio,
          avatar_url: updated?.avatar_url || cleanAvatarUrl || user.user_metadata?.avatar_url,
          preferred_broker: updated?.preferred_broker || cleanBroker || user.user_metadata?.preferred_broker || 'Exness',
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

    // 2. Remove the Supabase Auth identity before reporting completion. The
    // previous implementation returned success even when this step failed,
    // leaving an account that could still sign in.
    const { error: authDelErr } = await db.auth.admin.deleteUser(userId);
    if (authDelErr) {
      console.error(`[Account Delete] Supabase auth deleteUser error:`, authDelErr.message);
      return NextResponse.json(
        { success: false, error: 'ACCOUNT_DELETE_FAILED', detail: 'Could not delete the authentication identity.' },
        { status: 502 }
      );
    }

    // 3. Delete the application profile if it was not removed by a foreign-key
    // cascade from auth.users.
    const { error: userDelErr } = await db.from('users').delete().eq('id', userId);
    if (userDelErr) {
      console.error(`[Account Delete] Failed to delete public.users profile for user ${userId}:`, userDelErr.message);
      return NextResponse.json(
        { success: false, error: 'ACCOUNT_DELETE_PARTIAL', detail: 'Authentication was deleted but the profile could not be removed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Account permanently deleted' });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete account', detail: err?.message },
      { status: 500 }
    );
  }
}
