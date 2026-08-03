# Intraday CME Map System

FastAPI + React dashboard for CME Vol2Vol option strike maps, volume deltas, standard-deviation levels, price candles, and live market updates for GC, NQ, and ES.

## Architecture

```text
backend/   FastAPI API, Vol2Vol parser, price service, polling worker, WebSocket
frontend/  Vite + React + TypeScript dashboard
scripts/   Data inspection and static-data export utilities
tests/     Backend pytest tests
```

The backend reads Vol2Vol JSON snapshots from `CME_DATA_DIR`. The frontend can also run in static mode from `frontend/public/data`.

## Data modes

### Live backend mode

The backend expects one of these files in `CME_DATA_DIR`:

- `vol2vol_summary_latest.json`
- `vol2vol_GC_*.json`, `vol2vol_NQ_*.json`, `vol2vol_ES_*.json`

Local default path:

```text
D:\GetDataCMEBoy\output\vol2vol
```

Override it with `CME_DATA_DIR`.

### Static frontend mode

Export snapshots before building the frontend:

```bash
python scripts/export_cme_static.py
cd frontend
npm run build
```

Static mode works on GitHub Pages or Vercel without the CME backend, but data is a snapshot, not live streaming data. Price fallback candles are synthetic when the backend price API is unavailable.

## Local development

### Backend

From project root:

```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`

## Frontend environment variables

Vite variables are build-time values.

```env
# API base must include /api
VITE_API_BASE=https://cme-backend.onrender.com/api

# Full WebSocket endpoint
VITE_WS_BASE=wss://cme-backend.onrender.com/ws/market
```

Without these variables, production builds use same-origin `/api` and `/ws/market`, which is suitable only when frontend and backend share one host. GitHub Pages builds currently use static fallback unless these variables are added to the Pages workflow.

## API

- `GET /api/health`
- `GET /api/symbols`
- `GET /api/intraday/{symbol}`
- `GET /api/price/{symbol}`
- `GET /api/status`
- `WS /ws/market`

## Docker Compose

```bash
docker compose up --build
```

Compose mappings:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8002`
- Backend health: `http://localhost:8002/api/health`

PowerShell example:

```powershell
$env:CME_DATA_DIR="D:/GetDataCMEBoy/output/vol2vol"
docker compose up --build
```

## Render deployment

The backend image builds successfully locally. Before deploying as a Render Web Service:

1. Bind Uvicorn to Render's `PORT` environment variable, or explicitly configure the Render service port to match the image.
2. Set `CME_DATA_DIR` to a real data source available inside the service.
3. Do not rely on the Windows `D:` path or a local Docker volume.
4. Configure health check path `/api/health`.

Render Free services have ephemeral filesystems. A Render service cannot read the developer machine's Vol2Vol directory after deployment. Use an external ingestion process, object storage, database, or deploy frontend static snapshots only.

## GitHub Pages / Vercel

The GitHub Pages workflow is `.github/workflows/deploy-pages.yml`. It publishes `frontend/dist`.

- GitHub Pages works with the current relative Vite base and static JSON fallback.
- For live Render data, provide `VITE_API_BASE` and `VITE_WS_BASE` during the Pages build.
- Vercel uses the same build command: `npm run build`, output directory `dist`.

## Tests and verification

```bash
python -m pytest tests/test_backend.py -q
python -m compileall -q backend
python scripts/inspect_vol2vol.py

cd frontend
npm run build
npm run lint
```

Production Docker checks:

```bash
docker build -t intraday-cme-backend-check backend
docker build -t intraday-cme-frontend-check frontend
```

## Security

Never commit API credentials, refresh tokens, deploy hooks, or `.env` files. Store secrets in Render environment variables or GitHub Actions secrets. Rotate any credential that has ever been committed or exposed.

## License

MIT License. Copyright 2026 Intraday CME Map Project.
