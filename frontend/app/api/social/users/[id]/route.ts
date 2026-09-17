import { NextRequest, NextResponse } from 'next/server';
import { findSocialUser, updateSocialUserProfile } from '@/lib/socialData';

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

    let user = findSocialUser(userId);
    if (!user) {
      // Create user fallback so user profiles render cleanly even if newly registered
      user = updateSocialUserProfile(userId, {
        username: userId,
        display_name: userId,
      });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error(`Error fetching user ${context}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile', detail: error?.message },
      { status: 500 }
    );
  }
}
