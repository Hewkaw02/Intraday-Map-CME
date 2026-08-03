import asyncio
import logging
from typing import Dict

from backend.adapters.cme_adapter import CmeAdapter
from backend.state.market_state import market_state, MarketState
from backend.models.cme import CmeSymbolData, CmeDelta

logger = logging.getLogger("CmePollingWorker")

class CmePollingWorker:
    def __init__(self, state: MarketState = market_state, poll_interval_seconds: int = 5):
        self.state = state
        self.poll_interval = poll_interval_seconds
        self.adapter = CmeAdapter()
        self.running = False
        self._task = None

    async def start(self):
        self.running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("[CmePollingWorker] Started background polling worker.")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("[CmePollingWorker] Stopped background polling worker.")

    async def _poll_loop(self):
        # Initial execution
        await self._poll_once()

        while self.running:
            try:
                await asyncio.sleep(self.poll_interval)
                await self._poll_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"[CmePollingWorker] Error in poll loop: {e}")

    async def _poll_once(self):
        try:
            latest_symbols: Dict[str, CmeSymbolData] = self.adapter.load_all_symbols()
            if not latest_symbols:
                return

            deltas: Dict[str, CmeDelta] = {}
            has_changes = False

            for sym, data in latest_symbols.items():
                prev_data = self.state.symbols.get(sym)
                delta = self.adapter.calculate_delta(prev_data, data)
                deltas[sym] = delta

                if not prev_data or prev_data.scrapedAt != data.scrapedAt:
                    has_changes = True

            await self.state.update_symbol_data(latest_symbols, deltas)

            if has_changes:
                await self.state.broadcast_state()

        except Exception as e:
            logger.error(f"[CmePollingWorker] Poll execution failed: {e}")
