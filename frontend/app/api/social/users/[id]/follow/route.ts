import { NextRequest, NextResponse } from 'next/server';
import { toggleFollowSocialUser, findSocialUser } from '@/lib/socialData';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;

    if (!userId) {
      return NextResponse.json({ detail: 'User ID parameter missing' }, { status: 400 });
    }

    const updatedUser = toggleFollowSocialUser(userId);
    if (!updatedUser) {
      return NextResponse.json({ detail: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      is_following: updatedUser.is_following,
      isFollowing: updatedUser.is_following,
      followers_count: updatedUser.followers_count,
      followersCount: updatedUser.followers_count,
      following_count: updatedUser.following_count,
      followingCount: updatedUser.following_count,
    });
  } catch (error: any) {
    console.error('Error toggling follow:', error);
    return NextResponse.json(
      { error: 'Failed to toggle follow status', detail: error?.message },
      { status: 500 }
    );
  }
}
