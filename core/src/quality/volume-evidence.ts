import type { LegacyScoreBonus, LegacyScorePenalty, LegacyVolumeEvidence } from '../legacy/legacy.types.js';

/**
 * @deprecated Use @trader-agent/smart-money-indicator-core instead.
 * Removal target: release N+1.
 */
export function scoreLegacyVolumeEvidence(e: LegacyVolumeEvidence): LegacyScoreBonus[] | LegacyScorePenalty[] {
  if (!e.available || !e.reliable) {
    return [{
      code: 'VOLUME_UNAVAILABLE_OR_UNRELIABLE',
      source: 'SETUP_QUALITY',
      points: 3,
      severity: 'LOW',
      reason: 'Volume data is unavailable or unreliable, used as low-confidence penalty only',
    }];
  }
  if (e.relativeVolume !== undefined && e.relativeVolume >= 1.5) {
    return [{
      code: 'IMPULSE_VOLUME_CONFIRMED',
      source: 'SETUP_QUALITY',
      points: 5,
      reason: 'Impulse candle had above-average relative volume',
    }];
  }
  if (e.relativeVolume !== undefined && e.relativeVolume < 0.8) {
    return [{
      code: 'LOW_VOLUME_REACTION',
      source: 'SETUP_QUALITY',
      points: 5,
      severity: 'LOW',
      reason: 'Reaction occurred on below-average volume',
    }];
  }
  return [];
}
