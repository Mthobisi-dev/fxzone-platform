import { NextRequest, NextResponse } from 'next/server';
import { getAllSocialUsers, createSocialUser } from '@/lib/socialData';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const users = getAllSocialUsers(q, limit);
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Error fetching social users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', detail: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body || !body.username) {
      return NextResponse.json(
        { detail: 'Username is required to create or add a trader' },
        { status: 400 }
      );
    }

    const newUser = createSocialUser({
      username: body.username,
      display_name: body.display_name || body.displayName,
      role: body.role,
      bio: body.bio,
      avatar_url: body.avatar_url || body.avatarUrl,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    console.error('Error creating social user:', error);
    return NextResponse.json(
      { error: 'Failed to create user', detail: error?.message },
      { status: 500 }
    );
  }
}
