import React, { useState, useMemo } from 'react';
import type { CmeSymbolData, CmeDelta } from '../types';
import { Search, ArrowUpDown } from 'lucide-react';

interface StrikeTableProps {
  cmeData?: CmeSymbolData;
  delta?: CmeDelta | null;
}

export const StrikeTable: React.FC<StrikeTableProps> = ({ cmeData, delta }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'nonzero' | 'calls' | 'puts'>('nonzero');
  const [sortField, setSortField] = useState<'strike' | 'totalVolume' | 'callVolume' | 'putVolume' | 'impliedVol'>('totalVolume');
  const [sortAsc, setSortAsc] = useState(false);

  if (!cmeData || !cmeData.strikeData.length) return null;

  const futPrice = cmeData.futurePrice;

  // Build delta dictionary by strike
  const deltaMap = useMemo(() => {
    const map: Record<number, { callChange: number; putChange: number; totalChange: number }> = {};
    if (delta && delta.strikeDeltas) {
      delta.strikeDeltas.forEach(d => {
        map[d.strike] = {
          callChange: d.callVolumeChange,
          putChange: d.putVolumeChange,
          totalChange: d.totalVolumeChange
        };
      });
    }
    return map;
  }, [delta]);

  const filteredStrikes = useMemo(() => {
    let result = [...cmeData.strikeData];

    // Filter type
    if (filterType === 'nonzero') {
      result = result.filter(s => s.totalVolume > 0);
    } else if (filterType === 'calls') {
      result = result.filter(s => s.callVolume > 0);
    } else if (filterType === 'puts') {
      result = result.filter(s => s.putVolume > 0);
    }

    // Search term
    if (searchTerm.trim()) {
      result = result.filter(s => s.strike.toString().includes(searchTerm.trim()));
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField] ?? 0;
      let valB = b[sortField] ?? 0;
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [cmeData, filterType, searchTerm, sortField, sortAsc]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg mb-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-white">Intraday CME Strike Map</h2>
          <p className="text-xs text-slate-400">Detailed strike level breakdown & intraday volume deltas</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search strike..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-dark-900 border border-dark-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center bg-dark-900 p-1 rounded-lg border border-dark-700 text-xs font-semibold">
            <button
              onClick={() => setFilterType('nonzero')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'nonzero' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active Vol
            </button>
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'all' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Strikes
            </button>
            <button
              onClick={() => setFilterType('calls')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'calls' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Calls Only
            </button>
            <button
              onClick={() => setFilterType('puts')}
              className={`px-2.5 py-1 rounded transition-colors ${
                filterType === 'puts' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Puts Only
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto border border-dark-700 rounded-lg">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-dark-900 text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-dark-700">
            <tr>
              <th className="py-2.5 px-3 cursor-pointer hover:text-white" onClick={() => handleSort('strike')}>
                <div className="flex items-center space-x-1">
                  <span>Strike</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer text-emerald-400 hover:text-emerald-300" onClick={() => handleSort('callVolume')}>
                <div className="flex items-center space-x-1">
                  <span>Call Vol</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer text-rose-400 hover:text-rose-300" onClick={() => handleSort('putVolume')}>
                <div className="flex items-center space-x-1">
                  <span>Put Vol</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 cursor-pointer text-white hover:text-amber-400" onClick={() => handleSort('totalVolume')}>
                <div className="flex items-center space-x-1">
                  <span>Total Vol</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-3 text-right">Volume Share</th>
              <th className="py-2.5 px-3 cursor-pointer text-right text-blue-400" onClick={() => handleSort('impliedVol')}>
                <div className="flex items-center justify-end space-x-1">
                  <span>Implied Vol</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-700/50 text-slate-300">
            {filteredStrikes.map((s) => {
              const isAtm = Math.abs(s.strike - futPrice) < 2.5;
              const d = deltaMap[s.strike];
              const callRatio = s.totalVolume > 0 ? (s.callVolume / s.totalVolume) * 100 : 50;

              return (
                <tr
                  key={s.strike}
                  className={`hover:bg-dark-700/50 transition-colors ${
                    isAtm ? 'bg-amber-500/10 font-bold text-white' : ''
                  }`}
                >
                  {/* Strike */}
                  <td className="py-2 px-3">
                    <span className={isAtm ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                      {s.strike}
                    </span>
                    {isAtm && (
                      <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-sans uppercase">
                        ATM
                      </span>
                    )}
                  </td>

                  {/* Call Vol & Delta */}
                  <td className="py-2 px-3 text-emerald-400 font-semibold">
                    {s.callVolume.toLocaleString()}
                    {d && d.callChange !== 0 && (
                      <span className={`ml-2 text-[10px] ${d.callChange > 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                        ({d.callChange > 0 ? '+' : ''}{d.callChange})
                      </span>
                    )}
                  </td>

                  {/* Put Vol & Delta */}
                  <td className="py-2 px-3 text-rose-400 font-semibold">
                    {s.putVolume.toLocaleString()}
                    {d && d.putChange !== 0 && (
                      <span className={`ml-2 text-[10px] ${d.putChange > 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                        ({d.putChange > 0 ? '+' : ''}{d.putChange})
                      </span>
                    )}
                  </td>

                  {/* Total Vol */}
                  <td className="py-2 px-3 font-bold text-white">
                    {s.totalVolume.toLocaleString()}
                  </td>

                  {/* Volume Ratio Bar */}
                  <td className="py-2 px-3 text-right">
                    <div className="w-32 ml-auto bg-dark-900 rounded-full h-2 overflow-hidden flex">
                      <div style={{ width: `${callRatio}%` }} className="bg-emerald-500 h-full" />
                      <div style={{ width: `${100 - callRatio}%` }} className="bg-rose-500 h-full" />
                    </div>
                  </td>

                  {/* Implied Vol */}
                  <td className="py-2 px-3 text-right text-blue-400">
                    {s.impliedVol ? `${(s.impliedVol * 100).toFixed(2)}%` : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
