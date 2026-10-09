const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadNewsFeed() {
  return import('./newsFeed.ts');
}

test('clamps a public news-feed limit to a safe bounded range', async () => {
  const { parseNewsLimit } = await loadNewsFeed();

  assert.equal(parseNewsLimit(null), 20);
  assert.equal(parseNewsLimit('3'), 3);
  assert.equal(parseNewsLimit('999'), 50);
  assert.equal(parseNewsLimit('-1'), 20);
  assert.equal(parseNewsLimit('not-a-number'), 20);
});

test('maps stored provider news without manufacturing a sentiment claim', async () => {
  const { toPublicNewsArticle } = await loadNewsFeed();
  const article = toPublicNewsArticle({
    id: 'article-1',
    title: 'A provider-supplied title',
    content: 'Provider-supplied summary',
    source: 'Verified Provider',
    url: 'https://example.com/article',
    published_at: '2026-10-09T10:00:00.000Z',
    asset_tags: ['NVDA'],
  });

  assert.equal(article.source, 'Verified Provider');
  assert.equal('sentiment' in article, false);
  assert.equal('sentiment_score' in article, false);
  assert.deepEqual(article.asset_tags, ['NVDA']);
});
