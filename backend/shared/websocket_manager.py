"""FxZone WebSocket connection manager for real-time features."""
import json
import logging
from typing import Dict, Set, Optional, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)


def json_serial(obj: Any) -> Any:
    """JSON serializer for objects not serializable by default json code (UUID, datetime, Enum)."""
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'value'):
        return obj.value
    return str(obj)


class ConnectionManager:
    """Manages WebSocket connections across channels."""

    def __init__(self):
        # channel -> set of (websocket, user_id)
        self._channels: Dict[str, Set] = {}
        # user_id -> set of websockets
        self._user_connections: Dict[str, Set[WebSocket]] = {}
        # websocket -> user_id
        self._ws_to_user: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, channel: str, user_id: Optional[str] = None):
        """Accept and register a WebSocket connection to a channel."""
        await websocket.accept()
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)

        if user_id:
            self._ws_to_user[websocket] = user_id
            if user_id not in self._user_connections:
                self._user_connections[user_id] = set()
            self._user_connections[user_id].add(websocket)

        logger.info(f"WebSocket connected: channel={channel}, user={user_id}")

    async def disconnect(self, websocket: WebSocket, channel: str):
        """Remove a WebSocket connection from a channel."""
        if channel in self._channels:
            self._channels[channel].discard(websocket)
            if not self._channels[channel]:
                del self._channels[channel]

        user_id = self._ws_to_user.pop(websocket, None)
        if user_id and user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]

        logger.info(f"WebSocket disconnected: channel={channel}, user={user_id}")

    async def broadcast(self, channel: str, message: Any):
        """Send a message to all connections in a channel."""
        if channel not in self._channels:
            return

        data = json.dumps(message, default=json_serial) if not isinstance(message, str) else message
        disconnected = set()

        for ws in self._channels[channel]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.add(ws)

        for ws in disconnected:
            await self.disconnect(ws, channel)

    async def send_personal(self, user_id: str, message: Any):
        """Send a message to all connections of a specific user."""
        if user_id not in self._user_connections:
            return

        data = json.dumps(message, default=json_serial) if not isinstance(message, str) else message
        disconnected = set()

        for ws in self._user_connections[user_id]:
            try:
                await ws.send_text(data)
            except Exception:
                disconnected.add(ws)

        # Clean up disconnected sockets
        for ws in disconnected:
            for ch_name, ch_set in list(self._channels.items()):
                if ws in ch_set:
                    await self.disconnect(ws, ch_name)

    def get_active_connections(self, channel: str) -> int:
        """Get count of active connections in a channel."""
        return len(self._channels.get(channel, set()))

    def get_user_channels(self, user_id: str) -> list:
        """Get all channels a user is connected to."""
        channels = []
        for ch_name, ch_set in self._channels.items():
            for ws in ch_set:
                if self._ws_to_user.get(ws) == user_id:
                    channels.append(ch_name)
        return channels

    @property
    def active_connections(self) -> Dict[str, Set]:
        """Alias for backward-compat: channel -> set of websockets."""
        return self._channels

    def get_channel_user_ids(self, channel: str) -> list:
        """Return list of user_ids currently connected to a channel."""
        ws_set = self._channels.get(channel, set())
        return [self._ws_to_user[ws] for ws in ws_set if ws in self._ws_to_user]


# Global connection manager instance
manager = ConnectionManager()
