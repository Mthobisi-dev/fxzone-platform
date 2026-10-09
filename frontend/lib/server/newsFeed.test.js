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

test('parses Yahoo Finance RSS entries as source-linked provider articles', async () => {
  const { parseYahooFinanceRss } = await loadNewsFeed();
  const articles = parseYahooFinanceRss(`<?xml version="1.0"?><rss><channel><item>
    <guid>https://finance.example/article</guid>
    <title><![CDATA[Markets react to provider-reported results]]></title>
    <link>https://finance.example/article</link>
    <pubDate>Fri, 09 Oct 2026 12:00:00 GMT</pubDate>
    <source url="https://finance.example">Example Finance</source>
  </item></channel></rss>`);

  assert.equal(articles.length, 1);
  assert.equal(articles[0].id, 'https://finance.example/article');
  assert.equal(articles[0].title, 'Markets react to provider-reported results');
  assert.equal(articles[0].source, 'Example Finance');
  assert.equal(articles[0].url, 'https://finance.example/article');
  assert.equal(articles[0].content, '');
});
