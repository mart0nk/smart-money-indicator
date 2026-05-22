import type { LegacyCandle, LegacyLiquiditySweepEvidence, LegacySwingPoint } from '../legacy/legacy.types.js';
import type { LiquiditySweepEvidence, SmartMoneyCandle, SmartMoneyProof, Timeframe } from '../types/index.js';
import { detectSmartMoneySwingPoints } from '../structure/swing-detector.js';
import { isSmartMoneySwingUsableAt } from '../structure/swing-point.types.js';

export function detectSmartMoneyLiquiditySweeps(input: {
  symbol: string;
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  proof: SmartMoneyProof;
  validForCandles: number;
}): LiquiditySweepEvidence[] {
  const sweeps: LiquiditySweepEvidence[] = [];
  for (const timeframe of ['5m', '15m', '1m'] as const) {
    const candles = (input.candlesByTimeframe[timeframe] ?? []).map(toLegacyCandle);
    const swings = detectSmartMoneySwingPoints(candles, { leftBars: 2, rightBars: 2 });
    for (let i = 0; i < candles.length; i += 1) {
      const candle = candles[i];
      if (candle === undefined) continue;
      for (const swing of swings) {
        const legacy = detectLegacyLiquiditySweep(candle, swing, 0, i);
        if (legacy === null) continue;
        sweeps.push({
          sweepId: `${input.symbol}:${timeframe}:SWEEP:${legacy.direction}:${legacy.candleOpenTime}:${legacy.referenceLevel}`,
          symbol: input.symbol,
          sourceTimeframe: timeframe,
          side: legacy.direction === 'SELL_SIDE_SWEEP' ? 'SELL_SIDE' : 'BUY_SIDE',
          referenceLevel: legacy.referenceLevel,
          referenceType: legacy.referenceLevelType === 'SWING_HIGH' ? 'LOCAL_HIGH' : 'LOCAL_LOW',
          sweptExtreme: legacy.wickExtreme,
          closeBackPrice: legacy.direction === 'SELL_SIDE_SWEEP' ? candle.close : candle.close,
          wickExtensionPct: legacy.wickExtensionPct * 100,
          closeBackPct: legacy.closeBackDistancePct,
          detectedAt: legacy.candleOpenTime,
          detectedCandleTime: legacy.candleOpenTime,
          rejectionConfirmed: true,
          followedByChoCh: false,
          freshness: 'FRESH',
          validForCandles: input.validForCandles,
          expiresAt: legacy.candleOpenTime + input.validForCandles * timeframeMs(timeframe),
          proof: input.proof,
        });
      }
    }
  }
  return dedupeBy(sweeps, (sweep) => sweep.sweepId);
}

/**
 * @deprecated Use @trader-agent/smart-money-indicator-core instead.
 * Removal target: release N+1.
 */
export function detectLegacyLiquiditySweep(
  candle: LegacyCandle,
  swing: LegacySwingPoint,
  atr: number,
  currentIndex: number
): LegacyLiquiditySweepEvidence | null {
  if (!candle.closed || !isSmartMoneySwingUsableAt(swing, currentIndex)) return null;
  const isBuySideSweep = swing.type === 'HIGH' && candle.high > swing.price && candle.close < swing.price;
  const isSellSideSweep = swing.type === 'LOW' && candle.low < swing.price && candle.close > swing.price;
  if (!isBuySideSweep && !isSellSideSweep) return null;
  const direction: LegacyLiquiditySweepEvidence['direction'] = isBuySideSweep ? 'BUY_SIDE_SWEEP' : 'SELL_SIDE_SWEEP';
  const wickExtreme = isBuySideSweep ? candle.high : candle.low;
  const wickExtension = Math.abs(wickExtreme - swing.price);
  const closeBackDistance = Math.abs(candle.close - swing.price);
  const base = {
    detected: true as const,
    direction,
    referenceLevelType: (swing.type === 'HIGH' ? 'SWING_HIGH' : 'SWING_LOW') as 'SWING_HIGH' | 'SWING_LOW',
    referenceLevelId: swing.id,
    referenceLevel: swing.price,
    wickExtreme,
    wickExtension,
    wickExtensionPct: wickExtension / swing.price,
    closeBackBeyondLevel: isBuySideSweep ? candle.close < swing.price : candle.close > swing.price,
    closeBackDistance,
    closeBackDistancePct: closeBackDistance / swing.price,
    candleIndex: currentIndex,
    candleOpenTime: candle.openTime.getTime(),
    strength: 'LOW' as const,
    evidence: ['WICK_BEYOND_LEVEL', 'CLOSE_BACK_BEYOND_LEVEL'],
  };
  const wickExtensionAtr = atr > 0 ? wickExtension / atr : undefined;
  const closeBackDistanceAtr = atr > 0 ? closeBackDistance / atr : undefined;
  const partial: LegacyLiquiditySweepEvidence = {
    ...base,
    ...(wickExtensionAtr !== undefined ? { wickExtensionAtr } : {}),
    ...(closeBackDistanceAtr !== undefined ? { closeBackDistanceAtr } : {}),
  };
  const score = scoreLegacyLiquiditySweep(partial);
  return { ...partial, strength: legacySweepStrengthFromScore(score) };
}

export function scoreLegacyLiquiditySweep(e: LegacyLiquiditySweepEvidence): number {
  let score = 0;
  if (e.wickExtensionAtr !== undefined) {
    if (e.wickExtensionAtr >= 0.5) score += 2;
    else if (e.wickExtensionAtr >= 0.25) score += 1;
  }
  if (e.closeBackDistanceAtr !== undefined) {
    if (e.closeBackDistanceAtr >= 0.5) score += 2;
    else if (e.closeBackDistanceAtr >= 0.25) score += 1;
  }
  if (e.closeBackBeyondLevel) score += 2;
  return score;
}

export function legacySweepStrengthFromScore(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}

function toLegacyCandle(candle: SmartMoneyCandle): LegacyCandle {
  return {
    symbol: candle.symbol,
    timeframe: candle.timeframe,
    openTime: new Date(candle.openTime),
    ...(candle.closeTime !== undefined ? { closeTime: new Date(candle.closeTime) } : {}),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    closed: candle.closed,
  };
}

function timeframeMs(timeframe: Timeframe): number {
  if (timeframe === '1m') return 60_000;
  if (timeframe === '5m') return 300_000;
  if (timeframe === '15m') return 900_000;
  if (timeframe === '1h') return 3_600_000;
  return 14_400_000;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
