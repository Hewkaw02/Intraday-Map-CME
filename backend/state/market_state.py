import asyncio
from datetime import datetime, timezone
from typing import Dict, Optional, Set, Any
from fastapi import WebSocket

from backend.models.cme import CmeSymbolData, CmeDelta, MarketStatePayload

class MarketState:
    def __init__(self, stale_threshold_seconds: int = 1800):
        self._lock = asyncio.Lock()
        self.symbols: Dict[str, CmeSymbolData] = {}
        self.previous_symbols: Dict[str, CmeSymbolData] = {}
        self.deltas: Dict[str, CmeDelta] = {}
        self.is_stale: bool = False
        self.last_scraped_at: Optional[str] = None
        self.last_update_timestamp: Optional[datetime] = None
        self.stale_threshold_seconds = stale_threshold_seconds
        self.subscribers: Set[WebSocket] = set()

    async def update_symbol_data(self, new_symbols: Dict[str, CmeSymbolData], deltas: Dict[str, CmeDelta]):
        async with self._lock:
            for sym, data in new_symbols.items():
                if sym in self.symbols:
                    self.previous_symbols[sym] = self.symbols[sym]
                self.symbols[sym] = data
                if data.scrapedAt:
                    self.last_scraped_at = data.scrapedAt

            self.deltas = deltas
            self.last_update_timestamp = datetime.now(timezone.utc)
            self._evaluate_staleness()

    def _evaluate_staleness(self):
        if not self.last_scraped_at:
            self.is_stale = True
            return

        try:
            # scrapedAt format: 2026-08-03T04:30:22.004Z
            ts_str = self.last_scraped_at.replace("Z", "+00:00")
            parsed_dt = datetime.fromisoformat(ts_str)
            now_dt = datetime.now(timezone.utc)
            diff = (now_dt - parsed_dt).total_seconds()
            self.is_stale = diff > self.stale_threshold_seconds
        except Exception:
            self.is_stale = False

    async def get_state_payload(self) -> MarketStatePayload:
        async with self._lock:
            self._evaluate_staleness()
            return MarketStatePayload(
                timestamp=datetime.now(timezone.utc).isoformat(),
                symbols=self.symbols,
                deltas=self.deltas,
                isStale=self.is_stale,
                lastScrapedAt=self.last_scraped_at
            )

    async def register_subscriber(self, ws: WebSocket):
        self.subscribers.add(ws)

    async def unregister_subscriber(self, ws: WebSocket):
        self.subscribers.discard(ws)

    async def broadcast_state(self):
        if not self.subscribers:
            return

        payload = await self.get_state_payload()
        payload_dict = payload.model_dump()

        dead_sockets = set()
        for ws in self.subscribers:
            try:
                await ws.send_json({"type": "market_update", "data": payload_dict})
            except Exception:
                dead_sockets.add(ws)

        for ws in dead_sockets:
            self.subscribers.discard(ws)

# Global singleton market state instance
market_state = MarketState()
