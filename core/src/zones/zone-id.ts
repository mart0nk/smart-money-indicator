import type { Timeframe } from '../types/index.js';

export function normalizeSymbolForZoneId(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function normalizePriceForZoneId(price: number): string {
  if (!Number.isFinite(price)) return 'NaN';
  return Number(price.toFixed(8)).toString();
}

export function buildStableZoneId(input: {
  symbol: string;
  timeframe: Timeframe | string;
  zoneType: 'FVG' | 'ORDER_BLOCK';
  side: 'BULLISH' | 'BEARISH';
  createdAt: number;
  zoneLow: number;
  zoneHigh: number;
}): string {
  return [
    normalizeSymbolForZoneId(input.symbol),
    input.timeframe,
    input.zoneType,
    input.side,
    Math.trunc(input.createdAt),
    normalizePriceForZoneId(input.zoneLow),
    normalizePriceForZoneId(input.zoneHigh),
  ].join(':');
}
