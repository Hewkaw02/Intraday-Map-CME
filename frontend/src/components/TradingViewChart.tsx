import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, LineStyle, CandlestickSeries, HistogramSeries } from 'lightweight-charts';
import type { IChartApi } from 'lightweight-charts';
import type { CmeSymbolData, PriceCandle } from '../types';

interface TradingViewChartProps {
  candles: PriceCandle[];
  cmeData?: CmeSymbolData;
  symbol: string;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  candles,
  cmeData,
  symbol
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create TradingView Lightweight Chart
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#151922' },
        textColor: '#94A3B8',
        fontSize: 12,
        fontFamily: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif'
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
      height: 480,
    });

    chartRef.current = chart;

    // Add Candlestick Series using lightweight-charts v5 addSeries API
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
    });

    if (candles && candles.length > 0) {
      const formattedData = candles.map(c => ({
        time: c.timestamp as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeries.setData(formattedData);
    }

    // Add Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#3B82F6',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    if (candles && candles.length > 0) {
      volumeSeries.setData(
        candles.map(c => ({
          time: c.timestamp as any,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
        }))
      );
    }

    // Add Price Lines for Vol2Vol Standard Deviation Levels & Future Price
    if (cmeData) {
      // Future Price reference line
      candleSeries.createPriceLine({
        price: cmeData.futurePrice,
        color: '#F59E0B',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `CME Future (${cmeData.futurePrice})`,
      });

      // Standard Deviation lines
      const sd1 = cmeData.standardDeviations.find(s => s.sd === 1);
      const sd2 = cmeData.standardDeviations.find(s => s.sd === 2);
      const sd3 = cmeData.standardDeviations.find(s => s.sd === 3);

      if (sd1) {
        candleSeries.createPriceLine({
          price: sd1.upside.strikeEnd,
          color: '#10B981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `+1SD (${sd1.upside.strikeEnd.toFixed(1)})`,
        });
        candleSeries.createPriceLine({
          price: sd1.downside.strikeStart,
          color: '#EF4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `-1SD (${sd1.downside.strikeStart.toFixed(1)})`,
        });
      }

      if (sd2) {
        candleSeries.createPriceLine({
          price: sd2.upside.strikeEnd,
          color: '#3B82F6',
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `+2SD (${sd2.upside.strikeEnd.toFixed(1)})`,
        });
        candleSeries.createPriceLine({
          price: sd2.downside.strikeStart,
          color: '#F97316',
          lineWidth: 1,
          lineStyle: LineStyle.LargeDashed,
          axisLabelVisible: true,
          title: `-2SD (${sd2.downside.strikeStart.toFixed(1)})`,
        });
      }

      if (sd3) {
        candleSeries.createPriceLine({
          price: sd3.upside.strikeEnd,
          color: '#A855F7',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `+3SD (${sd3.upside.strikeEnd.toFixed(1)})`,
        });
        candleSeries.createPriceLine({
          price: sd3.downside.strikeStart,
          color: '#EC4899',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `-3SD (${sd3.downside.strikeStart.toFixed(1)})`,
        });
      }
    }

    chart.timeScale().fitContent();

    // Resize Handler
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, cmeData, symbol]);

  return (
    <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Price Chart ({symbol})</span>
            <span className="text-xs bg-dark-700 text-slate-300 font-mono font-normal px-2 py-0.5 rounded">
              1m Candlestick + CME SD Levels
            </span>
          </h2>
        </div>
        {cmeData && (
          <div className="flex items-center space-x-3 text-xs font-mono">
            <span className="flex items-center text-amber-400">
              <span className="w-2.5 h-0.5 bg-amber-400 mr-1.5"></span> CME Future: {cmeData.futurePrice}
            </span>
            <span className="flex items-center text-emerald-400">
              <span className="w-2.5 h-0.5 bg-emerald-400 mr-1.5"></span> +1SD / -1SD
            </span>
            <span className="flex items-center text-blue-400">
              <span className="w-2.5 h-0.5 bg-blue-400 mr-1.5"></span> ±2SD / ±3SD
            </span>
          </div>
        )}
      </div>
      <div ref={containerRef} className="w-full h-[480px] rounded-lg overflow-hidden" />
    </div>
  );
};
