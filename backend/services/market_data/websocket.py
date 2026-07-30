"""FxZone Market Data WebSocket - Live price streaming."""
import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from shared.websocket_manager import manager
from shared.security import get_ws_user
from services.market_data.providers import price_engine

logger = logging.getLogger(__name__)


async def market_websocket_handler(websocket: WebSocket):
    """Handle WebSocket connections for live market data.
    
    Clients send: {"action": "subscribe", "symbols": ["EURUSD", "BTCUSD"]}
    Server pushes: price updates every 1 second for subscribed symbols
    """
    user = await get_ws_user(websocket)
    user_id = user["user_id"] if user else "anonymous"
    channel = f"market:{user_id}"

    await manager.connect(websocket, channel, user_id)
    subscribed_symbols = set()

    try:
        # Start a background task to push prices
        price_task = asyncio.create_task(
            _push_prices(websocket, subscribed_symbols, channel)
        )

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")

                if action == "subscribe":
                    symbols = msg.get("symbols", [])
                    subscribed_symbols.update(s.upper() for s in symbols)
                    await websocket.send_text(json.dumps({
                        "type": "subscribed",
                        "symbols": list(subscribed_symbols),
                    }))

                elif action == "unsubscribe":
                    symbols = msg.get("symbols", [])
                    subscribed_symbols -= set(s.upper() for s in symbols)
                    await websocket.send_text(json.dumps({
                        "type": "unsubscribed",
                        "symbols": list(subscribed_symbols),
                    }))

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON",
                }))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Market WS error: {e}")
    finally:
        price_task.cancel()
        await manager.disconnect(websocket, channel)


async def _push_prices(websocket: WebSocket, symbols: set, channel: str):
    """Background task to push price updates every second."""
    while True:
        try:
            if symbols:
                prices = await price_engine.get_prices(list(symbols))
                if prices:
                    await websocket.send_text(json.dumps({
                        "type": "prices",
                        "data": prices,
                    }))
            await asyncio.sleep(10)  # 10s interval for real API data (cached 30-60s)
        except Exception:
            break
