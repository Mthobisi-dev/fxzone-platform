export interface StoredNewsArticle {
  id: string;
  title: string;
  content: string | null;
  source: string | null;
  url: string | null;
  published_at: string | null;
  category: string | null;
  asset_tags: string[] | null;
}

export function parseNewsLimit(value: string | null): number {
  if (!value) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, 50);
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

/** Returns current headlines from a trusted provider when ingestion is absent. */
export async function fetchYahooFinanceNews(limit: number): Promise<StoredNewsArticle[]> {
  const url = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EDJI%2C%5EGSPC%2C%5EIXIC&region=US&lang=en-US';
  const response = await fetch(url, {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Yahoo Finance RSS returned ${response.status}.`);
  return parseYahooFinanceRss(await response.text()).slice(0, limit);
}
