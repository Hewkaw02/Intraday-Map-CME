import React from 'react';
import { Activity, RefreshCw, Radio, Clock } from 'lucide-react';

interface HeaderProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  isStale: boolean;
  lastScrapedAt?: string | null;
  wsConnected: boolean;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  selectedSymbol,
  onSelectSymbol,
  isStale,
  lastScrapedAt,
  wsConnected,
  onRefresh,
  loading
}) => {
  const symbols = [
    { id: 'GC', label: 'GC - Gold', sub: 'Comex OG|GC' },
    { id: 'NQ', label: 'NQ - Nasdaq 100', sub: 'CME Q1AQ6' },
    { id: 'ES', label: 'ES - S&P 500', sub: 'CME E1AQ6' }
  ];

  const formatTime = (ts?: string | null) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <header className="bg-dark-800 border-b border-dark-700 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20 text-amber-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">INTRADAY CME MAP</h1>
              <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-0.5 rounded font-mono font-semibold">
                Vol2Vol
              </span>
            </div>
            <p className="text-xs text-slate-400">Live Volume Distribution & Volatility SD Levels</p>
          </div>
        </div>

        {/* Symbol Selector */}
        <div className="flex items-center bg-dark-900 p-1 rounded-xl border border-dark-700">
          {symbols.map((s) => {
            const active = selectedSymbol === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectSymbol(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex flex-col items-center ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-dark-700'
                }`}
              >
                <span>{s.id}</span>
                <span className={`text-[10px] font-normal ${active ? 'text-slate-900' : 'text-slate-500'}`}>
                  {s.sub.split(' ')[1] || s.sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Indicators & Controls */}
        <div className="flex items-center space-x-4">
          {/* Status Badge */}
          <div className="flex items-center space-x-2 bg-dark-900 px-3 py-1.5 rounded-lg border border-dark-700">
            <span className="relative flex h-2.5 w-2.5">
              {!isStale ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              )}
            </span>
            <span className={`text-xs font-bold font-mono ${!isStale ? 'text-emerald-400' : 'text-amber-400'}`}>
              {!isStale ? 'LIVE' : 'STALE'}
            </span>
            <span className="text-slate-600">|</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-300 font-mono">{formatTime(lastScrapedAt)}</span>
          </div>

          {/* WebSocket Status */}
          <div className="flex items-center space-x-1 text-xs text-slate-400 bg-dark-900 px-2.5 py-1.5 rounded-lg border border-dark-700">
            <Radio className={`w-3.5 h-3.5 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <span className="font-mono">{wsConnected ? 'WS: ON' : 'WS: OFF'}</span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-700 text-slate-300 hover:text-white hover:bg-dark-600 active:scale-95 transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
