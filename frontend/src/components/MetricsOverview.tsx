import React from 'react';
import type { CmeSymbolData, CmeDelta, PriceResponse } from '../types';
import { TrendingUp, TrendingDown, Zap, Shield, Target, Calendar } from 'lucide-react';

interface MetricsOverviewProps {
  cmeData?: CmeSymbolData;
  priceData?: PriceResponse;
  delta?: CmeDelta | null;
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  cmeData,
  priceData,
  delta
}) => {
  if (!cmeData) return null;

  const curPrice = priceData?.currentPrice || cmeData.futurePrice;
  const change = priceData?.change ?? (delta?.priceChange || 0);
  const changePct = priceData?.changePercent ?? 0;
  const isPositive = change >= 0;

  const sd1 = cmeData.standardDeviations.find(s => s.sd === 1);
  const sd2 = cmeData.standardDeviations.find(s => s.sd === 2);
  const sd3 = cmeData.standardDeviations.find(s => s.sd === 3);

  const formatVol = (val?: number | null) => (val ? `${(val * 100).toFixed(2)}%` : 'N/A');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: CME Future Price */}
      <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <span>Future Price ({cmeData.symbol})</span>
          <Zap className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline space-x-3 my-1">
          <span className="text-2xl font-bold font-mono text-white">
            {curPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span
            className={`inline-flex items-center text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 truncate">{cmeData.productName}</p>
      </div>

      {/* Card 2: ATM Volatility & DTE */}
      <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <span>ATM Volatility & DTE</span>
          <Calendar className="w-4 h-4 text-blue-400" />
        </div>
        <div className="grid grid-cols-2 gap-2 my-1">
          <div>
            <div className="text-xs text-slate-400">ATM Vol</div>
            <div className="text-xl font-bold font-mono text-blue-400">
              {formatVol(cmeData.atmVolatility)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">DTE</div>
            <div className="text-xl font-bold font-mono text-white">
              {cmeData.dte ? cmeData.dte.toFixed(2) : 'N/A'} <span className="text-xs font-normal text-slate-400">days</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Implied Volatility Curve Baseline</p>
      </div>

      {/* Card 3: Standard Deviations (+1SD / -1SD) */}
      <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <span>±1 Standard Deviation</span>
          <Shield className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="grid grid-cols-2 gap-2 my-1">
          <div>
            <div className="text-[11px] text-emerald-400 font-semibold">+1SD Target</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {sd1 ? sd1.upside.strikeEnd.toFixed(2) : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500">Width: ±{sd1?.upside.width.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[11px] text-rose-400 font-semibold">-1SD Target</div>
            <div className="text-sm font-bold font-mono text-rose-400">
              {sd1 ? sd1.downside.strikeStart.toFixed(2) : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500">Width: ±{sd1?.downside.width.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Card 4: Standard Deviations (±2SD & ±3SD Range) */}
      <div className="bg-dark-800 border border-dark-700 p-4 rounded-xl shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all">
        <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
          <span>±2SD / ±3SD Tail Extremes</span>
          <Target className="w-4 h-4 text-purple-400" />
        </div>
        <div className="space-y-1 text-xs font-mono my-1">
          <div className="flex justify-between items-center bg-dark-900 px-2 py-1 rounded">
            <span className="text-purple-400 font-semibold">±2SD Band</span>
            <span className="text-slate-200">
              {sd2 ? `${sd2.downside.strikeStart.toFixed(1)} - ${sd2.upside.strikeEnd.toFixed(1)}` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center bg-dark-900 px-2 py-1 rounded">
            <span className="text-indigo-400 font-semibold">±3SD Band</span>
            <span className="text-slate-200">
              {sd3 ? `${sd3.downside.strikeStart.toFixed(1)} - ${sd3.upside.strikeEnd.toFixed(1)}` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
