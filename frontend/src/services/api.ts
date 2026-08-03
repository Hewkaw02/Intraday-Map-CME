import type { CmeSymbolData, CmeDelta, PriceResponse } from '../types';

const isBrowser = typeof window !== 'undefined';
const wsProtocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = isBrowser ? window.location.host : 'localhost:8000';

const isDev = import.meta.env.DEV;

const API_BASE = (import.meta as any).env?.VITE_API_BASE || (isDev ? 'http://localhost:8000/api' : '/api');
const WS_BASE = (import.meta as any).env?.VITE_WS_BASE || (isDev ? 'ws://localhost:8000/ws/market' : `${wsProtocol}//${host}/ws/market`);

export interface IntradayResponse {
  symbol: string;
  data: CmeSymbolData;
  delta: CmeDelta | null;
  isStale: boolean;
  lastScrapedAt: string | null;
  archiveSnapshotsCount: number;
}

function getStaticUrl(relativePath: string): string {
  const baseUrl = (import.meta as any).env?.BASE_URL || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${cleanBase}${cleanPath}`;
}

export async function fetchSymbols(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/symbols`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const json = await res.json();
      return json.symbols || ['GC', 'NQ', 'ES'];
    }
  } catch (err) {
    // API server unavailable, attempt static JSON fallback
  }

  try {
    const staticUrl = getStaticUrl('data/summary.json');
    const res = await fetch(staticUrl);
    if (res.ok) {
      const json = await res.json();
      return json.symbols || ['GC', 'NQ', 'ES'];
    }
  } catch (err) {
    // Ignore static error
  }

  return ['GC', 'NQ', 'ES'];
}

export async function fetchIntradayData(symbol: string): Promise<IntradayResponse | null> {
  const sym = symbol.toUpperCase();
  // 1. Try API Server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/intraday/${sym}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // API server unavailable, falling back to static mode
  }

  // 2. Try Static JSON (GitHub Pages / Static Mode)
  const candidateUrls = [
    getStaticUrl(`data/${sym}.json`),
    `./data/${sym}.json`,
    `/Intraday-Map-CME/data/${sym}.json`
  ];

  for (const staticUrl of candidateUrls) {
    try {
      const res = await fetch(staticUrl);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // try next candidate
    }
  }

  console.error(`Could not fetch intraday data for ${sym} from API or static JSON`);
  return null;
}

export async function fetchPriceData(symbol: string, limit = 100): Promise<PriceResponse | null> {
  const sym = symbol.toUpperCase();
  // 1. Try API Server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/price/${sym}?limit=${limit}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    // API server unavailable
  }

  // 2. Fallback: Build price response from static CME intraday future price
  try {
    const intraday = await fetchIntradayData(sym);
    if (intraday?.data?.futurePrice) {
      const price = intraday.data.futurePrice;
      const now = Math.floor(Date.now() / 1000);
      return {
        symbol: sym,
        currentPrice: price,
        change: 0,
        changePercent: 0,
        candles: [
          {
            timestamp: now - 3600,
            open: price,
            high: price * 1.0005,
            low: price * 0.9995,
            close: price,
            volume: 100
          }
        ],
        lastUpdated: intraday.data.scrapedAt || new Date().toISOString()
      };
    }
  } catch (e) {
    console.error(`fetchPriceData static fallback error for ${sym}:`, e);
  }

  return null;
}

export function connectWebSocket(
  onMessage: (msg: any) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let timer: any = null;
  let closedManually = false;
  let maxAttempts = 3;
  let attempts = 0;

  function connect() {
    if (closedManually) return;

    try {
      ws = new WebSocket(WS_BASE);

      ws.onopen = () => {
        attempts = 0;
        onStatusChange?.(true);
        timer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          onMessage(parsed);
        } catch (e) {
          // Ignore non-json
        }
      };

      ws.onclose = () => {
        onStatusChange?.(false);
        if (timer) clearInterval(timer);
        attempts++;
        if (!closedManually && attempts < maxAttempts) {
          setTimeout(connect, 5000);
        }
      };

      ws.onerror = () => {
        onStatusChange?.(false);
      };
    } catch (err) {
      onStatusChange?.(false);
    }
  }

  connect();

  return () => {
    closedManually = true;
    if (timer) clearInterval(timer);
    if (ws) ws.close();
  };
}
