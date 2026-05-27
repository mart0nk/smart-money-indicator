import type { PrimitiveCandle, PrimitiveLiquiditySweepEvidence, PrimitiveSwingPoint } from '../primitives/primitives.types.js';
import { isSmartMoneySwingUsableAt } from '../structure/swing-point.types.js';

export function detectLiquiditySweep(
  candle: PrimitiveCandle,
  swing: PrimitiveSwingPoint,
  atr: number,
  currentIndex: number
): PrimitiveLiquiditySweepEvidence | null {
  if (!candle.closed || !isSmartMoneySwingUsableAt(swing, currentIndex)) return null;
  const isBuySideSweep = swing.type === 'HIGH' && candle.high > swing.price && candle.close < swing.price;
  const isSellSideSweep = swing.type === 'LOW' && candle.low < swing.price && candle.close > swing.price;
  if (!isBuySideSweep && !isSellSideSweep) return null;
  const direction: PrimitiveLiquiditySweepEvidence['direction'] = isBuySideSweep ? 'BUY_SIDE_SWEEP' : 'SELL_SIDE_SWEEP';
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
  const partial: PrimitiveLiquiditySweepEvidence = {
    ...base,
    ...(wickExtensionAtr !== undefined ? { wickExtensionAtr } : {}),
    ...(closeBackDistanceAtr !== undefined ? { closeBackDistanceAtr } : {}),
  };
  const score = scoreLiquiditySweep(partial);
  return { ...partial, strength: sweepStrengthFromScore(score) };
}

export function scoreLiquiditySweep(e: PrimitiveLiquiditySweepEvidence): number {
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

export function sweepStrengthFromScore(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score >= 5) return 'HIGH';
  if (score >= 3) return 'MEDIUM';
  return 'LOW';
}
