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

test('normalizes a bounded news search query', async () => {
  const { parseNewsSearchQuery } = await loadNewsFeed();

  assert.equal(parseNewsSearchQuery('  gold   market  '), 'gold market');
  assert.equal(parseNewsSearchQuery('x'.repeat(120)).length, 80);
  assert.equal(parseNewsSearchQuery('  '), '');
});

test('parses Yahoo Finance search news without inventing article fields', async () => {
  const { parseYahooFinanceSearch } = await loadNewsFeed();
  const articles = parseYahooFinanceSearch({
    news: [{
      uuid: 'provider-id',
      title: 'Gold advances after provider-reported market move',
      publisher: 'Reuters',
      link: 'https://finance.example/gold',
      providerPublishTime: 1791547200,
      relatedTickers: ['GC=F'],
      type: 'VIDEO',
      thumbnail: {
        resolutions: [
          { url: 'https://media.example/small.jpg', width: 140, height: 140 },
          { url: 'https://media.example/original.jpg', width: 1280, height: 720, tag: 'original' },
        ],
      },
    }],
  });

  assert.equal(articles.length, 1);
  assert.equal(articles[0].source, 'Reuters');
  assert.equal(articles[0].url, 'https://finance.example/gold');
  assert.deepEqual(articles[0].asset_tags, ['GC=F']);
  assert.equal(articles[0].content, '');
  assert.equal(articles[0].media_url, 'https://media.example/original.jpg');
  assert.equal(articles[0].media_type, 'video');
});

test('rejects unsafe provider media URLs', async () => {
  const { parseYahooFinanceSearch } = await loadNewsFeed();
  const [article] = parseYahooFinanceSearch({
    news: [{
      uuid: 'unsafe-media',
      title: 'Provider article',
      link: 'https://finance.example/article',
      thumbnail: { resolutions: [{ url: 'javascript:alert(1)', width: 1280, height: 720 }] },
    }],
  });

  assert.equal(article.media_url, null);
  assert.equal(article.media_type, null);
});

test('filters stored news by title, source, content, category, or asset tag', async () => {
  const { filterRelevantNews } = await loadNewsFeed();
  const articles = [
    { id: '1', title: 'Equity update', content: '', source: 'Provider', url: null, published_at: null, category: 'stocks', asset_tags: ['NVDA'] },
    { id: '2', title: 'Currency update', content: '', source: 'Provider', url: null, published_at: null, category: 'forex', asset_tags: ['EURUSD'] },
  ];

  assert.deepEqual(filterRelevantNews(articles, 'nvda').map((item) => item.id), ['1']);
  assert.deepEqual(filterRelevantNews(articles, 'forex').map((item) => item.id), ['2']);
});
