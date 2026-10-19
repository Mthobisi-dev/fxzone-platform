export type ProviderNewsArticle = {
  id?: string;
  title?: string;
  content?: string;
  source?: string;
  url?: string | null;
  published_at?: string | null;
  asset_tags?: string[] | null;
};

export type NewsEvidence = {
  source: string;
  publishedAt: string | null;
  assets: string[];
  facts: string[];
  uncertainty: string[];
};

export function buildNewsEvidence(article: ProviderNewsArticle): NewsEvidence {
  const content = String(article.content || '').trim();
  const facts = content
    ? content.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean).slice(0, 4)
    : [];
  const publishedAt = article.published_at && !Number.isNaN(Date.parse(article.published_at)) ? new Date(article.published_at).toISOString() : null;
  return {
    source: String(article.source || 'Provider').slice(0, 100),
    publishedAt,
    assets: Array.from(new Set((article.asset_tags || []).map((tag) => String(tag).toUpperCase().trim()).filter(Boolean))).slice(0, 12),
    facts,
    uncertainty: [
      ...(publishedAt ? [] : ['Publication time was not supplied by the provider.']),
      ...(facts.length ? [] : ['The provider did not supply article facts.']),
    ],
  };
}
