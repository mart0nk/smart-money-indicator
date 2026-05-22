import type { LegacyCandle, LegacyFvgZone } from '../legacy/legacy.types.js';
import type { SmartMoneyEngineConfig, SmartMoneyFvgZone, SmartMoneyProof, Timeframe } from '../types/index.js';
import { buildStableZoneId } from './zone-id.js';

export function detectSmartMoneyFvgZones(input: {
  symbol: string;
  timeframe: Timeframe;
  candles: Array<{
    symbol: string;
    timeframe: Timeframe;
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    closed: boolean;
  }>;
  proof: SmartMoneyProof;
  config: SmartMoneyEngineConfig;
}): SmartMoneyFvgZone[] {
  const legacyCandles = input.candles.map((candle) => ({
    ...candle,
    openTime: new Date(candle.openTime),
    volume: 0,
  }));
  const legacyOptions: { minGapBps?: number; impulseRule?: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE' } = {
    impulseRule: input.config.fvg.impulseRule ?? 'CANDLE_COLOR',
  };
  if (input.config.fvg.minGapBps !== undefined) legacyOptions.minGapBps = input.config.fvg.minGapBps;
  return detectLegacyFvgZones(legacyCandles, 0, legacyOptions).map((zone) => ({
    zoneId: zone.zoneId ?? zone.id,
    type: 'FVG' as const,
    side: zone.direction,
    symbol: input.symbol,
    timeframe: input.timeframe,
    zoneLow: zone.lowerLevel,
    zoneHigh: zone.upperLevel,
    midpoint: zone.midpoint,
    sourceCandles: {
      candle1Time: legacyCandles[zone.candleIndexPrev]!.openTime.getTime(),
      candle2Time: legacyCandles[zone.candleIndexImpulse]!.openTime.getTime(),
      candle3Time: legacyCandles[zone.candleIndexNext]!.openTime.getTime(),
    },
    createdAt: zone.detectedAtOpenTime,
    availableFrom: zone.detectedAtOpenTime,
    state: 'DETECTED' as const,
    mitigationPct: 0,
    proof: input.proof,
  }));
}

/**
 * @deprecated Use @trader-agent/smart-money-indicator-core instead.
 * Removal target: release N+1.
 */
export function detectLegacyFvgZones(
  candles: readonly LegacyCandle[],
  atr: number,
  options?: { minGapBps?: number; impulseRule?: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE' }
): LegacyFvgZone[] {
  const results: LegacyFvgZone[] = [];
  const impulseRule = options?.impulseRule ?? 'CANDLE_COLOR';

  for (let i = 0; i <= candles.length - 3; i += 1) {
    const prev = candles[i];
    const impulse = candles[i + 1];
    const next = candles[i + 2];
    if (prev === undefined || impulse === undefined || next === undefined) continue;
    if (!prev.closed || !impulse.closed || !next.closed) continue;

    if (next.low > prev.high && impulsePasses(impulse, 'BULLISH', impulseRule, atr)) {
      const zone = buildLegacyFvg({
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
      const zone = buildLegacyFvg({
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

function buildLegacyFvg(input: {
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
}): LegacyFvgZone {
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
    legacyIdWasRandom: false,
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

function impulsePasses(candle: LegacyCandle, side: 'BULLISH' | 'BEARISH', rule: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE', atr: number): boolean {
  if (rule === 'NONE') return true;
  if (rule === 'BODY_ATR') return atr > 0 && Math.abs(candle.close - candle.open) / atr >= 0.5;
  return side === 'BULLISH' ? candle.close > candle.open : candle.close < candle.open;
}

function passesMinGap(zone: LegacyFvgZone, minGapBps: number | undefined): boolean {
  if (minGapBps === undefined) return true;
  return (zone.gapSize / zone.lowerLevel) * 10_000 >= minGapBps;
}
