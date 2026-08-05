import React, { useEffect, useState, useCallback } from 'react';
import { Header } from './components/Header';
import { MetricsOverview } from './components/MetricsOverview';
import { TradingViewChart } from './components/TradingViewChart';
import { StrikeTable } from './components/StrikeTable';
import { fetchIntradayData, fetchPriceData, connectWebSocket } from './services/api';
import type { CmeSymbolData, CmeDelta, PriceResponse } from './types';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('GC');
  const [cmeData, setCmeData] = useState<CmeSymbolData | undefined>(undefined);
  const [delta, setDelta] = useState<CmeDelta | null>(null);
  const [priceData, setPriceData] = useState<PriceResponse | undefined>(undefined);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [lastScrapedAt, setLastScrapedAt] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load data for selected symbol
  const loadData = useCallback(async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const [intradayRes, priceRes] = await Promise.all([
        fetchIntradayData(sym),
        fetchPriceData(sym)
      ]);

      if (intradayRes) {
        setCmeData(intradayRes.data);
        setDelta(intradayRes.delta);
        setIsStale(intradayRes.isStale);
        setLastScrapedAt(intradayRes.lastScrapedAt);
      } else {
        setError(`Could not fetch CME Vol2Vol data for ${sym}`);
      }

      if (priceRes) {
        setPriceData(priceRes);
      }
    } catch (err: any) {
      console.error('Data load error:', err);
      setError(err.message || 'Error loading data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Symbol selection change handler
  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    loadData(sym);
  };

  // Initial load & periodic price refresh
  useEffect(() => {
    loadData(selectedSymbol);

    // Refresh price every 10 seconds
    const interval = setInterval(() => {
      fetchPriceData(selectedSymbol).then(res => {
        if (res) setPriceData(res);
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedSymbol, loadData]);

  // Connect WebSocket for live CME market updates
  useEffect(() => {
    const cleanup = connectWebSocket((wsMsg) => {
      if (wsMsg.type === 'market_update' || wsMsg.type === 'initial_state') {
        const payload = wsMsg.data;
        if (payload && payload.symbols && payload.symbols[selectedSymbol]) {
          setCmeData(payload.symbols[selectedSymbol]);
          if (payload.deltas && payload.deltas[selectedSymbol]) {
            setDelta(payload.deltas[selectedSymbol]);
          }
          setIsStale(payload.isStale ?? false);
          setLastScrapedAt(payload.lastScrapedAt);
        }
      }
    }, (connected) => {
      setWsConnected(connected);
    });

    return cleanup;
  }, [selectedSymbol]);

  return (
    <div className="min-h-screen bg-dark-900 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Header */}
      <Header
        selectedSymbol={selectedSymbol}
        onSelectSymbol={handleSelectSymbol}
        isStale={isStale}
        lastScrapedAt={lastScrapedAt}
        wsConnected={wsConnected}
        onRefresh={() => loadData(selectedSymbol)}
        loading={loading}
      />

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-4 rounded-xl flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div className="flex-1 text-xs">{error}</div>
            <button
              onClick={() => loadData(selectedSymbol)}
              className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded font-semibold text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Metrics Overview Cards */}
        <MetricsOverview
          cmeData={cmeData}
          priceData={priceData}
          delta={delta}
        />

        {/* TradingView Price Chart */}
        <TradingViewChart
          candles={priceData?.candles || []}
          cmeData={cmeData}
          symbol={selectedSymbol}
        />

        {/* Option Strike Data Table */}
        <StrikeTable
          cmeData={cmeData}
          delta={delta}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-700 bg-dark-800 py-4 text-center text-xs text-slate-500 font-mono">
        Intraday CME Map System &copy; 2026 | Vol2Vol Automated Scraper & TradingView Lightweight Charts Integration
      </footer>
    </div>
  );
};

export default App;
