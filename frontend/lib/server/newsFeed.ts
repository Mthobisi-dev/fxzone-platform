export interface StoredNewsArticle {
  id: string;
  title: string;
  content: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  category: string | null;
  asset_tags: string[] | null;
  media_url?: string | null;
  media_type?: 'image' | 'video' | null;
}

export function parseNewsLimit(value: string | null): number {
  if (!value) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, 50);
}

export function parseNewsSearchQuery(value: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

export function filterRelevantNews(articles: StoredNewsArticle[], query: string): StoredNewsArticle[] {
  const terms = parseNewsSearchQuery(query).toLowerCase().split(' ').filter(Boolean);
  if (terms.length === 0) return articles;
  return articles.filter((article) => {
    const searchable = [
      article.title,
      article.content,
      article.source,
      article.category,
      ...(article.asset_tags ?? []),
    ].filter(Boolean).join(' ').toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

/**
 * Passes through provider-supplied article fields. No sentiment or summary is
 * created by this service because neither can be inferred from a headline.
 */
export function toPublicNewsArticle(article: StoredNewsArticle) {
  return {
    id: article.id,
    title: article.title,
    content: article.content ?? '',
    source: article.source ?? 'Unknown provider',
    url: article.url,
    published_at: article.published_at,
    category: article.category,
    asset_tags: Array.isArray(article.asset_tags) ? article.asset_tags : [],
    media_url: safeExternalUrl(article.media_url ?? null),
    media_type: article.media_type === 'video' || article.media_type === 'image' ? article.media_type : null,
  };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, '$1')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]*>/g, '')
    .trim();
}

function rssTag(item: string, name: string): string | null {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeXmlText(match[1]) || null : null;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Parses provider RSS without adding a generated summary or sentiment claim. */
export function parseYahooFinanceRss(xml: string): StoredNewsArticle[] {
  const itemMatches = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const seen = new Set<string>();
  const articles: StoredNewsArticle[] = [];

  for (const item of itemMatches) {
    const title = rssTag(item, 'title');
    const url = safeExternalUrl(rssTag(item, 'link'));
    const guid = rssTag(item, 'guid');
    const id = safeExternalUrl(guid) ?? url;
    if (!title || !id || seen.has(id)) continue;
    seen.add(id);

    const parsedDate = rssTag(item, 'pubDate');
    const publishedAt = parsedDate && Number.isFinite(Date.parse(parsedDate))
      ? new Date(parsedDate).toISOString()
      : null;
    articles.push({
      id,
      title,
      content: '',
      source: rssTag(item, 'source') ?? 'Yahoo Finance',
      url,
      published_at: publishedAt,
      category: 'markets',
      asset_tags: [],
    });
  }

  return articles;
}

interface YahooFinanceSearchNews {
  uuid?: unknown;
  title?: unknown;
  publisher?: unknown;
  link?: unknown;
  providerPublishTime?: unknown;
  relatedTickers?: unknown;
  type?: unknown;
  thumbnail?: {
    resolutions?: Array<{
      url?: unknown;
      width?: unknown;
      height?: unknown;
      tag?: unknown;
    }>;
  };
}

interface YahooFinanceSearchPayload {
  news?: YahooFinanceSearchNews[];
}

export function parseYahooFinanceSearch(payload: YahooFinanceSearchPayload): StoredNewsArticle[] {
  if (!Array.isArray(payload?.news)) return [];
  const seen = new Set<string>();
  const articles: StoredNewsArticle[] = [];
  for (const item of payload.news) {
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const url = safeExternalUrl(typeof item.link === 'string' ? item.link : null);
    const providerId = typeof item.uuid === 'string' ? item.uuid.trim() : '';
    const id = providerId || url;
    if (!id || !title || seen.has(id)) continue;
    seen.add(id);
    const publishSeconds = typeof item.providerPublishTime === 'number' ? item.providerPublishTime : Number(item.providerPublishTime);
    const thumbnails = Array.isArray(item.thumbnail?.resolutions)
      ? item.thumbnail.resolutions.flatMap((resolution) => {
          const url = safeExternalUrl(typeof resolution.url === 'string' ? resolution.url : null);
          if (!url) return [];
          const width = Number(resolution.width);
          const height = Number(resolution.height);
          return [{
            url,
            area: Number.isFinite(width) && Number.isFinite(height) ? width * height : 0,
            original: resolution.tag === 'original',
          }];
        })
      : [];
    const preferredThumbnail = thumbnails.find((thumbnail) => thumbnail.original)
      ?? thumbnails.sort((left, right) => right.area - left.area)[0]
      ?? null;
    const mediaType = preferredThumbnail
      ? (item.type === 'VIDEO' ? 'video' : 'image')
      : null;
    articles.push({
      id,
      title,
      content: '',
      source: typeof item.publisher === 'string' && item.publisher.trim() ? item.publisher.trim() : 'Yahoo Finance',
      url,
      published_at: Number.isFinite(publishSeconds) && publishSeconds > 0 ? new Date(publishSeconds * 1_000).toISOString() : null,
      category: 'markets',
      asset_tags: Array.isArray(item.relatedTickers)
        ? item.relatedTickers.filter((ticker): ticker is string => typeof ticker === 'string').slice(0, 12)
        : [],
      media_url: preferredThumbnail?.url ?? null,
      media_type: mediaType,
    });
  }
  return articles;
}

/** Returns current headlines from a trusted provider when ingestion is absent. */
export async function fetchYahooFinanceNews(limit: number, query = ''): Promise<StoredNewsArticle[]> {
  const normalizedQuery = parseNewsSearchQuery(query);
  const providerQuery = normalizedQuery || 'markets';
  try {
    const searchUrl = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    searchUrl.searchParams.set('q', providerQuery);
    searchUrl.searchParams.set('quotesCount', '0');
    searchUrl.searchParams.set('newsCount', String(Math.min(Math.max(limit, 1), 50)));
    const response = await fetch(searchUrl, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Yahoo Finance search returned ${response.status}.`);
    const providerArticles = parseYahooFinanceSearch(await response.json())
      .sort((left, right) => Date.parse(right.published_at ?? '') - Date.parse(left.published_at ?? ''))
      .slice(0, limit);
    if (providerArticles.length > 0 || normalizedQuery) return providerArticles;
  } catch (error) {
    if (normalizedQuery) throw error;
  }

  // The provider RSS feed is retained as a latest-news fallback. It contains
  // no media, so the UI simply renders those entries without a preview.
  const url = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EDJI%2C%5EGSPC%2C%5EIXIC&region=US&lang=en-US';
  const response = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Yahoo Finance RSS returned ${response.status}.`);
  return parseYahooFinanceRss(await response.text()).slice(0, limit);
}
