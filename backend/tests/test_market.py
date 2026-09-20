import uuid

import httpx

from tests.conftest import yahoo_payload


# ───────────── quotes ─────────────
async def test_quotes_is_an_array_with_change_percent(client, net):
    """The feed page does Array.isArray(quotes) and reads change_percent; the old route returned an object."""
    r = await client.get("/api/market/quotes")
    assert r.status_code == 200 and isinstance(r.json(), list)
    by = {q["symbol"]: q for q in r.json()}
    from app.services.market.catalog import CATALOG
    assert set(by) == {"BTCUSD", "ETHUSD"} | {a.symbol for a in CATALOG if not a.coingecko}   # coingecko mock returns only BTC+ETH
    btc = by["BTCUSD"]
    assert btc["price"] == 60000.5 and btc["change_pct"] == btc["change_percent"] == 2.5 and btc["data_source"] == "coingecko"
    assert btc["is_stale"] is False and btc["bid"] is None and btc["ask"] is None          # no invented spread
    assert by["NVDA"]["data_source"] == "yahoo_finance" and by["NVDA"]["price"] > 0


async def test_prices_shapes(client):
    arr = (await client.get("/api/market/prices")).json()
    assert isinstance(arr, list) and {"symbol", "price", "change", "change_pct", "high", "low", "volume", "open", "timestamp"} <= set(arr[0])
    m = (await client.get("/api/market/prices?symbols=btcusd,EURUSD,NOPE")).json()
    assert set(m) == {"BTCUSD", "EURUSD"}                            # dict when symbols given; unknown ignored


async def test_provider_failure_keeps_last_known_quote_and_marks_it_stale(client, net, app):
    await client.get("/api/market/quotes")                          # warm the cache
    net.coingecko.mock(return_value=httpx.Response(500))
    net.yahoo.mock(return_value=httpx.Response(429))
    await app.state.market.refresh("all")
    q = {x["symbol"]: x for x in (await client.get("/api/market/quotes")).json()}
    assert q["BTCUSD"]["price"] == 60000.5                          # not replaced by an invented fallback
    # age the cache past the stale threshold
    stored = await app.state.cache.get_json("market:quotes")
    stored["BTCUSD"]["fetched_at"] = "2020-01-01T00:00:00+00:00"
    await app.state.cache.set_json("market:quotes", stored, 100)
    app.state.settings.market_refresh_seconds = 10_000             # don't re-fetch inline during this assertion
    q = (await client.get("/api/market/prices?symbols=BTCUSD")).json()
    assert q["BTCUSD"]["is_stale"] is True and q["BTCUSD"]["timestamp"].startswith("2020")
    app.state.settings.market_refresh_seconds = 15


async def test_out_of_order_protection_relies_on_provider_timestamps(client):
    q = (await client.get("/api/market/prices?symbols=BTCUSD")).json()["BTCUSD"]
    assert q["timestamp"].endswith("+00:00")                        # ISO-8601 with tz: the store compares these


async def test_concurrent_cold_requests_hit_upstream_once(client, net):
    import asyncio
    await asyncio.gather(*[client.get("/api/market/quotes") for _ in range(10)])
    assert net.coingecko.call_count == 1


async def test_market_refresh_broadcasts_prices_event_shape(app, net):
    from app import tasks
    from app.realtime import MARKET_TOPIC
    q = await app.state.market.refresh("all")
    data = {s: app.state.market._decorate(v) for s, v in q.items()}
    from fastapi.encoders import jsonable_encoder
    app.state.realtime.publish_nowait(MARKET_TOPIC, "prices", {"data": jsonable_encoder(data)})
    await app.state.realtime.drain()
    topic, event, payload = net.topics("prices")[-1]
    assert topic == "market" and "BTCUSD" in payload["data"]       # useMarketData: socket.on('prices', p => p.data)


# ───────────── history ─────────────
async def test_history_shape_ascending_unique_and_no_random_data(client):
    r = await client.get("/api/market/prices/NVDA/history?timeframe=1d")
    assert r.status_code == 200
    bars = r.json()
    assert len(bars) == 300 and set(bars[0]) == {"time", "open", "high", "low", "close", "volume"}
    times = [b["time"] for b in bars]
    assert times == sorted(set(times)) and all(isinstance(t, int) for t in times)
    assert all(b["low"] <= min(b["open"], b["close"]) and b["high"] >= max(b["open"], b["close"]) for b in bars)
    again = (await client.get("/api/market/prices/NVDA/history?timeframe=1d")).json()
    assert again == bars                                            # deterministic (old route used Math.random())


async def test_history_timeframes_map_to_provider_params(client, net):
    for tf, interval in {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "60m", "4h": "60m", "1d": "1d"}.items():
        assert (await client.get(f"/api/market/prices/EURUSD/history?timeframe={tf}")).status_code == 200
        assert net.yahoo.calls.last.request.url.params["interval"] == interval
    assert net.yahoo.calls.last.request.url.path.endswith("/EURUSD=X")


async def test_history_4h_aggregates(client):
    bars = (await client.get("/api/market/prices/BTCUSD/history?timeframe=4h&limit=50")).json()
    assert all(b["time"] % (4 * 3600) == 0 for b in bars)


async def test_history_limit_and_validation(client):
    assert len((await client.get("/api/market/prices/NVDA/history?timeframe=1d&limit=25")).json()) == 25
    assert (await client.get("/api/market/prices/NOPE/history")).status_code == 404
    assert (await client.get("/api/market/prices/NVDA/history?timeframe=3y")).status_code == 404
    assert (await client.get("/api/market/prices/NVDA/history?limit=1")).status_code == 422
    assert (await client.get("/api/market/prices/asset-btc/history?timeframe=1d")).status_code == 200      # legacy ids resolve


async def test_history_provider_down_is_503_not_fake_candles(client, net):
    net.yahoo.mock(return_value=httpx.Response(503))
    r = await client.get("/api/market/prices/NVDA/history?timeframe=1d")
    assert r.status_code == 503 and "unavailable" in r.json()["detail"]


async def test_history_serves_stale_real_data_when_provider_fails_later(client, net, app):
    good = (await client.get("/api/market/prices/NVDA/history?timeframe=1h")).json()
    await app.state.cache.delete("market:hist:NVDA:1h")             # fresh copy expired, stale copy remains
    net.yahoo.mock(return_value=httpx.Response(500))
    assert (await client.get("/api/market/prices/NVDA/history?timeframe=1h")).json() == good


async def test_yahoo_null_bars_are_dropped(client, net):
    def payload(req):
        p = yahoo_payload(req, n=50)
        q = p["chart"]["result"][0]["indicators"]["quote"][0]
        q["close"][10] = None; q["open"][11] = None
        return httpx.Response(200, json=p)
    net.yahoo.mock(side_effect=payload)
    assert len((await client.get("/api/market/prices/NVDA/history?timeframe=1d&limit=100")).json()) == 48


# ───────────── assets ─────────────
async def test_assets_from_db_catalogue(client, app):
    a = (await client.get("/api/market/assets")).json()
    assert len(a) == 37 and {"id", "symbol", "name", "asset_type", "description", "is_active"} == set(a[0])
    assert all(is_uuid(x["id"]) for x in a)
    fx = (await client.get("/api/market/assets?asset_type=forex")).json()
    assert len(fx) == 8 and {x["asset_type"] for x in fx} == {"forex"}
    assert [x["symbol"] for x in (await client.get("/api/market/assets?q=gold")).json()] == ["XAUUSD"]


def is_uuid(v):
    try:
        uuid.UUID(v); return True
    except ValueError:
        return False


# ───────────── watchlists ─────────────
async def test_watchlist_get_creates_default_with_real_id(client, alice):
    wl = (await client.get("/api/market/watchlist", headers=alice.headers)).json()
    assert len(wl) == 1 and wl[0]["name"] == "My Watchlist" and wl[0]["items"] == [] and is_uuid(wl[0]["id"])
    assert len((await client.get("/api/market/watchlist", headers=alice.headers)).json()) == 1      # not re-created
    assert (await client.get("/api/market/watchlist")).status_code == 401


async def test_add_remove_items_by_symbol_uuid_and_legacy_id(client, alice):
    wid = (await client.get("/api/market/watchlist", headers=alice.headers)).json()[0]["id"]
    base = f"/api/market/watchlist/{wid}/items"
    assert (await client.post(base, json={"symbol": "btcusd"}, headers=alice.headers)).status_code == 200
    assert (await client.post(base, json={"asset_id": "asset-eth", "symbol": "ETHUSD"}, headers=alice.headers)).status_code == 200
    assets = {a["symbol"]: a["id"] for a in (await client.get("/api/market/assets")).json()}
    assert (await client.post(base, json={"asset_id": assets["NVDA"]}, headers=alice.headers)).status_code == 200
    assert (await client.post(base, json={"symbol": "BTCUSD"}, headers=alice.headers)).status_code == 200      # duplicate is a no-op
    items = (await client.get("/api/market/watchlist", headers=alice.headers)).json()[0]["items"]
    assert [i["symbol"] for i in items] == ["BTCUSD", "ETHUSD", "NVDA"] and items[0]["asset_type"] == "crypto"
    assert (await client.delete(f"{base}/BTCUSD", headers=alice.headers)).status_code == 200
    assert (await client.delete(f"{base}/{assets['ETHUSD']}", headers=alice.headers)).status_code == 200
    assert (await client.request("DELETE", base, json={"asset_id": assets["NVDA"]}, headers=alice.headers)).status_code == 200
    assert (await client.get("/api/market/watchlist", headers=alice.headers)).json()[0]["items"] == []
    assert (await client.delete(f"{base}/DOESNOTEXIST", headers=alice.headers)).status_code == 200            # no-op


async def test_placeholder_watchlist_id_resolves_to_users_default(client, alice):
    """The store holds 'watchlist-default' until the first fetch completes."""
    r = await client.post("/api/market/watchlist/watchlist-default/items", json={"symbol": "AAPL", "asset_id": "aapl"}, headers=alice.headers)
    assert r.status_code == 200
    wl = (await client.get("/api/market/watchlist", headers=alice.headers)).json()
    assert len(wl) == 1 and [i["symbol"] for i in wl[0]["items"]] == ["AAPL"]


async def test_watchlists_are_owner_scoped(client, alice, bob):
    """The old routes used the service role with no ownership check: anyone could edit anyone's list."""
    wid = (await client.get("/api/market/watchlist", headers=alice.headers)).json()[0]["id"]
    assert (await client.post(f"/api/market/watchlist/{wid}/items", json={"symbol": "AAPL"}, headers=bob.headers)).status_code == 404
    assert (await client.delete(f"/api/market/watchlist/{wid}/items/AAPL", headers=bob.headers)).status_code == 404
    assert (await client.patch(f"/api/market/watchlist/{wid}", json={"name": "pwn"}, headers=bob.headers)).status_code == 404
    await client.delete(f"/api/market/watchlist/{wid}", headers=bob.headers)
    assert (await client.get("/api/market/watchlist", headers=alice.headers)).json()[0]["id"] == wid          # untouched
    # bob's own default list is separate
    assert (await client.get("/api/market/watchlist", headers=bob.headers)).json()[0]["id"] != wid


async def test_watchlist_crud_and_limits(client, alice):
    r = await client.post("/api/market/watchlist", json={"name": "Crypto"}, headers=alice.headers)
    assert r.status_code == 201 and r.json()["items"] == []
    wid = r.json()["id"]
    assert (await client.patch(f"/api/market/watchlist/{wid}", json={"name": "Majors"}, headers=alice.headers)).json()["name"] == "Majors"
    assert (await client.post("/api/market/watchlist", json={"name": ""}, headers=alice.headers)).status_code == 422
    for i in range(19):   # 1 (Crypto) + 19 = 20, the cap
        assert (await client.post("/api/market/watchlist", json={"name": f"w{i}"}, headers=alice.headers)).status_code == 201
    assert (await client.post("/api/market/watchlist", json={"name": "one too many"}, headers=alice.headers)).status_code == 400
    assert (await client.post(f"/api/market/watchlist/{wid}/items", json={"symbol": "NOPE"}, headers=alice.headers)).status_code == 404
    assert (await client.post(f"/api/market/watchlist/{wid}/items", json={}, headers=alice.headers)).status_code == 422
    assert (await client.delete(f"/api/market/watchlist/{wid}", headers=alice.headers)).status_code == 200


async def test_permanently_failing_provider_is_not_hammered_by_user_traffic(client, net):
    net.coingecko.mock(return_value=httpx.Response(500))
    net.yahoo.mock(return_value=httpx.Response(500))
    for _ in range(15):
        r = await client.get("/api/market/quotes")
        assert r.status_code == 200 and r.json() == []              # honest empty result, not invented prices
    assert net.coingecko.call_count == 1                            # one attempt per throttle window, cluster-wide
