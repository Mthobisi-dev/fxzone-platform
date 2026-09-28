import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/trending-symbols — compute trending symbols strictly from real feed posts
export async function GET() {
  try {
    const { data: posts, error } = await supabaseAdmin
      .from('posts')
      .select('content, asset_tags')
      .or('is_story.is.null,is_story.eq.false')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    const counts: Record<string, number> = {};

    if (posts) {
      posts.forEach((p: any) => {
        const text = [p.content, ...(Array.isArray(p.asset_tags) ? p.asset_tags : [])].filter(Boolean).join(' ').toUpperCase();
        ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', 'AMZN'].forEach((sym) => {
          const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          if (new RegExp(`(^|[^A-Z0-9])${escaped}($|[^A-Z0-9])`).test(text)) {
            counts[sym] = (counts[sym] || 0) + 1;
          }
        });
      });
    }

    const result = Object.entries(counts)
      .map(([symbol, postsCount]) => ({ symbol, posts: postsCount }))
      .sort((a, b) => b.posts - a.posts)
      .slice(0, 5);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: unknown) {
    console.error('Trending symbols error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to load trending symbols.' } }, { status: 500 });
  }
}
