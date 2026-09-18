import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';



// GET /api/social/stories — fetch active (non-expired) story posts
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        created_at,
        expires_at,
        users:user_id (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('is_story', true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const stories = (data || []).map((s: any) => ({
      id: s.id,
      content: s.content,
      image_url: s.image_url,
      created_at: s.created_at,
      expires_at: s.expires_at,
      has_unseen: true, // Can be enhanced with a seen-tracking table later
      user: {
        id: s.users?.id,
        username: s.users?.username,
        display_name: s.users?.display_name,
        avatar_url: s.users?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${s.users?.username}`,
      },
    }));

    return NextResponse.json(stories, {
      headers: { 'Cache-Control': 'no-cache, no-store' },
    });
  } catch (error: any) {
    console.error('Stories fetch error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
