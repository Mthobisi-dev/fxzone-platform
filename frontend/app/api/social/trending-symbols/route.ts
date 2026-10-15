import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabaseServer';
import { fetchLivePrices } from '@/lib/server/marketService';
import { buildTrendingSymbols, countPostSymbolMentions, type TrendPost } from '@/lib/trendingSymbols';

// GET /api/social/trending-symbols — compute trending symbols strictly from real feed posts
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1_000).toISOString();
    const { data: posts, error } = await db
      .from('posts')
      .select('content, asset_tags')
      .or('is_story.is.null,is_story.eq.false')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) console.error('Trending post query failed; using verified market movement only:', error);
    const [quotes, counts] = await Promise.all([
      fetchLivePrices(),
      Promise.resolve(countPostSymbolMentions((posts ?? []) as TrendPost[])),
    ]);
    const result = buildTrendingSymbols(counts, quotes, 5);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error: unknown) {
    console.error('Trending symbols error:', error);
    return NextResponse.json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to load trending symbols.' } }, { status: 500 });
  }
}
