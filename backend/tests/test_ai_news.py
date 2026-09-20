import httpx
import pytest

from app.services import ai as ai_mod
from app.services.news import parse_feed, score_headline, categorize, clean_text
from tests.conftest import yahoo_payload


def bars(closes, spread=1.0):
    return [{"time": 1_700_000_000 + i * 86400, "open": c, "high": c + spread, "low": c - spread, "close": c, "volume": 1} for i, c in enumerate(closes)]


# ───────────── pure analysis ─────────────
def test_uptrend_is_bullish_and_computed_from_data():
    a = ai_mod.compute_analysis("NVDA", bars([100 + i * 0.8 for i in range(260)]))
    assert a["sentiment"] == "bullish" and a["confidence"] >= 0.6 and a["confidence_basis"] == "indicator_agreement"
    i = a["indicators"]
    assert i["ema20"] > i["ema50"] > i["ema200"] and a["price"] > i["ema20"]
    assert a["votes"]["price_vs_ema200"] == 1 and a["votes"]["ema_alignment"] == 1
    lv = a["levels"]["illustrative_volatility_levels"]
    assert lv["direction"] == "long" and lv["stop"] < a["price"] < lv["target_1"] < lv["target_2"]
    assert "not a trade recommendation" in lv["note"]


def test_downtrend_is_bearish_with_short_levels():
    a = ai_mod.compute_analysis("EURUSD", bars([300 - i * 0.8 for i in range(260)]))
    assert a["sentiment"] == "bearish"
    lv = a["levels"]["illustrative_volatility_levels"]
    assert lv["direction"] == "short" and lv["target_2"] < lv["target_1"] < a["price"] < lv["stop"]


def test_sideways_market_is_neutral_low_agreement():
    # range-bound: +-0.2% noise around 100, well inside the 0.5% dead-band
    a = ai_mod.compute_analysis("XAUUSD", bars([100 + (0.2 if i % 2 else -0.2) for i in range(260)], spread=0.3))
    assert a["sentiment"] == "neutral" and a["confidence"] < 0.4
    assert a["votes"]["price_vs_ema200"] == 0 and a["votes"]["ema_alignment"] == 0


def test_dead_band_stops_noise_around_the_average_from_being_a_signal():
    flat = [100.0] * 259
    near = ai_mod.compute_analysis("NVDA", bars(flat + [100.3]))     # +0.3% above EMA200: inside the band
    far = ai_mod.compute_analysis("NVDA", bars(flat + [101.5]))      # +1.5%: outside it
    assert near["votes"]["price_vs_ema200"] == 0 and far["votes"]["price_vs_ema200"] == 1


def test_insufficient_history_is_refused_not_guessed():
    from app.errors import BadRequest
    with pytest.raises(BadRequest):
        ai_mod.compute_analysis("NVDA", bars([100.0] * 20))


def test_short_history_skips_unavailable_indicators_instead_of_inventing_them():
    a = ai_mod.compute_analysis("NVDA", bars([100 + i * 0.5 for i in range(60)]))
    assert a["indicators"]["ema200"] is None and "price_vs_ema200" not in a["votes"]
    assert "n/a" in ai_mod.render_markdown(a, "NVIDIA")


def test_markdown_contains_disclaimer_and_only_computed_numbers():
    a = ai_mod.compute_analysis("NVDA", bars([100 + i * 0.8 for i in range(260)]))
    md = ai_mod.render_markdown(a, "NVIDIA")
    assert ai_mod.DISCLAIMER in md and "RSI(14)" in md and "Smart Money" not in md and "Order Block" not in md
    assert "indicator agreement" in md                                   # the % shown is labelled for what it is
    assert not any(w in md.lower() for w in ("probability", "win rate", "guaranteed", "profit"))


# ───────────── endpoints ─────────────
async def test_sentiment_endpoint_shape_for_frontend(client, alice):
    r = await client.get("/api/ai/sentiment/NVDA", headers=alice.headers)
    assert r.status_code == 200
    b = r.json()
    assert b["symbol"] == "NVDA" and b["sentiment"] in ("bullish", "bearish", "neutral") and 0 <= b["confidence"] <= 1
    assert b["summary"] == b["analysis"] and b["source"] == "rules" and b["disclaimer"] and b["as_of"]
    assert {"rsi14", "ema20", "macd_histogram", "atr14"} <= set(b["indicators"])
    assert (await client.get("/api/ai/sentiment/NOPE", headers=alice.headers)).status_code == 400
    assert (await client.get("/api/ai/sentiment/NVDA")).status_code == 401       # costs money when Gemini is on -> auth required


async def test_sentiment_is_cached(client, alice, net):
    await client.get("/api/ai/sentiment/AAPL", headers=alice.headers)
    n = net.yahoo.call_count
    await client.get("/api/ai/sentiment/AAPL", headers=alice.headers)
    assert net.yahoo.call_count == n


async def test_insights_endpoint_shape_and_anonymous_access(client):
    r = await client.get("/api/ai/insights")
    assert r.status_code == 200
    ins = r.json()["insights"]
    assert [i["symbol"] for i in ins] == ["NVDA", "BTCUSD", "EURUSD", "XAUUSD"]
    i = ins[0]
    assert {"symbol", "name", "sentiment", "confidence", "summary", "keyPoints", "timestamp"} <= set(i)
    assert 0 <= i["confidence"] <= 1 and i["source"] == "indicators" and isinstance(i["keyPoints"], list)


async def test_insights_degrade_to_empty_when_data_provider_down(client, net):
    net.yahoo.mock(return_value=httpx.Response(500))
    r = await client.get("/api/ai/insights")
    assert r.status_code == 200 and r.json() == {"insights": []}     # no canned insights


async def test_ai_chat_symbol_detection_and_history(client, alice):
    r = await client.post("/api/ai/chat", json={"message": "Analyze NVDA please"}, headers=alice.headers)
    b = r.json()
    assert r.status_code == 200 and "NVIDIA" in b["message"] and b["reply"] == b["message"] and b["conversation_id"]
    r2 = await client.post("/api/ai/chat", json={"message": "what about my methods and solutions", "conversation_id": b["conversation_id"]}, headers=alice.headers)
    assert "technical snapshot" not in r2.json()["message"]           # 'eth'/'sol' inside words no longer trigger analyses
    assert "Market snapshot" in r2.json()["message"]
    assert (await client.post("/api/ai/chat", json={"message": ""}, headers=alice.headers)).status_code == 400
    assert (await client.post("/api/ai/chat", json={"prompt": "gold outlook"}, headers=alice.headers)).status_code == 200   # legacy key
    assert (await client.post("/api/ai/chat", json={"message": "hi", "conversation_id": "../../etc"}, headers=alice.headers)).status_code == 400
    assert (await client.post("/api/ai/chat", json={"message": "hi"})).status_code == 401


async def test_ai_chat_without_price_data_says_so(client, alice, net):
    net.yahoo.mock(return_value=httpx.Response(500))
    net.coingecko.mock(return_value=httpx.Response(500))
    r = await client.post("/api/ai/chat", json={"message": "Analyze TSLA"}, headers=alice.headers)
    assert r.status_code == 200 and "technical snapshot" not in r.json()["message"]


# ───────────── Gemini (mocked; not verified against the live API) ─────────────
GEMINI_OK = {"candidates": [{"content": {"parts": [{"text": "Narrated commentary using the given numbers."}]}}]}


async def test_gemini_narrates_computed_data_only(app, client, alice, net):
    app.state.settings.gemini_api_key = "g-key"
    try:
        net.gemini.mock(return_value=httpx.Response(200, json=GEMINI_OK))
        b = (await client.get("/api/ai/sentiment/MSFT", headers=alice.headers)).json()
        assert b["source"] == "gemini" and b["summary"] == "Narrated commentary using the given numbers."
        assert b["indicators"]["rsi14"] is not None                       # numbers still come from our computation
        call = net.gemini.calls.last.request
        assert call.headers["x-goog-api-key"] == "g-key" and "key=" not in str(call.url)   # key in header, never in URL/logs
        import json
        sent = json.loads(call.content)
        assert "ONLY the numbers" in sent["systemInstruction"]["parts"][0]["text"]
        assert "rsi14" in sent["contents"][0]["parts"][0]["text"]
    finally:
        app.state.settings.gemini_api_key = None


async def test_gemini_failure_falls_back_to_rules(app, client, alice, net):
    app.state.settings.gemini_api_key = "g-key"
    try:
        for resp in (httpx.Response(500), httpx.Response(200, json={"candidates": []}), httpx.Response(200, json={"error": "x"})):
            await app.state.cache.delete("ai:analysis:GOOGL:1")
            net.gemini.mock(return_value=resp)
            b = (await client.get("/api/ai/sentiment/GOOGL", headers=alice.headers)).json()
            assert b["source"] == "rules" and "technical snapshot" in b["summary"]
        net.gemini.mock(side_effect=httpx.ReadTimeout("slow"))
        await app.state.cache.delete("ai:analysis:GOOGL:1")
        assert (await client.get("/api/ai/sentiment/GOOGL", headers=alice.headers)).json()["source"] == "rules"
    finally:
        app.state.settings.gemini_api_key = None


async def test_gemini_chat_gets_computed_context_and_history(app, client, alice, net):
    app.state.settings.gemini_api_key = "g-key"
    try:
        net.gemini.mock(return_value=httpx.Response(200, json=GEMINI_OK))
        a = (await client.post("/api/ai/chat", json={"message": "Analyze BTC"}, headers=alice.headers)).json()
        assert a["source"] == "gemini"
        await client.post("/api/ai/chat", json={"message": "and now gold?", "conversation_id": a["conversation_id"]}, headers=alice.headers)
        import json
        body = json.loads(net.gemini.calls.last.request.content)
        roles = [c["role"] for c in body["contents"]]
        assert roles == ["user", "model", "user"]                          # previous turn is carried
        assert "Computed market data" in body["contents"][-1]["parts"][0]["text"] and "XAUUSD" in body["contents"][-1]["parts"][0]["text"]
    finally:
        app.state.settings.gemini_api_key = None


# ───────────── news ─────────────
RSS = """<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Bitcoin surges to record high as ETF inflows jump</title><link>https://news.example.com/a1</link>
<description>&lt;p&gt;Crypto rally &lt;b&gt;continues&lt;/b&gt; as BTC climbs.&lt;/p&gt;</description><pubDate>Mon, 01 Jan 2029 10:00:00 GMT</pubDate></item>
<item><title>BREAKING: Fed cuts rates, dollar slides against euro</title><link>https://news.example.com/a2</link><description>EUR/USD moves.</description><pubDate>{now}</pubDate></item>
<item><title>Bad link item</title><link>javascript:alert(1)</link></item>
<item><title></title><link>https://news.example.com/empty</link></item>
</channel></rss>"""

ATOM = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Gold slips as yields rise</title>
<link href="https://news.example.com/g1"/><summary>Gold falls.</summary><updated>2026-09-01T10:00:00Z</updated></entry></feed>"""


def test_parse_rss_extracts_tags_sentiment_and_drops_bad_items():
    items = parse_feed(RSS.format(now="Mon, 01 Jan 2029 10:00:00 GMT"), "Src")
    assert [i["url"] for i in items] == ["https://news.example.com/a1", "https://news.example.com/a2"]   # javascript: + empty title dropped
    a1, a2 = items
    assert a1["symbols"] == ["BTCUSD"] and a1["category"] == "crypto" and a1["sentiment"] == "bullish" and a1["summary"] == "Crypto rally continues as BTC climbs."
    assert a2["breaking"] is True and "EURUSD" in a2["symbols"] and a2["category"] == "forex"


def test_parse_atom():
    (g,) = parse_feed(ATOM, "Atom")
    assert g["url"] == "https://news.example.com/g1" and g["symbols"] == ["XAUUSD"] and g["sentiment"] == "neutral" or g["sentiment"] == "bearish"


def test_xml_bombs_and_external_entities_are_rejected():
    from defusedxml.common import DefusedXmlException
    bomb = '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><rss><channel><item><title>&b;</title><link>https://x.io</link></item></channel></rss>'
    with pytest.raises(DefusedXmlException):
        parse_feed(bomb, "x")
    xxe = '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&x;</title><link>https://x.io</link></item></channel></rss>'
    with pytest.raises(DefusedXmlException):
        parse_feed(xxe, "x")


def test_sentiment_and_helpers():
    assert score_headline("Stocks plunge on recession fears")[1] == "bearish"
    assert score_headline("Company announces new office")[1] == "neutral"
    assert categorize("Oil and gold prices", []) == "commodity"
    assert clean_text("<script>alert(1)</script>Hi&amp;bye", 50) == "alert(1) Hi&bye"         # tags stripped (frontend renders text, never innerHTML)


async def test_news_feed_is_empty_until_ingested_then_real(app, client, net):
    assert (await client.get("/api/news/feed?limit=20")).json() == []                 # old route always returned 4 fake stories
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
    net.rss.mock(return_value=httpx.Response(200, text=RSS.format(now=now)))
    from app.services.news import NewsService
    svc = NewsService(app.state.db, app.state.http, app.state.realtime, [("Example", "https://feeds.example.com/rss")])
    assert await svc.ingest_once() == 2
    assert await svc.ingest_once() == 0                                               # idempotent (unique url)
    await app.state.realtime.drain()
    breaking = net.topics("breaking_news")
    assert len(breaking) == 1 and breaking[0][0] == "news" and breaking[0][2]["data"]["title"].startswith("BREAKING")
    items = (await client.get("/api/news/feed?limit=20")).json()
    assert len(items) == 2
    it = {i["url"]: i for i in items}["https://news.example.com/a1"]
    assert it["sentiment"] == "bullish" and it["sentiment_label"] == "bullish" and it["asset_tags"] == ["BTCUSD"] and it["summary"]
    assert [i["url"] for i in (await client.get("/api/news/feed?category=crypto")).json()] == ["https://news.example.com/a1"]
    assert [i["url"] for i in (await client.get("/api/news/feed?symbol=eurusd")).json()] == ["https://news.example.com/a2"]


@pytest.mark.parametrize("stamp", ["Mon, 01 Jan 2024 10:00:00 GMT", "Mon, 01 Jan 2029 10:00:00 GMT"])   # old, and future-dated
async def test_old_or_future_dated_articles_are_not_announced_as_breaking(app, net, stamp):
    net.rss.mock(return_value=httpx.Response(200, text=RSS.format(now=stamp)))
    from app.services.news import NewsService
    svc = NewsService(app.state.db, app.state.http, app.state.realtime, [("Example", "https://feeds.example.com/rss")])
    await svc.ingest_once(); await app.state.realtime.drain()
    assert net.topics("breaking_news") == []
    newest = await app.state.db.fetchval("SELECT max(published_at) FROM news_articles")
    from datetime import datetime, timezone
    assert newest <= datetime.now(timezone.utc)                            # future dates are clamped


async def test_one_broken_feed_does_not_stop_the_others(app, net):
    net.rss.mock(side_effect=lambda req: httpx.Response(500) if "bad" in str(req.url) else httpx.Response(200, text=ATOM))
    from app.services.news import NewsService
    svc = NewsService(app.state.db, app.state.http, app.state.realtime,
                      [("Bad", "https://feeds.example.com/bad"), ("Good", "https://feeds.example.com/good")])
    assert await svc.ingest_once() == 1
