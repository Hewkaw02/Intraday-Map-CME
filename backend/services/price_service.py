import logging
import time
import math
import random
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional

from backend.models.cme import PriceResponse, PriceCandle
from backend.state.market_state import market_state

logger = logging.getLogger("PriceService")

# Try imports
HAS_TVDATAFEED = False
try:
    from tvDatafeed import TvDatafeed, Interval
    HAS_TVDATAFEED = True
except ImportError:
    try:
        from tvdatafeed import TvDatafeed, Interval
        HAS_TVDATAFEED = True
    except ImportError:
        HAS_TVDATAFEED = False

HAS_YFINANCE = False
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False


SYMBOL_MAP = {
    "GC": {"tv_symbol": "GOLD", "tv_exchange": "TVC", "yf_symbol": "GC=F", "name": "Gold Futures", "default_price": 4094.3},
    "NQ": {"tv_symbol": "NQ1!", "tv_exchange": "CME", "yf_symbol": "NQ=F", "name": "Nasdaq 100 Futures", "default_price": 28670.0},
    "ES": {"tv_symbol": "ES1!", "tv_exchange": "CME", "yf_symbol": "ES=F", "name": "S&P 500 Futures", "default_price": 7562.75},
}


class PriceService:
    def __init__(self):
        self.tv = None
        if HAS_TVDATAFEED:
            try:
                self.tv = TvDatafeed()
                logger.info("[PriceService] Initialized tvdatafeed.")
            except Exception as e:
                logger.warning(f"[PriceService] Could not initialize tvdatafeed: {e}")

    def fetch_price_data(self, symbol: str, limit: int = 100) -> PriceResponse:
        symbol = symbol.upper()
        info = SYMBOL_MAP.get(symbol, SYMBOL_MAP["GC"])

        # Try TvDatafeed first
        if self.tv:
            try:
                data = self.tv.get_hist(
                    symbol=info["tv_symbol"],
                    exchange=info["tv_exchange"],
                    interval=Interval.in_1_minute,
                    n_bars=limit
                )
                if data is not None and not data.empty:
                    candles = []
                    for idx, row in data.iterrows():
                        ts = int(idx.timestamp()) if hasattr(idx, 'timestamp') else int(time.time())
                        candles.append(PriceCandle(
                            timestamp=ts,
                            open=float(row['open']),
                            high=float(row['high']),
                            low=float(row['low']),
                            close=float(row['close']),
                            volume=float(row.get('volume', 0))
                        ))
                    cur_price = candles[-1].close
                    prev_close = candles[0].open if len(candles) > 1 else cur_price
                    change = cur_price - prev_close
                    change_pct = (change / prev_close * 100) if prev_close else 0.0

                    return PriceResponse(
                        symbol=symbol,
                        currentPrice=round(cur_price, 2),
                        change=round(change, 2),
                        changePercent=round(change_pct, 2),
                        candles=candles,
                        lastUpdated=datetime.now(timezone.utc).isoformat()
                    )
            except Exception as e:
                logger.warning(f"[PriceService] tvdatafeed fetch failed for {symbol}: {e}")

        # Try yfinance next
        if HAS_YFINANCE:
            try:
                ticker = yf.Ticker(info["yf_symbol"])
                df = ticker.history(period="1d", interval="1m")
                if not df.empty:
                    candles = []
                    for idx, row in df.tail(limit).iterrows():
                        ts = int(idx.timestamp())
                        candles.append(PriceCandle(
                            timestamp=ts,
                            open=float(row['Open']),
                            high=float(row['High']),
                            low=float(row['Low']),
                            close=float(row['Close']),
                            volume=float(row['Volume'])
                        ))
                    if candles:
                        cur_price = candles[-1].close
                        prev_close = candles[0].open
                        change = cur_price - prev_close
                        change_pct = (change / prev_close * 100) if prev_close else 0.0

                        return PriceResponse(
                            symbol=symbol,
                            currentPrice=round(cur_price, 2),
                            change=round(change, 2),
                            changePercent=round(change_pct, 2),
                            candles=candles,
                            lastUpdated=datetime.now(timezone.utc).isoformat()
                        )
            except Exception as e:
                logger.warning(f"[PriceService] yfinance fetch failed for {symbol}: {e}")

        # Fallback: Synthetic Candles generated relative to CME Future Price
        return self._generate_synthetic_candles(symbol, info, limit)

    def _generate_synthetic_candles(self, symbol: str, info: dict, limit: int) -> PriceResponse:
        # Check if we have current CME future price in market_state
        base_price = info["default_price"]
        if symbol in market_state.symbols:
            base_price = market_state.symbols[symbol].futurePrice

        now = int(time.time())
        candles: List[PriceCandle] = []

        cur = base_price - (limit * 0.2)
        random.seed(now // 60 + ord(symbol[0]))

        volatility = base_price * 0.0003

        for i in range(limit):
            ts = now - ((limit - 1 - i) * 60)
            open_p = cur
            change = (random.random() - 0.48) * volatility
            close_p = open_p + change
            high_p = max(open_p, close_p) + (random.random() * volatility * 0.5)
            low_p = min(open_p, close_p) - (random.random() * volatility * 0.5)
            vol = round(random.uniform(10, 150), 1)

            candles.append(PriceCandle(
                timestamp=ts,
                open=round(open_p, 2),
                high=round(high_p, 2),
                low=round(low_p, 2),
                close=round(close_p, 2),
                volume=vol
            ))
            cur = close_p

        cur_price = candles[-1].close
        first_open = candles[0].open
        price_change = cur_price - first_open
        pct = (price_change / first_open * 100) if first_open else 0.0

        return PriceResponse(
            symbol=symbol,
            currentPrice=round(cur_price, 2),
            change=round(price_change, 2),
            changePercent=round(pct, 2),
            candles=candles,
            lastUpdated=datetime.now(timezone.utc).isoformat()
        )

price_service = PriceService()
