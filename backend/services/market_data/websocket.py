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
    Server pushes: price updates periodically for subscribed symbols
    """
    user = await get_ws_user(websocket)
    user_id = user["user_id"] if user else "anonymous"
    channel = f"market:{user_id}"

    await manager.connect(websocket, channel, user_id)
    subscribed_symbols = set()
    send_lock = asyncio.Lock()

    async def _safe_send(payload: dict):
        async with send_lock:
            try:
                await websocket.send_text(json.dumps(payload))
            except Exception:
                pass

    try:
        # Start a background task to push prices
        price_task = asyncio.create_task(
            _push_prices(websocket, subscribed_symbols, _safe_send)
        )

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                action = msg.get("action")

                if action == "subscribe":
                    symbols = msg.get("symbols", [])
                    subscribed_symbols.update(s.upper() for s in symbols)
                    await _safe_send({
                        "type": "subscribed",
                        "symbols": list(subscribed_symbols),
                    })

                elif action == "unsubscribe":
                    symbols = msg.get("symbols", [])
                    subscribed_symbols -= set(s.upper() for s in symbols)
                    await _safe_send({
                        "type": "unsubscribed",
                        "symbols": list(subscribed_symbols),
                    })

            except json.JSONDecodeError:
                await _safe_send({
                    "type": "error",
                    "message": "Invalid JSON",
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"Market WS error: {e}")
    finally:
        price_task.cancel()
        await manager.disconnect(websocket, channel)


async def _push_prices(websocket: WebSocket, symbols: set, send_func):
    """Background task to push price updates periodically."""
    while True:
        try:
            current_symbols = list(symbols.copy())
            if current_symbols:
                prices = await price_engine.get_prices(current_symbols)
                if prices:
                    await send_func({
                        "type": "prices",
                        "data": prices,
                    })
            await asyncio.sleep(5)  # 5s interval for real-time market polling
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(5)
