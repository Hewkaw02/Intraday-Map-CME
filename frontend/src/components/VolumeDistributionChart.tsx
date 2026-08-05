import React, { useMemo } from 'react';
import type { CmeSymbolData, StrikeData } from '../types';
import { BarChart3, ShieldAlert, Award } from 'lucide-react';

interface VolumeDistributionChartProps {
  cmeData?: CmeSymbolData;
}

export const VolumeDistributionChart: React.FC<VolumeDistributionChartProps> = ({ cmeData }) => {
  const { sortedStrikes, maxVol, maxOpenInterest, callWall, putWall, oiPoints } = useMemo(() => {
    if (!cmeData || !cmeData.strikeData || !cmeData.strikeData.length) {
      return {
        sortedStrikes: [],
        maxVol: 1,
        maxOpenInterest: 1,
        callWall: null as StrikeData | null,
        putWall: null as StrikeData | null,
        oiPoints: '',
      };
    }

    // Sort strikes by strike price ascending
    const sorted = [...cmeData.strikeData].sort((a, b) => a.strike - b.strike);
    
    let maxV = 1;
    let maxOi = 1;
    let maxCallStrike: StrikeData | null = null;
    let maxPutStrike: StrikeData | null = null;

    sorted.forEach((s) => {
      const tot = s.totalVolume;
      const oi = s.totalOi ?? ((s.callOi ?? 0) + (s.putOi ?? 0));
      if (tot > maxV) maxV = tot;
      if (oi > maxOi) maxOi = oi;
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
      maxOpenInterest: maxOi,
      callWall: maxCallStrike as StrikeData | null,
      putWall: maxPutStrike as StrikeData | null,
      oiPoints: sorted
        .map((s, index) => {
          const oi = s.totalOi ?? ((s.callOi ?? 0) + (s.putOi ?? 0));
          const x = ((index + 0.5) / sorted.length) * 100;
          const y = 100 - (oi / maxOi) * 100;
          return `${x.toFixed(3)},${y.toFixed(3)}`;
        })
        .join(' '),
    };
  }, [cmeData]);

  if (!cmeData || !cmeData.strikeData || !cmeData.strikeData.length) return null;

  const futPrice = cmeData.futurePrice;

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span>CME Intraday Volume + OI by Strike</span>
          </h2>
          <p className="text-xs text-slate-400">Call/put intraday volume with a faint total open-interest overlay</p>
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
          {/* OI is strike-based rather than time-based, so overlay it on this strike axis. */}
          <svg
            className="absolute left-2 right-2 top-8 bottom-6 h-[180px] w-[calc(100%-1rem)] pointer-events-none z-0 overflow-visible"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points={`0,100 ${oiPoints} 100,100`}
              fill="#a78bfa"
              fillOpacity="0.06"
            />
            <polyline
              points={oiPoints}
              fill="none"
              stroke="#c4b5fd"
              strokeOpacity="0.58"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {sortedStrikes.map((s) => {
            const callPct = (s.callVolume / maxVol) * 100;
            const putPct = (s.putVolume / maxVol) * 100;
            const totalOi = s.totalOi ?? ((s.callOi ?? 0) + (s.putOi ?? 0));
            const isAtm = Math.abs(s.strike - futPrice) === Math.min(...sortedStrikes.map(x => Math.abs(x.strike - futPrice)));
            const isCallWall = callWall?.strike === s.strike;
            const isPutWall = putWall?.strike === s.strike;

            return (
              <div key={s.strike} className="flex-1 flex flex-col items-center h-full justify-end group relative z-10">
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center bg-dark-900 border border-dark-700 p-2 rounded shadow-xl text-[11px] font-mono z-20 whitespace-nowrap pointer-events-none">
                  <div className="text-amber-400 font-bold">Strike {s.strike}</div>
                  <div className="text-emerald-400">Call Vol: {s.callVolume}</div>
                  <div className="text-rose-400">Put Vol: {s.putVolume}</div>
                  <div className="text-white font-bold">Total: {s.totalVolume}</div>
                  <div className="text-violet-300">Total OI: {totalOi.toLocaleString()}</div>
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
          <span className="w-8 h-0.5 bg-violet-300/60 mr-1.5"></span>
          <span>OI Overlay (normalized, max {maxOpenInterest.toLocaleString()})</span>
        </div>
        <div className="flex items-center">
          <span className="text-amber-400 font-bold mr-1">Underline</span>
          <span>ATM Strike</span>
        </div>
      </div>
    </div>
  );
};
