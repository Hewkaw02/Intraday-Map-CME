# Intraday CME Map System 📈

Real-time CME Intraday Volume, Vol2Vol Option Strike Map & Standard Deviation Target Level System.

Built with **FastAPI**, **Asyncio**, **TradingView Lightweight Charts (v5)**, **Vite**, **React**, **TypeScript**, and **Tailwind CSS**.

---

## 🌟 Key Features

- **Vol2Vol CME Data Engine**: Scrapes and parses live & archived CME option volume distribution data for **GC** (Gold), **NQ** (Nasdaq 100), and **ES** (S&P 500) from `D:\GetDataCMEBoy\output\vol2vol`.
- **Live Price Chart & Standard Deviation Levels**: TradingView Lightweight Charts canvas rendering 1-minute price candles overlaid with **+1SD, +2SD, +3SD, -1SD, -2SD, -3SD** target bands & CME Future Reference Price.
- **Intraday Volume Distribution Histogram**: Call (Green) vs. Put (Red) volume nodes across strike prices, with automatic detection of **Call Wall** and **Put Wall**.
- **Interactive Strike Map Table**: Searchable, filterable, and sortable strike table showing Call/Put volumes, intraday volume deltas, implied volatility (IV %), and volume ratio bars.
- **Real-Time WebSocket & Fallback Polling**: Zero-delay live streaming (`/ws/market`) with automatic reconnect and background status monitoring (**LIVE** vs. **STALE** indicators).

---

## 🏗️ Project Architecture

```
intraday-map-cme/
├── backend/
│   ├── adapters/
│   │   └── cme_adapter.py         # CME Vol2Vol JSON parser & delta calculator
│   ├── models/
│   │   └── cme.py                 # Pydantic schemas (StrikeData, SDLevel, CmeSymbolData, etc.)
│   ├── services/
│   │   └── price_service.py       # Live/Historical price engine (TvDatafeed / yfinance / fallback)
│   ├── state/
│   │   └── market_state.py        # In-memory thread-safe state store & WebSocket broadcaster
│   ├── workers/
│   │   └── cme_polling_worker.py  # Async background watcher for D:\GetDataCMEBoy\output\vol2vol
│   └── main.py                    # FastAPI app & WebSocket endpoint
├── frontend/                      # Vite + React + TypeScript + TradingView Lightweight Charts
│   ├── src/
│   │   ├── components/            # Header, MetricsOverview, TradingViewChart, VolumeDistributionChart, StrikeTable
│   │   ├── services/              # API client & WebSocket connector
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   └── inspect_vol2vol.py         # Utility script to inspect Vol2Vol data files
└── tests/
    └── test_backend.py            # Pytest test suite for API endpoints & adapters
```

---

## 🚀 Getting Started

### 1. Backend Setup (FastAPI)

```bash
# From project root
python -m pytest tests/test_backend.py

# Run FastAPI server
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

FastAPI server runs at `http://localhost:8000`.

#### REST API Endpoints:
- `GET /api/health` - Health check status
- `GET /api/symbols` - Supported symbol list (`["GC", "NQ", "ES"]`)
- `GET /api/intraday/{symbol}` - CME Vol2Vol strike map, deltas & SD levels
- `GET /api/price/{symbol}` - OHLCV price candles & current price
- `GET /api/status` - System status, staleness indicator & active WebSockets
- `WS /ws/market` - Real-time market state WebSocket feed

### 2. Frontend Setup (React + Vite + TypeScript)

```bash
cd frontend
npm install
npm run dev
```

Frontend dev server runs at `http://localhost:5173`.

To build for production:
```bash
npm run build
```

---

## 🐳 Running with Docker & Docker Compose

You can build and start the entire stack (FastAPI backend + Nginx-served React frontend) with a single command:

```bash
# Build and start services
docker compose up --build
```

Access the services at:
- **Frontend Web UI**: `http://localhost:5173`
- **Backend API Docs**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/api/health`

### Environment Variables & Custom CME Data Directory
By default, Docker Compose mounts `D:/GetDataCMEBoy/output/vol2vol` to `/app/data/vol2vol` inside the backend container. You can override the local CME data directory path using `CME_DATA_DIR`:

```bash
# On Windows PowerShell
$env:CME_DATA_DIR="D:/GetDataCMEBoy/output/vol2vol"; docker compose up --build

# On Linux/macOS
CME_DATA_DIR="/path/to/vol2vol" docker compose up --build
```

---

## 🧪 Testing

Run backend test suite:
```bash
python -m pytest tests/test_backend.py
```

Run Vol2Vol data inspector script:
```bash
python scripts/inspect_vol2vol.py
```

---

## 📜 License

MIT License &copy; 2026 Intraday CME Map Project.
