import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import {
  fetchYahooFinanceNews,
  filterRelevantNews,
  parseNewsLimit,
  parseNewsSearchQuery,
  toPublicNewsArticle,
  type StoredNewsArticle,
} from '@/lib/server/newsFeed';
import { getSupabaseAdmin } from '@/lib/server/supabaseServer';

function respond(articles: StoredNewsArticle[]) {
  return NextResponse.json(articles.map((article) => toPublicNewsArticle(article)), {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  });
}

/**
 * Returns stored trusted articles first. If ingestion or its database access is
 * unavailable, use the Yahoo Finance provider RSS feed rather than showing a
 * permanent empty error panel to users.
 */
export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const limit = parseNewsLimit(searchParams.get('limit'));
  const query = parseNewsSearchQuery(searchParams.get('q'));
  let storedArticles: StoredNewsArticle[] = [];

  try {
    const admin = getSupabaseAdmin();
    let { data, error } = await admin
      .from('news_articles')
      .select('id, title, content, source, url, published_at, category, asset_tags')
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(query ? 50 : limit);

    // Older FxZone schemas named the article body `summary`. Preserve their
    // real persisted data without reintroducing generated headlines.
    if (error && (error.code === 'PGRST204' || /content.*column|column.*content/i.test(error.message || ''))) {
      const fallback = await admin
        .from('news_articles')
        .select('id, title, summary, source, url, published_at, category, asset_tags')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(query ? 50 : limit);
      data = (fallback.data ?? []).map((article) => ({
        ...article,
        content: typeof article.summary === 'string' ? article.summary : null,
      }));
      error = fallback.error;
    }

    if (error) {
      console.error('News feed query failed:', error);
    } else {
      storedArticles = filterRelevantNews((data ?? []) as StoredNewsArticle[], query).slice(0, limit);
    }
  } catch (error) {
    console.error('News feed route error:', error);
  }

  if (!query && storedArticles.length > 0) return respond(storedArticles);

  try {
    const providerArticles = await fetchYahooFinanceNews(limit, query);
    const merged = [...storedArticles, ...providerArticles].filter(
      (article, index, all) => all.findIndex((candidate) => candidate.id === article.id || (candidate.url && candidate.url === article.url)) === index
    ).slice(0, limit);
    if (merged.length > 0) return respond(merged);
  } catch (error) {
    console.error('Yahoo Finance news fallback failed:', error);
  }

  if (query) return respond([]);

  return apiError('SERVICE_UNAVAILABLE', 'Verified market news is temporarily unavailable.', 503);
}
