import type { PrimitiveCandle, PrimitiveFvgZone } from '../primitives/primitives.types.js';
import { buildStableZoneId } from './zone-id.js';

export function detectFvgZones(
  candles: readonly PrimitiveCandle[],
  atr: number,
  options?: { minGapBps?: number; impulseRule?: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE' }
): PrimitiveFvgZone[] {
  const results: PrimitiveFvgZone[] = [];
  const impulseRule = options?.impulseRule ?? 'CANDLE_COLOR';

  for (let i = 0; i <= candles.length - 3; i += 1) {
    const prev = candles[i];
    const impulse = candles[i + 1];
    const next = candles[i + 2];
    if (prev === undefined || impulse === undefined || next === undefined) continue;
    if (!prev.closed || !impulse.closed || !next.closed) continue;

    if (next.low > prev.high && impulsePasses(impulse, 'BULLISH', impulseRule, atr)) {
      const zone = buildFvg({
        symbol: next.symbol,
        timeframe: next.timeframe,
        direction: 'BULLISH',
        upperLevel: next.low,
        lowerLevel: prev.high,
        detectedAtOpenTime: next.openTime.getTime(),
        candleIndexPrev: i,
        candleIndexImpulse: i + 1,
        candleIndexNext: i + 2,
        atr,
      });
      if (passesMinGap(zone, options?.minGapBps)) results.push(zone);
      continue;
    }

    if (next.high < prev.low && impulsePasses(impulse, 'BEARISH', impulseRule, atr)) {
      const zone = buildFvg({
        symbol: next.symbol,
        timeframe: next.timeframe,
        direction: 'BEARISH',
        upperLevel: prev.low,
        lowerLevel: next.high,
        detectedAtOpenTime: next.openTime.getTime(),
        candleIndexPrev: i,
        candleIndexImpulse: i + 1,
        candleIndexNext: i + 2,
        atr,
      });
      if (passesMinGap(zone, options?.minGapBps)) results.push(zone);
    }
  }

  return results;
}

function buildFvg(input: {
  symbol: string;
  timeframe: string;
  direction: 'BULLISH' | 'BEARISH';
  upperLevel: number;
  lowerLevel: number;
  detectedAtOpenTime: number;
  candleIndexPrev: number;
  candleIndexImpulse: number;
  candleIndexNext: number;
  atr: number;
}): PrimitiveFvgZone {
  const gapSize = input.upperLevel - input.lowerLevel;
  const midpoint = (input.upperLevel + input.lowerLevel) / 2;
  const zoneId = buildStableZoneId({
    symbol: input.symbol,
    timeframe: input.timeframe,
    zoneType: 'FVG',
    side: input.direction,
    createdAt: input.detectedAtOpenTime,
    zoneLow: input.lowerLevel,
    zoneHigh: input.upperLevel,
  });
  return {
    id: zoneId,
    zoneId,
    direction: input.direction,
    upperLevel: input.upperLevel,
    lowerLevel: input.lowerLevel,
    midpoint,
    gapSize,
    ...(input.atr > 0 ? { gapSizeAtr: gapSize / input.atr } : {}),
    candleIndexPrev: input.candleIndexPrev,
    candleIndexImpulse: input.candleIndexImpulse,
    candleIndexNext: input.candleIndexNext,
    detectedAtCandleIndex: input.candleIndexNext,
    detectedAtOpenTime: input.detectedAtOpenTime,
    mitigationState: 'UNMITIGATED',
    fillPct: 0,
    touchCount: 0,
    invalidated: false,
  };
}

function impulsePasses(candle: PrimitiveCandle, side: 'BULLISH' | 'BEARISH', rule: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE', atr: number): boolean {
  if (rule === 'NONE') return true;
  if (rule === 'BODY_ATR') return atr > 0 && Math.abs(candle.close - candle.open) / atr >= 0.5;
  return side === 'BULLISH' ? candle.close > candle.open : candle.close < candle.open;
}

function passesMinGap(zone: PrimitiveFvgZone, minGapBps: number | undefined): boolean {
  if (minGapBps === undefined) return true;
  return (zone.gapSize / zone.lowerLevel) * 10_000 >= minGapBps;
}
