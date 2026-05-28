import { createHash } from 'node:crypto';
import type { SmartMoneyConfig, SmartMoneyEngineInput } from './smc-core.types.js';

export function normalizeIdNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot encode non-finite number for deterministic id: ${value}`);
  }
  return Number(value.toFixed(8)).toString();
}

function encodeSnapshotNumber(value: number): number | string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Infinity) return 'Infinity';
  if (value === -Infinity) return '-Infinity';
  return Number(value.toFixed(8));
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
    normalizeIdNumber(input.aoiLow),
    normalizeIdNumber(input.aoiHigh),
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

export function buildSnapshotId(input: SmartMoneyEngineInput, config: SmartMoneyConfig): string {
  const candles = Object.entries(input.candlesByTimeframe)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([timeframe, timeframeCandles]) => [
      timeframe,
      (timeframeCandles ?? [])
        .map((candle) => ({
          timeframe: candle.timeframe,
          openTime: encodeSnapshotNumber(candle.openTime),
          closeTime: candle.closeTime === undefined ? undefined : encodeSnapshotNumber(candle.closeTime),
          open: encodeSnapshotNumber(candle.open),
          high: encodeSnapshotNumber(candle.high),
          low: encodeSnapshotNumber(candle.low),
          close: encodeSnapshotNumber(candle.close),
          volume: encodeSnapshotNumber(candle.volume),
          closed: candle.closed,
        }))
        .sort((a, b) => String(a.closeTime ?? a.openTime).localeCompare(String(b.closeTime ?? b.openTime))),
    ]);
  const references = (input.referenceLevels ?? [])
    .map((level) => ({
      referenceId: level.referenceId,
      type: level.type,
      price: encodeSnapshotNumber(level.price),
      side: level.side,
      sourceTimeframe: level.sourceTimeframe,
      detectedAt: encodeSnapshotNumber(level.detectedAt),
    }))
    .sort((a, b) => a.referenceId.localeCompare(b.referenceId));
  return createHash('sha256')
    .update(JSON.stringify({
      symbol: input.symbol.toUpperCase(),
      cursorMs: encodeSnapshotNumber(input.cursorMs),
      config: encodeSnapshotPayload(config),
      candles,
      references,
    }))
    .digest('hex')
    .slice(0, 24);
}

function encodeSnapshotPayload(value: unknown): unknown {
  if (typeof value === 'number') return encodeSnapshotNumber(value);
  if (Array.isArray(value)) return value.map(encodeSnapshotPayload);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, encodeSnapshotPayload(entry)]),
    );
  }
  return value;
}
