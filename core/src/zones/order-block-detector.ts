import type { PrimitiveCandle, PrimitiveOrderBlock, PrimitiveSwingPoint } from '../primitives/primitives.types.js';
import type { SmartMoneyEngineConfig, SmartMoneyOrderBlockZone, SmartMoneyProof, SmcSourceTimeframe } from '../types/index.js';
import { detectSmartMoneyBos } from '../structure/bos-detector.js';
import { detectSmartMoneySwingPoints } from '../structure/swing-detector.js';
import { isSmartMoneySwingUsableAt } from '../structure/swing-point.types.js';
import { buildStableZoneId } from './zone-id.js';

export function detectSmartMoneyOrderBlockZones(input: {
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
}): SmartMoneyOrderBlockZone[] {
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
  const swings = detectSmartMoneySwingPoints(primitiveCandles, {
    leftBars: input.config.structure.swingPivotLeft,
    rightBars: input.config.structure.swingPivotRight,
  });
  return detectOrderBlocks(primitiveCandles, swings, 0, input.config.orderBlock.maxCandlesBackFromBos).map((ob) => ({
    sourceId: `${input.symbol}:${input.timeframe}:ORDER_BLOCK:SOURCE:${ob.candleOpenTime}:${ob.bosEventId}`,
    zoneId: ob.zoneId ?? ob.id,
    type: 'ORDER_BLOCK' as const,
    side: ob.direction,
    symbol: input.symbol,
    timeframe: input.timeframe,
    sourceTimeframe: input.timeframe,
    zoneLow: ob.low,
    zoneHigh: ob.high,
    midpoint: (ob.low + ob.high) / 2,
    originCandleTime: ob.candleOpenTime,
    sourceCandleTime: ob.candleOpenTime,
    originBosId: ob.bosEventId,
    createdAt: ob.candleOpenTime,
    availableFrom: ob.detectedAtOpenTime ?? ob.candleOpenTime,
    state: 'DETECTED' as const,
    mitigationPct: 0,
    proof: input.proof,
  }));
}

export function detectOrderBlocks(
  candles: readonly PrimitiveCandle[],
  swingPoints: readonly PrimitiveSwingPoint[],
  atr: number,
  lookback = 5
): PrimitiveOrderBlock[] {
  const seenSwingIds = new Set<string>();
  const bosEvents = [];

  for (let i = 0; i < candles.length; i += 1) {
    const candle = candles[i];
    if (candle === undefined) continue;
    for (const swing of swingPoints) {
      if (!isSmartMoneySwingUsableAt(swing, i)) continue;
      if (seenSwingIds.has(swing.id)) continue;
      const event = detectSmartMoneyBos(candle, i, swing, atr);
      if (event !== null) {
        if (event.confirmed) seenSwingIds.add(swing.id);
        bosEvents.push(event);
      }
    }
  }

  const results: PrimitiveOrderBlock[] = [];
  for (const bos of bosEvents) {
    if (!bos.confirmed) continue;
    const startIdx = Math.max(0, bos.breakCandleIndex - lookback);
    let obCandleIndex: number | null = null;
    if (bos.direction === 'BULLISH') {
      for (let j = bos.breakCandleIndex - 1; j >= startIdx; j -= 1) {
        const c = candles[j];
        if (c === undefined || !c.closed) continue;
        if (c.close < c.open) {
          obCandleIndex = j;
          break;
        }
      }
    } else {
      for (let j = bos.breakCandleIndex - 1; j >= startIdx; j -= 1) {
        const c = candles[j];
        if (c === undefined || !c.closed) continue;
        if (c.close > c.open) {
          obCandleIndex = j;
          break;
        }
      }
    }
    if (obCandleIndex === null) continue;
    const obCandle = candles[obCandleIndex];
    if (obCandle === undefined) continue;
    const zoneId = buildStableZoneId({
      symbol: obCandle.symbol,
      timeframe: obCandle.timeframe,
      zoneType: 'ORDER_BLOCK',
      side: bos.direction,
      createdAt: obCandle.openTime.getTime(),
      zoneLow: obCandle.low,
      zoneHigh: obCandle.high,
    });
    results.push({
      id: zoneId,
      zoneId,
      direction: bos.direction,
      candleIndex: obCandleIndex,
      candleOpenTime: obCandle.openTime.getTime(),
      detectedAtOpenTime: bos.confirmedAtOpenTime,
      high: obCandle.high,
      low: obCandle.low,
      open: obCandle.open,
      close: obCandle.close,
      bosEventId: bos.id,
      bosDirection: bos.direction,
      bosLevel: bos.brokenLevel,
      mitigationState: 'UNMITIGATED',
      fillPct: 0,
      touchCount: 0,
      invalidated: false,
      strength: computeStrength(obCandle, atr),
    });
  }
  return results;
}

function computeStrength(candle: PrimitiveCandle, atr: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (atr === 0) return 'MEDIUM';
  const ratio = Math.abs(candle.close - candle.open) / atr;
  if (ratio >= 1.0) return 'HIGH';
  if (ratio >= 0.5) return 'MEDIUM';
  return 'LOW';
}
