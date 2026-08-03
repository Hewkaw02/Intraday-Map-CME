export interface SDSide {
  width: number;
  strikeStart: number;
  strikeEnd: number;
}

export interface SDLevel {
  sd: number;
  downside: SDSide;
  upside: SDSide;
}

export interface StrikeData {
  strike: number;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  impliedVol?: number | null;
  settleVol?: number | null;
}

export interface CmeSymbolData {
  symbol: string;
  productName: string;
  title?: string | null;
  futurePrice: number;
  atmVolatility?: number | null;
  dte?: number | null;
  standardDeviations: SDLevel[];
  strikeData: StrikeData[];
  scrapedAt?: string | null;
}

export interface StrikeDelta {
  strike: number;
  callVolumeChange: number;
  putVolumeChange: number;
  totalVolumeChange: number;
}

export interface CmeDelta {
  previousScrapedAt?: string | null;
  currentScrapedAt?: string | null;
  strikeDeltas: StrikeDelta[];
  totalCallVolumeChange: number;
  totalPutVolumeChange: number;
  totalVolumeChange: number;
  priceChange: number;
}

export interface MarketStatePayload {
  timestamp: string;
  symbols: Record<string, CmeSymbolData>;
  deltas: Record<string, CmeDelta>;
  isStale: boolean;
  lastScrapedAt?: string | null;
}

export interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceResponse {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  candles: PriceCandle[];
  lastUpdated: string;
}
