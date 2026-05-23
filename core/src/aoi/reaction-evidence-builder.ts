import type { PrimitiveReactionEvidence } from '../primitives/primitives.types.js';

export function hasSufficientReactionEvidence(e: PrimitiveReactionEvidence): boolean {
  const sweepOk = e.liquiditySweepEvidence?.strength === 'MEDIUM' || e.liquiditySweepEvidence?.strength === 'HIGH';
  const candleOk = e.candlePattern === 'ENGULFING' || e.candlePattern === 'STRONG_REJECTION' || e.candlePattern === 'PIN_BAR';
  return e.closeBackInDirection && (e.momentumShift || sweepOk || candleOk);
}

export function sweepStrengthFromEvidence(e: PrimitiveReactionEvidence): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  return e.liquiditySweepEvidence?.strength;
}
