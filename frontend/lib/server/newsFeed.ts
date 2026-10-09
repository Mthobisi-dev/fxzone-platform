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
