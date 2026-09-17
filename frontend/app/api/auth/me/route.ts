import { NextRequest, NextResponse } from 'next/server';
import { updateSocialUserProfile, findSocialUser } from '@/lib/socialData';

export async function GET(request: NextRequest) {
  try {
    const defaultUser = findSocialUser('user-allex') || {
      id: 'me',
      username: 'trader',
      display_name: 'FxZone Trader',
      bio: 'Market Analyst & Technical Trader',
      avatar_url: null,
      role: 'trader',
    };
    return NextResponse.json(defaultUser);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch auth me', detail: error?.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body) {
      return NextResponse.json({ detail: 'Request body missing' }, { status: 400 });
    }

    const { username, display_name, bio, avatar_url, id } = body;
    const targetIdentifier = id || username || 'me';

    const updatedUser = updateSocialUserProfile(targetIdentifier, {
      username: username || undefined,
      display_name: display_name || undefined,
      bio: bio || undefined,
      avatar_url: avatar_url || undefined,
    });

    return NextResponse.json({
      id: updatedUser.id,
      username: updatedUser.username,
      display_name: updatedUser.display_name,
      displayName: updatedUser.display_name,
      bio: updatedUser.bio,
      avatar_url: updatedUser.avatar_url,
      avatarUrl: updatedUser.avatar_url,
      role: updatedUser.role,
      followers_count: updatedUser.followers_count,
      following_count: updatedUser.following_count,
    });
  } catch (error: any) {
    console.error('Error updating profile in /api/auth/me:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', detail: error?.message },
      { status: 500 }
    );
  }
}
