import os
import sys
import time
import webbrowser
import subprocess
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent

def main():
    print("=" * 80)
    print("  INTRADAY CME MAP — Standalone Local Launcher")
    print("=" * 80)

    # 1. Check Vol2Vol data directory
    vol2vol_dir = Path(os.getenv("CME_DATA_DIR", r"D:\GetDataCMEBoy\output\vol2vol"))
    print(f"[1/4] Checking Vol2Vol data source: {vol2vol_dir}")
    if not vol2vol_dir.exists():
        print(f"      WARNING: {vol2vol_dir} directory not found!")
        print(f"      Make sure D:\\GetDataCMEBoy\\output\\vol2vol exists.")
    else:
        file_count = len(list(vol2vol_dir.glob("vol2vol_*.json")))
        print(f"      Found {file_count} Vol2Vol JSON snapshot files.")

    # 2. Check frontend dist build
    dist_dir = PROJECT_ROOT / "frontend" / "dist"
    print(f"[2/4] Checking frontend static bundle: {dist_dir}")
    if not dist_dir.exists() or not (dist_dir / "index.html").exists():
        print("      Building frontend production bundle (npm run build)...")
        try:
            subprocess.run(["npm", "run", "build"], cwd=str(PROJECT_ROOT / "frontend"), check=True, shell=True)
            print("      Frontend build completed successfully.")
        except Exception as e:
            print(f"      Frontend build error: {e}")

    # 3. Port configuration (default to 8002 to avoid port 8000 conflicts)
    port = int(os.getenv("PORT", "8002"))
    url = f"http://localhost:{port}"

    # 4. Launch browser after delay
    def open_browser():
        time.sleep(1.5)
        print(f"[4/4] Opening Web Dashboard at {url}...")
        webbrowser.open(url)

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    # 5. Start Uvicorn FastAPI Server
    print(f"[3/4] Starting FastAPI standalone server at {url}...")
    import uvicorn
    sys.path.insert(0, str(PROJECT_ROOT))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__":
    main()
