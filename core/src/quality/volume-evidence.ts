import type { PrimitiveScoreBonus, PrimitiveScorePenalty, PrimitiveVolumeEvidence } from '../primitives/primitives.types.js';

export function scoreVolumeEvidence(e: PrimitiveVolumeEvidence): PrimitiveScoreBonus[] | PrimitiveScorePenalty[] {
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
