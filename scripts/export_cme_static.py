import os
import sys
import json
from pathlib import Path
from datetime import datetime

# Add project root to sys.path to allow importing backend modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.adapters.cme_adapter import CmeAdapter

VOL2VOL_DIR = Path(os.getenv("CME_DATA_DIR", r"D:\GetDataCMEBoy\output\vol2vol"))
PUBLIC_DATA_DIR = PROJECT_ROOT / "frontend" / "public" / "data"

def export_static_data():
    print("=" * 80)
    print(f"Exporting CME Vol2Vol static JSON data...")
    print(f"Source Directory: {VOL2VOL_DIR}")
    print(f"Target Directory: {PUBLIC_DATA_DIR}")
    print("=" * 80)

    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)

    if not VOL2VOL_DIR.exists():
        print(f"WARNING: Source directory {VOL2VOL_DIR} does not exist!")
        print("Checking if pre-existing static JSON files exist in frontend/public/data...")
        return

    adapter = CmeAdapter(data_dir=VOL2VOL_DIR)
    symbols = ["GC", "NQ", "ES"]
    symbol_responses = {}
    last_scraped = None

    for sym in symbols:
        data = adapter.load_latest_symbol_file(sym)
        if not data:
            print(f"WARNING: No single file found for {sym}, trying summary...")
            summary = adapter.load_latest_summary()
            if summary and sym in summary:
                data = summary[sym]

        if not data:
            print(f"ERROR: Could not load data for symbol {sym}")
            continue

        history = adapter.load_archive_history(sym, limit=2)
        delta = None
        if len(history) >= 2:
            prev = history[-2]
            delta = adapter.calculate_delta(prev, data)
        elif len(history) == 1:
            delta = adapter.calculate_delta(history[0], data)

        if data.scrapedAt:
            last_scraped = data.scrapedAt

        intraday_payload = {
            "symbol": sym,
            "data": data.model_dump(),
            "delta": delta.model_dump() if delta else None,
            "isStale": False,
            "lastScrapedAt": data.scrapedAt,
            "archiveSnapshotsCount": len(history)
        }
        symbol_responses[sym] = intraday_payload

        out_file = PUBLIC_DATA_DIR / f"{sym}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(intraday_payload, f, indent=2)
        print(f"Exported {sym} -> {out_file} ({out_file.stat().st_size} bytes)")

    # Export summary.json
    summary_payload = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "symbols": list(symbol_responses.keys()),
        "lastScrapedAt": last_scraped,
        "isStale": False,
        "data": {sym: item["data"] for sym, item in symbol_responses.items()},
        "deltas": {sym: item["delta"] for sym, item in symbol_responses.items()}
    }

    summary_file = PUBLIC_DATA_DIR / "summary.json"
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(summary_payload, f, indent=2)
    print(f"Exported summary -> {summary_file} ({summary_file.stat().st_size} bytes)")
    print("\nStatic data export completed successfully!")

if __name__ == "__main__":
    export_static_data()
