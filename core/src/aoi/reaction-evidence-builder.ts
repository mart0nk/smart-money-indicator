import type { LegacyReactionEvidence } from '../legacy/legacy.types.js';

/**
 * @deprecated Use @trader-agent/smart-money-indicator-core instead.
 * Removal target: release N+1.
 */
export function hasLegacyReactionEvidence(e: LegacyReactionEvidence): boolean {
  const sweepOk = e.liquiditySweepEvidence?.strength === 'MEDIUM' || e.liquiditySweepEvidence?.strength === 'HIGH';
  const candleOk = e.candlePattern === 'ENGULFING' || e.candlePattern === 'STRONG_REJECTION' || e.candlePattern === 'PIN_BAR';
  return e.closeBackInDirection && (e.momentumShift || sweepOk || candleOk);
}

export function legacySweepStrengthFromEvidence(e: LegacyReactionEvidence): 'LOW' | 'MEDIUM' | 'HIGH' | undefined {
  return e.liquiditySweepEvidence?.strength;
}
