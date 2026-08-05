import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
} from 'lightweight-charts';
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  CandlestickData,
  Time,
} from 'lightweight-charts';
import { Eye, EyeOff, Layers } from 'lucide-react';
import type { CmeSymbolData, PriceCandle } from '../types';

interface TradingViewChartProps {
  candles: PriceCandle[];
  cmeData?: CmeSymbolData;
  symbol: string;
}

const CHART_HEIGHT = 480;

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  candles,
  cmeData,
  symbol,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const drawOverlayRef = useRef<() => void>(() => undefined);
  const candleCountRef = useRef(0);

  const [showVolumeOverlay, setShowVolumeOverlay] = useState(true);
  const [showOISnapshotOverlay, setShowOISnapshotOverlay] = useState(true);
  const [overlayOpacity, setOverlayOpacity] = useState(0.4);

  // Draw CME strike volume and OI inside the price chart, matching the Tastytrade UI.
  // Strike profiles are mapped to the chart's price axis, so they remain aligned with
  // the candles while the user zooms or scrolls the chart.
  const drawCmeOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const series = candleSeriesRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !series || !ctx) return;

    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    ctx.clearRect(0, 0, width, height);

    const profile = (cmeData?.strikeData || []).filter((item) => item.strike > 0);
    if ((!showVolumeOverlay && !showOISnapshotOverlay) || profile.length === 0) return;

    const profileRight = Math.max(0, width - 82);
    const maxProfileWidth = Math.max(1, Math.min(270, profileRight * 0.42));
    const maxTotalOI = Math.max(
      ...profile.map((item) => item.totalOi ?? (item.callOi ?? 0) + (item.putOi ?? 0)),
      1,
    );
    const maxVolume = Math.max(
      ...profile.map((item) => item.callVolume + item.putVolume),
      1,
    );

    const mappedProfile = profile.flatMap((item) => {
      const y = series.priceToCoordinate(item.strike);
      if (y === null) return [];
      const numericY = Number(y);
      return numericY >= 0 && numericY <= height ? [{ item, y: numericY }] : [];
    });

    if (mappedProfile.length === 0) return;

    const sortedY = mappedProfile.map((entry) => entry.y).sort((a, b) => a - b);
    const gaps = sortedY.slice(1).map((y, index) => y - sortedY[index]);
    const smallestGap = gaps.find((gap) => gap > 0) || 14;
    const rowHeight = Math.max(6, Math.min(18, smallestGap * 0.72));

    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);

    mappedProfile.forEach(({ item, y }) => {
      const totalOI = item.totalOi ?? (item.callOi ?? 0) + (item.putOi ?? 0);
      const oiRatio = Math.min(1, totalOI / maxTotalOI);
      const totalVolume = item.callVolume + item.putVolume;
      const volumeRatio = Math.min(1, totalVolume / maxVolume);
      const top = y - rowHeight / 2;

      // OI is deliberately faint so it gives context without hiding the candles.
      if (showOISnapshotOverlay && oiRatio > 0) {
        const oiWidth = maxProfileWidth * Math.sqrt(oiRatio);
        const oiAlpha = Math.min(0.24, 0.025 + oiRatio * overlayOpacity * 0.34);
        ctx.fillStyle = `rgba(167, 139, 250, ${oiAlpha})`;
        ctx.fillRect(profileRight - oiWidth, top, oiWidth, rowHeight);

        ctx.strokeStyle = `rgba(196, 181, 253, ${Math.min(
          0.24,
          0.035 + oiRatio * overlayOpacity * 0.28,
        )})`;
        ctx.beginPath();
        ctx.moveTo(profileRight - oiWidth, y);
        ctx.lineTo(profileRight, y);
        ctx.stroke();
      }

      // Intraday trade volume is the stronger foreground layer, split Call/Put.
      if (showVolumeOverlay && totalVolume > 0) {
        const volumeWidth = maxProfileWidth * Math.sqrt(volumeRatio) * 0.82;
        const callWidth = volumeWidth * (item.callVolume / totalVolume);
        const putWidth = volumeWidth * (item.putVolume / totalVolume);
        const volumeBarHeight = Math.max(3, rowHeight / 2 - 1);

        ctx.setLineDash([]);
        if (callWidth > 0) {
          ctx.fillStyle = `rgba(16, 185, 129, ${0.58 + volumeRatio * 0.18})`;
          ctx.fillRect(profileRight - callWidth, y - volumeBarHeight, callWidth, volumeBarHeight);
        }
        if (putWidth > 0) {
          ctx.fillStyle = `rgba(239, 68, 68, ${0.58 + volumeRatio * 0.18})`;
          ctx.fillRect(profileRight - putWidth, y + 1, putWidth, volumeBarHeight);
        }
        ctx.setLineDash([2, 4]);
      }
    });

    ctx.restore();
  }, [cmeData, overlayOpacity, showOISnapshotOverlay, showVolumeOverlay]);

  useEffect(() => {
    drawOverlayRef.current = drawCmeOverlay;
    requestAnimationFrame(() => drawOverlayRef.current());
  }, [drawCmeOverlay]);

  // Create the chart once and redraw the canvas overlay when the price scale changes.
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: CHART_HEIGHT,
      layout: {
        background: { type: ColorType.Solid, color: '#151922' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: '#1E2330' },
        horzLines: { color: '#1E2330' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3A4259', style: LineStyle.Dashed },
        horzLine: { color: '#3A4259', style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: '#2A3042',
        autoScale: true,
      },
      timeScale: {
        borderColor: '#2A3042',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const resizeChart = () => {
      const width = container.clientWidth;
      if (!width || !canvasRef.current) return;

      chart.applyOptions({ width });
      canvasRef.current.width = width;
      canvasRef.current.height = CHART_HEIGHT;
      drawOverlayRef.current();
    };

    const resizeObserver = new ResizeObserver(resizeChart);
    resizeObserver.observe(container);

    const handleVisibleTimeRangeChange = () => drawOverlayRef.current();
    chart.timeScale().subscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
    resizeChart();

    return () => {
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleTimeRangeChange(handleVisibleTimeRangeChange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // Update candles while preserving the user's current viewport.
  useEffect(() => {
    const series = candleSeriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    let activeCandles = [...(candles || [])];
    if (activeCandles.length === 0 && cmeData?.futurePrice) {
      const price = cmeData.futurePrice;
      const now = Math.floor(Date.now() / 1000);
      for (let i = 60; i >= 0; i -= 1) {
        const timestamp = now - i * 60;
        const trend = Math.sin(i / 6) * 0.0015;
        const noise = (Math.random() - 0.5) * 0.0008;
        const open = price * (1 - trend + noise);
        const high = open * 1.001;
        const low = open * 0.999;
        const close = low + Math.random() * (high - low);
        activeCandles.push({
          timestamp,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume: Math.floor(80 + Math.random() * 250),
        });
      }
    }

    const formattedData: CandlestickData[] = activeCandles
      .map((c) => ({
        time: Math.floor(c.timestamp) as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    const uniqueData: CandlestickData[] = [];
    const seenTimes = new Set<number>();
    formattedData.forEach((item) => {
      const time = item.time as number;
      if (!seenTimes.has(time)) {
        seenTimes.add(time);
        uniqueData.push(item);
      }
    });

    if (uniqueData.length > 0) {
      const timeScale = chart.timeScale();
      const previousRange = timeScale.getVisibleLogicalRange();
      const previousCount = candleCountRef.current;

      series.setData(uniqueData);
      candleCountRef.current = uniqueData.length;

      if (!previousRange || previousCount === 0) {
        timeScale.fitContent();
      } else {
        timeScale.setVisibleLogicalRange(previousRange);
      }
    }

    requestAnimationFrame(() => drawOverlayRef.current());
  }, [candles, cmeData]);

  // Keep SD and CME future reference lines on the price series.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    priceLinesRef.current.forEach((line) => {
      try {
        series.removePriceLine(line);
      } catch {
        // Ignore stale lines during chart teardown.
      }
    });
    priceLinesRef.current = [];

    if (!cmeData?.futurePrice) return;

    const addPriceLine = (price: number, color: string, style: LineStyle, title: string, width: 1 | 2 = 1) => {
      priceLinesRef.current.push(
        series.createPriceLine({
          price,
          color,
          lineWidth: width,
          lineStyle: style,
          axisLabelVisible: true,
          title,
        }),
      );
    };

    addPriceLine(cmeData.futurePrice, '#F59E0B', LineStyle.Solid, `CME Future (${cmeData.futurePrice})`, 2);

    const sds = cmeData.standardDeviations || [];
    const sd1 = sds.find((s) => s.sd === 1);
    const sd2 = sds.find((s) => s.sd === 2);
    const sd3 = sds.find((s) => s.sd === 3);

    if (sd1) {
      addPriceLine(sd1.upside.strikeEnd, '#10B981', LineStyle.Dashed, `+1SD (${sd1.upside.strikeEnd.toFixed(1)})`);
      addPriceLine(sd1.downside.strikeStart, '#EF4444', LineStyle.Dashed, `-1SD (${sd1.downside.strikeStart.toFixed(1)})`);
    }
    if (sd2) {
      addPriceLine(sd2.upside.strikeEnd, '#3B82F6', LineStyle.LargeDashed, `+2SD (${sd2.upside.strikeEnd.toFixed(1)})`);
      addPriceLine(sd2.downside.strikeStart, '#F97316', LineStyle.LargeDashed, `-2SD (${sd2.downside.strikeStart.toFixed(1)})`);
    }
    if (sd3) {
      addPriceLine(sd3.upside.strikeEnd, '#A855F7', LineStyle.Dotted, `+3SD (${sd3.upside.strikeEnd.toFixed(1)})`);
      addPriceLine(sd3.downside.strikeStart, '#EC4899', LineStyle.Dotted, `-3SD (${sd3.downside.strikeStart.toFixed(1)})`);
    }
  }, [cmeData]);

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Price Chart ({symbol})</span>
            <span className="text-xs bg-dark-700 text-slate-300 font-mono font-normal px-2 py-0.5 rounded">
              1m + CME Strike Volume/OI
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-mono">
          <button
            onClick={() => setShowVolumeOverlay((current) => !current)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
              showVolumeOverlay
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-dark-700 text-slate-500 border border-dark-600'
            }`}
            title="Toggle CME intraday Call/Put volume by strike"
          >
            {showVolumeOverlay ? <Eye className="w-3 h-3 text-emerald-400" /> : <EyeOff className="w-3 h-3" />}
            <span>Strike Volume</span>
          </button>
          <button
            onClick={() => setShowOISnapshotOverlay((current) => !current)}
            className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
              showOISnapshotOverlay
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                : 'bg-dark-700 text-slate-500 border border-dark-600'
            }`}
            title="Toggle faint OI by strike overlay"
          >
            {showOISnapshotOverlay ? <Eye className="w-3 h-3 text-violet-300" /> : <EyeOff className="w-3 h-3" />}
            <span>OI Overlay</span>
          </button>
          {showOISnapshotOverlay && (
            <div className="hidden md:flex items-center gap-1 text-slate-400">
              <span>OI:</span>
              {[0.2, 0.4, 0.65].map((opacity) => (
                <button
                  key={opacity}
                  onClick={() => setOverlayOpacity(opacity)}
                  className={`px-1.5 py-0.5 rounded font-mono ${
                    overlayOpacity === opacity ? 'bg-violet-600 text-white font-bold' : 'hover:text-white'
                  }`}
                >
                  {Math.round(opacity * 100)}%
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full h-[480px] rounded-lg overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none z-10"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-xs font-mono text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-emerald-400" /> Call Volume by Strike
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-rose-400" /> Put Volume by Strike
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2 rounded-sm bg-violet-300/40" /> OI Overlay by Strike
        </span>
      </div>
    </div>
  );
};

export default TradingViewChart;
