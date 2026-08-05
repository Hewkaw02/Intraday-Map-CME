import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.state.market_state import market_state
from backend.workers.cme_polling_worker import CmePollingWorker
from backend.services.price_service import price_service
from backend.adapters.cme_adapter import CmeAdapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("IntradayCmeMap")

polling_worker = CmePollingWorker(state=market_state, poll_interval_seconds=5)
cme_adapter = CmeAdapter()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Intraday CME Map backend service...")
    await polling_worker.start()
    yield
    logger.info("Shutting down Intraday CME Map backend service...")
    await polling_worker.stop()

app = FastAPI(
    title="Intraday CME Map API",
    description="Real-time CME Intraday Volume, Vol2Vol Strike & SD Level Map",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def disable_api_caching(request, call_next):
    """Keep live API responses from being served from Render's edge cache."""
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response

@app.get("/api/health")
async def get_health():
    return {
        "status": "ok",
        "service": "Intraday CME Map API",
        "version": "1.0.0"
    }

@app.get("/api/symbols")
async def get_symbols():
    return {
        "symbols": ["GC", "NQ", "ES"],
        "descriptions": {
            "GC": "Gold Futures (OG|GC)",
            "NQ": "NASDAQ 100 Futures (NQ|NQ)",
            "ES": "S&P 500 Futures (ES|ES)"
        }
    }

@app.get("/api/intraday/{symbol}")
async def get_intraday_data(symbol: str):
    sym = symbol.upper()
    if sym not in ["GC", "NQ", "ES"]:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not supported. Supported: GC, NQ, ES.")

    payload = await market_state.get_state_payload()
    symbol_data = payload.symbols.get(sym)
    if not symbol_data:
        # Try loading directly via adapter if market state doesn't have it yet
        symbol_data = cme_adapter.load_latest_symbol_file(sym)
        if not symbol_data:
            raise HTTPException(status_code=404, detail=f"No CME Vol2Vol data found for {sym}")

    delta = payload.deltas.get(sym)
    history = cme_adapter.load_archive_history(sym, limit=10)

    return {
        "symbol": sym,
        "data": symbol_data.model_dump(),
        "delta": delta.model_dump() if delta else None,
        "isStale": payload.isStale,
        "lastScrapedAt": symbol_data.scrapedAt or payload.lastScrapedAt,
        "archiveSnapshotsCount": len(history)
    }

@app.get("/api/price/{symbol}")
async def get_price(symbol: str, limit: int = Query(default=100, ge=10, le=1000)):
    sym = symbol.upper()
    if sym not in ["GC", "NQ", "ES"]:
        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not supported. Supported: GC, NQ, ES.")

    price_resp = price_service.fetch_price_data(sym, limit=limit)
    return price_resp.model_dump()

@app.get("/api/status")
async def get_status():
    payload = await market_state.get_state_payload()
    return {
        "status": "online",
        "isStale": payload.isStale,
        "lastScrapedAt": payload.lastScrapedAt,
        "symbolsLoaded": list(payload.symbols.keys()),
        "activeWebSockets": len(market_state.subscribers),
        "timestamp": payload.timestamp
    }

@app.websocket("/ws/market")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await market_state.register_subscriber(websocket)
    logger.info(f"WebSocket client connected. Total clients: {len(market_state.subscribers)}")

    try:
        # Send initial state immediately
        initial_payload = await market_state.get_state_payload()
        await websocket.send_json({
            "type": "initial_state",
            "data": initial_payload.model_dump()
        })

        while True:
            # Keep connection alive and accept client ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected.")
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
    finally:
        await market_state.unregister_subscriber(websocket)
from pathlib import Path
from fastapi.staticfiles import StaticFiles

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"

if FRONTEND_DIST.exists():
    logger.info(f"Serving static frontend bundle from {FRONTEND_DIST}")
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
