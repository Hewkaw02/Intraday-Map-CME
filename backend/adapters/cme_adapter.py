import os
import glob
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional, List, Tuple

from backend.models.cme import (
    CmeSymbolData, SDLevel, SDSide, StrikeData, CmeDelta, StrikeDelta
)

VOL2VOL_DIR = Path(os.getenv("CME_DATA_DIR", r"D:\GetDataCMEBoy\output\vol2vol"))

class CmeAdapter:
    def __init__(self, data_dir: Optional[Path] = None):
        self.data_dir = data_dir or VOL2VOL_DIR

    def parse_symbol_dict(self, raw: dict) -> CmeSymbolData:
        """Parse raw JSON dict into CmeSymbolData."""
        sds = []
        for item in raw.get("standardDeviations", []):
            down = item.get("downside", {})
            up = item.get("upside", {})
            sds.append(SDLevel(
                sd=item.get("sd", 1),
                downside=SDSide(
                    width=float(down.get("width", 0.0)),
                    strikeStart=float(down.get("strikeStart", 0.0)),
                    strikeEnd=float(down.get("strikeEnd", 0.0))
                ),
                upside=SDSide(
                    width=float(up.get("width", 0.0)),
                    strikeStart=float(up.get("strikeStart", 0.0)),
                    strikeEnd=float(up.get("strikeEnd", 0.0))
                )
            ))

        strikes = []
        for s in raw.get("strikeData", []):
            strikes.append(StrikeData(
                strike=float(s.get("strike", 0.0)),
                callVolume=int(s.get("callVolume", 0)),
                putVolume=int(s.get("putVolume", 0)),
                totalVolume=int(s.get("totalVolume", 0)),
                impliedVol=float(s.get("impliedVol")) if s.get("impliedVol") is not None else None,
                settleVol=float(s.get("settleVol")) if s.get("settleVol") is not None else None,
            ))

        return CmeSymbolData(
            symbol=raw.get("symbol", ""),
            productName=raw.get("productName", ""),
            title=raw.get("title"),
            futurePrice=float(raw.get("futurePrice", 0.0)),
            atmVolatility=float(raw.get("atmVolatility")) if raw.get("atmVolatility") is not None else None,
            dte=float(raw.get("dte")) if raw.get("dte") is not None else None,
            standardDeviations=sds,
            strikeData=strikes,
            scrapedAt=raw.get("scrapedAt")
        )

    def load_latest_summary(self) -> Optional[Dict[str, CmeSymbolData]]:
        """Attempt to load vol2vol_summary_latest.json."""
        summary_path = self.data_dir / "vol2vol_summary_latest.json"
        if not summary_path.exists():
            return None

        try:
            with open(summary_path, "r", encoding="utf-8") as f:
                content = json.load(f)

            fetch_date = content.get("fetchDate")
            raw_data = content.get("data", {})
            result = {}
            for sym, raw_sym in raw_data.items():
                if "scrapedAt" not in raw_sym and fetch_date:
                    raw_sym["scrapedAt"] = fetch_date
                result[sym] = self.parse_symbol_dict(raw_sym)
            return result
        except Exception as e:
            print(f"[CmeAdapter] Error reading latest summary: {e}")
            return None

    def load_latest_symbol_file(self, symbol: str) -> Optional[CmeSymbolData]:
        """Find and parse the latest single file for symbol (e.g. vol2vol_GC_*.json)."""
        pattern = str(self.data_dir / f"vol2vol_{symbol}_*.json")
        matches = sorted(glob.glob(pattern))
        # Filter out 'forward' files
        matches = [m for m in matches if "vol2vol_forward_" not in os.path.basename(m)]
        if not matches:
            return None

        latest_path = Path(matches[-1])
        try:
            with open(latest_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
            return self.parse_symbol_dict(raw)
        except Exception as e:
            print(f"[CmeAdapter] Error reading {latest_path}: {e}")
            return None

    def load_all_symbols(self) -> Dict[str, CmeSymbolData]:
        """Load latest data for all supported symbols (GC, NQ, ES)."""
        # First try summary file
        summary = self.load_latest_summary()
        if summary and len(summary) >= 3:
            return summary

        # Fallback to individual latest files
        result = summary if summary else {}
        for sym in ["GC", "NQ", "ES"]:
            if sym not in result:
                data = self.load_latest_symbol_file(sym)
                if data:
                    result[sym] = data
        return result

    def calculate_delta(self, previous: Optional[CmeSymbolData], current: CmeSymbolData) -> CmeDelta:
        """Calculate volume deltas between previous and current CME snapshot."""
        if not previous:
            return CmeDelta(
                currentScrapedAt=current.scrapedAt,
                strikeDeltas=[],
                totalCallVolumeChange=0,
                totalPutVolumeChange=0,
                totalVolumeChange=0,
                priceChange=0.0
            )

        prev_strikes: Dict[float, StrikeData] = {s.strike: s for s in previous.strikeData}
        strike_deltas: List[StrikeDelta] = []
        tot_call_change = 0
        tot_put_change = 0
        tot_vol_change = 0

        for cur_s in current.strikeData:
            prev_s = prev_strikes.get(cur_s.strike)
            prev_call = prev_s.callVolume if prev_s else 0
            prev_put = prev_s.putVolume if prev_s else 0

            call_diff = cur_s.callVolume - prev_call
            put_diff = cur_s.putVolume - prev_put
            total_diff = cur_s.totalVolume - ((prev_s.totalVolume) if prev_s else 0)

            if call_diff != 0 or put_diff != 0 or total_diff != 0:
                strike_deltas.append(StrikeDelta(
                    strike=cur_s.strike,
                    callVolumeChange=call_diff,
                    putVolumeChange=put_diff,
                    totalVolumeChange=total_diff
                ))

            tot_call_change += call_diff
            tot_put_change += put_diff
            tot_vol_change += total_diff

        price_diff = round(current.futurePrice - previous.futurePrice, 4)

        return CmeDelta(
            previousScrapedAt=previous.scrapedAt,
            currentScrapedAt=current.scrapedAt,
            strikeDeltas=strike_deltas,
            totalCallVolumeChange=tot_call_change,
            totalPutVolumeChange=tot_put_change,
            totalVolumeChange=tot_vol_change,
            priceChange=price_diff
        )

    def load_archive_history(self, symbol: str, limit: int = 20) -> List[CmeSymbolData]:
        """Load recent snapshots from archive directories for a given symbol."""
        archive_dir = self.data_dir / "archive"
        if not archive_dir.exists():
            return []

        pattern = str(archive_dir / "*" / f"vol2vol_{symbol}_*.json")
        matches = sorted(glob.glob(pattern))
        # Exclude forward files
        matches = [m for m in matches if "vol2vol_forward_" not in os.path.basename(m)]

        recent_files = matches[-limit:]
        history = []
        for filepath in recent_files:
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                history.append(self.parse_symbol_dict(raw))
            except Exception:
                continue
        return history
