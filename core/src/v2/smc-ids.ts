import { createHash } from 'node:crypto';
import type { SmartMoneyEngineInput } from './smc-core.types.js';

function numberId(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toString();
}

export function buildZoneId(input: {
  symbol: string;
  sourceTimeframe: string;
  aoiType: 'FVG' | 'ORDER_BLOCK';
  side: 'BULLISH' | 'BEARISH';
  sourceCandleTime: number;
  aoiLow: number;
  aoiHigh: number;
}): string {
  return [
    input.symbol.toUpperCase(),
    input.sourceTimeframe,
    input.aoiType,
    input.side,
    input.sourceCandleTime,
    numberId(input.aoiLow),
    numberId(input.aoiHigh),
  ].join(':');
}

export function buildSourceId(input: {
  symbol: string;
  sourceTimeframe: string;
  sourceType: 'FVG' | 'ORDER_BLOCK';
  sourceTime: number;
  provenanceId?: string;
}): string {
  return [
    input.symbol.toUpperCase(),
    input.sourceTimeframe,
    input.sourceType,
    'SOURCE',
    input.sourceTime,
    input.provenanceId ?? 'none',
  ].join(':');
}

export function buildSweepId(input: {
  symbol: string;
  sourceTimeframe: string;
  side: string;
  referenceId: string;
  availableFrom: number;
}): string {
  return [input.symbol.toUpperCase(), input.sourceTimeframe, 'SWEEP', input.side, input.referenceId, input.availableFrom].join(':');
}

export function buildFactId(input: {
  factType: string;
  zoneId?: string;
  sweepId?: string;
  availableFrom: number;
}): string {
  return [input.factType, input.zoneId ?? input.sweepId ?? 'unscoped', input.availableFrom].join(':');
}

export function buildSnapshotId(input: SmartMoneyEngineInput, configVersion: string): string {
  const candleTimes = Object.entries(input.candlesByTimeframe)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timeframe, candles]) => [timeframe, (candles ?? []).map((candle) => candle.closeTime ?? candle.openTime)]);
  const references = (input.referenceLevels ?? []).map((level) => level.referenceId).sort();
  return createHash('sha256')
    .update(JSON.stringify([input.symbol.toUpperCase(), input.cursorMs, configVersion, candleTimes, references]))
    .digest('hex')
    .slice(0, 24);
}
