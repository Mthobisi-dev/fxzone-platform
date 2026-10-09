import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { parseNewsLimit, toPublicNewsArticle, type StoredNewsArticle } from '@/lib/server/newsFeed';
import { getSupabaseAdmin } from '@/lib/server/supabaseServer';

/** Returns only articles stored by a configured, trusted news ingestion path. */
export async function GET(request: Request) {
  const limit = parseNewsLimit(new URL(request.url).searchParams.get('limit'));

  try {
    const admin = getSupabaseAdmin();
    let { data, error } = await admin
      .from('news_articles')
      .select('id, title, content, source, url, published_at, category, asset_tags')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    // Older FxZone schemas named the article body `summary`. Preserve their
    // real persisted data without reintroducing generated headlines.
    if (error && (error.code === 'PGRST204' || /content.*column|column.*content/i.test(error.message || ''))) {
      const fallback = await admin
        .from('news_articles')
        .select('id, title, summary, source, url, published_at, category, asset_tags')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      data = (fallback.data ?? []).map((article) => ({
        ...article,
        content: typeof article.summary === 'string' ? article.summary : null,
      }));
      error = fallback.error;
    }

    if (error) {
      console.error('News feed query failed:', error);
      return apiError('SERVICE_UNAVAILABLE', 'Verified market news is temporarily unavailable.', 503);
    }

    return NextResponse.json((data ?? []).map((article) => toPublicNewsArticle(article as StoredNewsArticle)), {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('News feed route error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'Verified market news is temporarily unavailable.', 503);
  }
}
