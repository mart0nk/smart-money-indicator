import type { PrimitiveCandle, PrimitiveFvgZone } from '../primitives/primitives.types.js';
import type { SmartMoneyEngineConfig, SmartMoneyFvgZone, SmartMoneyProof, SmcSourceTimeframe } from '../types/index.js';
import { buildStableZoneId } from './zone-id.js';

export function detectSmartMoneyFvgZones(input: {
  symbol: string;
  timeframe: SmcSourceTimeframe;
  candles: Array<{
    symbol: string;
    timeframe: SmcSourceTimeframe;
    openTime: number;
    closeTime?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    closed: boolean;
  }>;
  proof: SmartMoneyProof;
  config: SmartMoneyEngineConfig;
}): SmartMoneyFvgZone[] {
  const primitiveCandles: PrimitiveCandle[] = input.candles.map((candle) => ({
    symbol: candle.symbol,
    timeframe: candle.timeframe,
    openTime: new Date(candle.openTime),
    ...(candle.closeTime !== undefined ? { closeTime: new Date(candle.closeTime) } : {}),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: 0,
    closed: candle.closed,
  }));
  const primitiveOptions: { minGapBps?: number; impulseRule?: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE' } = {
    impulseRule: input.config.fvg.impulseRule ?? 'CANDLE_COLOR',
  };
  if (input.config.fvg.minGapBps !== undefined) primitiveOptions.minGapBps = input.config.fvg.minGapBps;
  return detectFvgZones(primitiveCandles, 0, primitiveOptions).map((zone) => ({
    sourceId: `${input.symbol}:${input.timeframe}:FVG:SOURCE:${zone.detectedAtOpenTime}:none`,
    zoneId: zone.zoneId ?? zone.id,
    type: 'FVG' as const,
    side: zone.direction,
    symbol: input.symbol,
    timeframe: input.timeframe,
    sourceTimeframe: input.timeframe,
    zoneLow: zone.lowerLevel,
    zoneHigh: zone.upperLevel,
    midpoint: zone.midpoint,
    sourceCandles: {
      candle1Time: primitiveCandles[zone.candleIndexPrev]!.openTime.getTime(),
      candle2Time: primitiveCandles[zone.candleIndexImpulse]!.openTime.getTime(),
      candle3Time: primitiveCandles[zone.candleIndexNext]!.openTime.getTime(),
    },
    sourceCandleTime: primitiveCandles[zone.candleIndexNext]!.openTime.getTime(),
    createdAt: zone.detectedAtOpenTime,
    availableFrom: primitiveCandles[zone.candleIndexNext]!.closeTime?.getTime() ?? zone.detectedAtOpenTime,
    state: 'DETECTED' as const,
    mitigationPct: 0,
    proof: input.proof,
  }));
}

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
