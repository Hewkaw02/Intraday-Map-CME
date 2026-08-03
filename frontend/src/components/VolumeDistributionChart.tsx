import React, { useMemo } from 'react';
import type { CmeSymbolData, StrikeData } from '../types';
import { BarChart3, ShieldAlert, Award } from 'lucide-react';

interface VolumeDistributionChartProps {
  cmeData?: CmeSymbolData;
}

export const VolumeDistributionChart: React.FC<VolumeDistributionChartProps> = ({ cmeData }) => {
  if (!cmeData || !cmeData.strikeData || !cmeData.strikeData.length) return null;

  const { sortedStrikes, maxVol, callWall, putWall } = useMemo(() => {
    // Sort strikes by strike price ascending
    const sorted = [...cmeData.strikeData].sort((a, b) => a.strike - b.strike);
    
    let maxV = 1;
    let maxCallStrike: StrikeData | null = null;
    let maxPutStrike: StrikeData | null = null;

    sorted.forEach((s) => {
      const tot = s.totalVolume;
      if (tot > maxV) maxV = tot;
      if (!maxCallStrike || s.callVolume > maxCallStrike.callVolume) {
        maxCallStrike = s;
      }
      if (!maxPutStrike || s.putVolume > maxPutStrike.putVolume) {
        maxPutStrike = s;
      }
    });

    return {
      sortedStrikes: sorted,
      maxVol: maxV,
      callWall: maxCallStrike as StrikeData | null,
      putWall: maxPutStrike as StrikeData | null,
    };
  }, [cmeData]);

  const futPrice = cmeData.futurePrice;

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>CME Intraday Volume Distribution by Strike</span>
          </h2>
          <p className="text-xs text-slate-400">Call (Green) vs Put (Red) volume nodes across strike prices</p>
        </div>

        {/* Call Wall & Put Wall Badges */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {callWall && (
            <div className="flex items-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg">
              <Award className="w-3.5 h-3.5 mr-1" />
              <span>Call Wall: <strong>{callWall.strike}</strong> ({callWall.callVolume} vol)</span>
            </div>
          )}
          {putWall && (
            <div className="flex items-center bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1 rounded-lg">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              <span>Put Wall: <strong>{putWall.strike}</strong> ({putWall.putVolume} vol)</span>
            </div>
          )}
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[700px] h-[260px] flex items-end space-x-1.5 pt-8 pb-6 px-2 border-b border-dark-700 relative">
          {sortedStrikes.map((s) => {
            const callPct = (s.callVolume / maxVol) * 100;
            const putPct = (s.putVolume / maxVol) * 100;
            const isAtm = Math.abs(s.strike - futPrice) === Math.min(...sortedStrikes.map(x => Math.abs(x.strike - futPrice)));
            const isCallWall = callWall?.strike === s.strike;
            const isPutWall = putWall?.strike === s.strike;

            return (
              <div key={s.strike} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-dark-900 border border-dark-700 p-2 rounded shadow-xl text-[11px] font-mono z-20 whitespace-nowrap pointer-events-none">
                  <div className="text-amber-400 font-bold">Strike {s.strike}</div>
                  <div className="text-emerald-400">Call Vol: {s.callVolume}</div>
                  <div className="text-rose-400">Put Vol: {s.putVolume}</div>
                  <div className="text-white font-bold">Total: {s.totalVolume}</div>
                  {s.impliedVol && <div className="text-blue-400">IV: {(s.impliedVol * 100).toFixed(2)}%</div>}
                </div>

                {/* Bars */}
                <div className="w-full flex justify-center items-end space-x-0.5 h-full max-h-[180px]">
                  {/* Call Bar */}
                  <div
                    style={{ height: `${Math.max(callPct, s.callVolume > 0 ? 4 : 0)}%` }}
                    className={`w-1/2 rounded-t transition-all ${
                      isCallWall ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-emerald-500/80 group-hover:bg-emerald-400'
                    }`}
                  />
                  {/* Put Bar */}
                  <div
                    style={{ height: `${Math.max(putPct, s.putVolume > 0 ? 4 : 0)}%` }}
                    className={`w-1/2 rounded-t transition-all ${
                      isPutWall ? 'bg-rose-400 shadow-lg shadow-rose-500/50' : 'bg-rose-500/80 group-hover:bg-rose-400'
                    }`}
                  />
                </div>

                {/* Strike Label */}
                <span
                  className={`mt-2 text-[10px] font-mono transform -rotate-45 origin-top-left transition-colors ${
                    isAtm
                      ? 'text-amber-400 font-bold underline'
                      : isCallWall
                      ? 'text-emerald-400 font-semibold'
                      : isPutWall
                      ? 'text-rose-400 font-semibold'
                      : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {s.strike}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-3 text-xs font-mono text-slate-400">
        <div className="flex items-center">
          <span className="w-3 h-3 bg-emerald-500 rounded-sm mr-1.5"></span>
          <span>Call Volume</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 bg-rose-500 rounded-sm mr-1.5"></span>
          <span>Put Volume</span>
        </div>
        <div className="flex items-center">
          <span className="text-amber-400 font-bold mr-1">Underline</span>
          <span>ATM Strike</span>
        </div>
      </div>
    </div>
  );
};
