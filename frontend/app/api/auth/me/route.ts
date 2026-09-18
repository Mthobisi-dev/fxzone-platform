import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



// GET /api/auth/me — returns user profile from public.users via the session token
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    // Verify session with admin client
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ detail: 'Invalid session' }, { status: 401 });
    }

    // Fetch profile from public.users
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Profile row may not exist yet (new user) — return from auth metadata
      const meta = user.user_metadata || {};
      return NextResponse.json({
        id: user.id,
        email: user.email,
        username: meta.username || user.email?.split('@')[0] || 'user',
        display_name: meta.display_name || meta.full_name || meta.name || '',
        avatar_url: meta.avatar_url || meta.picture || null,
        bio: meta.bio || '',
        role: meta.role || 'trader',
        followers_count: 0,
        following_count: 0,
      });
    }

    return NextResponse.json(profile);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch profile', detail: error?.message },
      { status: 500 }
    );
  }
}

// PUT /api/auth/me — update user profile in public.users
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return NextResponse.json({ detail: 'Invalid session' }, { status: 401 });
    }

    const body = await request.json();
    const { username, display_name, bio, avatar_url } = body;

    const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (username !== undefined) updatePayload.username = username;
    if (display_name !== undefined) updatePayload.display_name = display_name;
    if (bio !== undefined) updatePayload.bio = bio;
    if (avatar_url !== undefined) updatePayload.avatar_url = avatar_url;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updatePayload)
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Also update Supabase auth metadata so buildUserFromSession stays in sync
    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        username: updated.username,
        display_name: updated.display_name,
        bio: updated.bio,
        avatar_url: updated.avatar_url,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update profile', detail: error?.message },
      { status: 500 }
    );
  }
}
