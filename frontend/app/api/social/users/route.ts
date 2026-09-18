import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch { return null; }
}

// GET /api/social/users — list/search users from public.users table
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let query = supabaseAdmin
      .from('users')
      .select('id, email, username, display_name, avatar_url, bio, role, followers_count, following_count, created_at')
      .order('followers_count', { ascending: false })
      .limit(limit);

    if (q.trim()) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error('Error fetching social users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', detail: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/social/users — follow a user
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) {
      return NextResponse.json({ detail: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { following_id } = body;

    if (!following_id) {
      return NextResponse.json({ detail: 'following_id is required' }, { status: 400 });
    }

    // Insert follow relationship (ignore duplicate)
    const { data, error } = await supabaseAdmin
      .from('follows')
      .insert({ follower_id: user.id, following_id })
      .select()
      .single();

    if (error && error.code !== '23505') {
      throw error;
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    console.error('Error in social users POST:', error);
    return NextResponse.json(
      { error: 'Operation failed', detail: error?.message },
      { status: 500 }
    );
  }
}
