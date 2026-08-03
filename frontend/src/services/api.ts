import type { CmeSymbolData, CmeDelta, PriceResponse } from '../types';

const isBrowser = typeof window !== 'undefined';
const protocol = isBrowser && window.location.protocol === 'https:' ? 'https:' : 'http:';
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

export async function fetchSymbols(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/symbols`);
    if (!res.ok) throw new Error('Failed to fetch symbols');
    const json = await res.json();
    return json.symbols || ['GC', 'NQ', 'ES'];
  } catch (err) {
    console.error('fetchSymbols error:', err);
    return ['GC', 'NQ', 'ES'];
  }
}

export async function fetchIntradayData(symbol: string): Promise<IntradayResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/intraday/${symbol}`);
    if (!res.ok) throw new Error(`Failed to fetch intraday data for ${symbol}`);
    return await res.json();
  } catch (err) {
    console.error(`fetchIntradayData error for ${symbol}:`, err);
    return null;
  }
}

export async function fetchPriceData(symbol: string, limit = 100): Promise<PriceResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/price/${symbol}?limit=${limit}`);
    if (!res.ok) throw new Error(`Failed to fetch price data for ${symbol}`);
    return await res.json();
  } catch (err) {
    console.error(`fetchPriceData error for ${symbol}:`, err);
    return null;
  }
}

export function connectWebSocket(
  onMessage: (msg: any) => void,
  onStatusChange?: (connected: boolean) => void
): () => void {
  let ws: WebSocket | null = null;
  let timer: any = null;

  function connect() {
    ws = new WebSocket(WS_BASE);

    ws.onopen = () => {
      onStatusChange?.(true);
      // Heartbeat ping interval
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
        // Ignore non-json (e.g. pong)
      }
    };

    ws.onclose = () => {
      onStatusChange?.(false);
      if (timer) clearInterval(timer);
      // Auto reconnect after 3s
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      onStatusChange?.(false);
    };
  }

  connect();

  return () => {
    if (timer) clearInterval(timer);
    if (ws) ws.close();
  };
}
