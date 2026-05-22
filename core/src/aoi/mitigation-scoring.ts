import type { LegacyMitigationPenaltyInput, LegacyMitigationState } from '../legacy/legacy.types.js';

/**
 * @deprecated Use @trader-agent/smart-money-indicator-core instead.
 * Removal target: release N+1.
 */
export function calculateLegacyMitigationPenalty(input: LegacyMitigationPenaltyInput): number {
  let penalty = 0;
  switch (input.mitigationState) {
    case 'UNMITIGATED': penalty = 0; break;
    case 'PARTIALLY_MITIGATED': penalty = input.fillPct > 70 ? 6 : 3; break;
    case 'MITIGATED': penalty = 8; break;
    case 'OVER_MITIGATED': penalty = 14; break;
    case 'INVALIDATED': return Infinity;
  }
  if (input.touchCount >= 3) penalty += 4;
  if (input.htfTrendAlignment === 'STRONG') penalty = Math.max(0, penalty - 4);
  else if (input.htfTrendAlignment === 'ALIGNED') penalty = Math.max(0, penalty - 2);
  else if (input.htfTrendAlignment === 'AGAINST') penalty += 5;
  if (input.relativeStrengthState === 'SUPPORTIVE') penalty = Math.max(0, penalty - 2);
  else if (input.relativeStrengthState === 'UNFAVORABLE') penalty += 4;
  return penalty;
}

export function isLegacyMitigationInvalidated(state: LegacyMitigationState): boolean {
  return state === 'INVALIDATED';
}
