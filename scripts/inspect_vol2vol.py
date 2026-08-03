import os
import glob
import json
from pathlib import Path
from datetime import datetime

VOL2VOL_DIR = Path(r"D:\GetDataCMEBoy\output\vol2vol")

def inspect_file(file_path: Path):
    print("=" * 80)
    print(f"FILE: {file_path.name}")
    print("=" * 80)
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return

    # Check if this is a summary file or single symbol file
    if "data" in data and isinstance(data["data"], dict):
        print(f"Summary File - Fetch Date: {data.get('fetchDate')}")
        print(f"Scraped Symbols: {data.get('scrapedSymbols')}")
        for sym, sym_data in data["data"].items():
            print(f"\n--- Symbol in Summary: {sym} ---")
            print_symbol_details(sym_data)
    else:
        print_symbol_details(data)

def print_symbol_details(data: dict):
    symbol = data.get("symbol", "N/A")
    product = data.get("productName", "N/A")
    title = data.get("title", "N/A")
    future_price = data.get("futurePrice", None)
    atm_vol = data.get("atmVolatility", None)
    dte = data.get("dte", None)
    scraped_at = data.get("scrapedAt", "N/A")

    atm_str = f"{atm_vol:.4f}" if atm_vol is not None else "N/A"
    dte_str = f"{dte:.4f}" if dte is not None else "N/A"

    print(f"Symbol: {symbol} | Product: {product} | Title: {title}")
    print(f"Scraped At: {scraped_at}")
    print(f"Future Price: {future_price} | ATM Volatility: {atm_str} | DTE: {dte_str}")

    sds = data.get("standardDeviations", [])
    print(f"\nSD Levels ({len(sds)} tiers):")
    for sd_item in sds:
        sd = sd_item.get("sd")
        down = sd_item.get("downside", {})
        up = sd_item.get("upside", {})
        print(f"  SD {sd}: Downside [{down.get('strikeStart', 0):.2f} - {down.get('strikeEnd', 0):.2f}] (width: {down.get('width', 0):.2f}) | "
              f"Upside [{up.get('strikeStart', 0):.2f} - {up.get('strikeEnd', 0):.2f}] (width: {up.get('width', 0):.2f})")

    strikes = data.get("strikeData", [])
    print(f"\nStrike Data Count: {len(strikes)}")
    if strikes:
        sorted_by_vol = sorted(strikes, key=lambda x: x.get("totalVolume", 0), reverse=True)
        print("  Top 5 High Volume Strikes:")
        for s in sorted_by_vol[:5]:
            iv = s.get('impliedVol')
            iv_str = f"{iv:.4f}" if iv is not None else "N/A"
            print(f"    Strike: {s.get('strike')} | Call Vol: {s.get('callVolume')} | Put Vol: {s.get('putVolume')} | "
                  f"Total Vol: {s.get('totalVolume')} | IV: {iv_str}")

def main():
    print(f"Inspecting Vol2Vol data from: {VOL2VOL_DIR}")
    if not VOL2VOL_DIR.exists():
        print(f"ERROR: Directory {VOL2VOL_DIR} does not exist!")
        return

    # Pick latest GC, NQ, ES files and summary file
    symbols = ["GC", "NQ", "ES"]
    for sym in symbols:
        pattern = str(VOL2VOL_DIR / f"vol2vol_{sym}_*.json")
        matches = sorted(glob.glob(pattern))
        if matches:
            latest = Path(matches[-1])
            inspect_file(latest)
        else:
            print(f"No files found for symbol {sym}")

    summary_latest = VOL2VOL_DIR / "vol2vol_summary_latest.json"
    if summary_latest.exists():
        inspect_file(summary_latest)

if __name__ == "__main__":
    main()
