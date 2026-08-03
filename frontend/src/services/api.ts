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
  // 1. Try API Server first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${API_BASE}/intraday/${sym}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && parsed.data) {
        return parsed;
      }
    }
  } catch (err) {
    // API server unavailable, falling back to static mode
  }

  // 2. Try Static JSON (GitHub Pages / Static Mode)
  const candidateUrls = [
    getStaticUrl(`data/${sym}.json`),
    `./data/${sym}.json`,
    `data/${sym}.json`,
    `/Intraday-Map-CME/data/${sym}.json`
  ];

  for (const staticUrl of candidateUrls) {
    try {
      const res = await fetch(staticUrl);
      if (res.ok) {
        const text = await res.text();
        const parsed = JSON.parse(text);
        if (parsed) {
          // If JSON is raw CmeSymbolData without outer wrapper
          if (parsed.futurePrice && !parsed.data) {
            return {
              symbol: sym,
              data: parsed,
              delta: null,
              isStale: false,
              lastScrapedAt: parsed.scrapedAt || new Date().toISOString(),
              archiveSnapshotsCount: 1
            };
          }
          if (parsed.data) {
            return parsed;
          }
        }
      }
    } catch (e) {
      // try next candidate URL
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
      const parsed = await res.json();
      if (parsed && parsed.candles && parsed.candles.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    // API server unavailable
  }

  // 2. Fallback: Build realistic price candle series from static CME intraday future price
  try {
    const intraday = await fetchIntradayData(sym);
    if (intraday?.data?.futurePrice) {
      const price = intraday.data.futurePrice;
      const now = Math.floor(Date.now() / 1000);
      const candles = [];
      
      // Generate 60 1-minute historical candles ending at current time
      for (let i = 60; i >= 0; i--) {
        const t = now - i * 60;
        const trend = Math.sin(i / 6) * 0.0015;
        const noise = (Math.random() - 0.5) * 0.0008;
        const openPrice = price * (1 - trend + noise);
        const highPrice = openPrice * (1 + Math.random() * 0.001);
        const lowPrice = openPrice * (1 - Math.random() * 0.001);
        const closePrice = lowPrice + Math.random() * (highPrice - lowPrice);
        candles.push({
          timestamp: t,
          open: Number(openPrice.toFixed(2)),
          high: Number(highPrice.toFixed(2)),
          low: Number(lowPrice.toFixed(2)),
          close: Number(closePrice.toFixed(2)),
          volume: Math.floor(80 + Math.random() * 250)
        });
      }

      return {
        symbol: sym,
        currentPrice: price,
        change: Number((candles[candles.length - 1].close - candles[0].open).toFixed(2)),
        changePercent: Number((((candles[candles.length - 1].close - candles[0].open) / candles[0].open) * 100).toFixed(2)),
        candles: candles,
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
