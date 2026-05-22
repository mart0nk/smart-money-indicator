import { describe, expect, it } from 'vitest';
import {
  calculateLegacyMitigationPenalty,
  hasLegacyReactionEvidence,
  scoreLegacyVolumeEvidence,
} from '../../src/legacy/index.js';

describe('legacy mitigation, reaction and volume compatibility', () => {
  it('preserves mitigation penalty behavior', () => {
    expect(calculateLegacyMitigationPenalty({
      mitigationState: 'MITIGATED',
      fillPct: 100,
      touchCount: 3,
      htfTrendAlignment: 'AGAINST',
      relativeStrengthState: 'UNFAVORABLE',
    })).toBe(21);
  });

  it('preserves reaction evidence behavior', () => {
    expect(hasLegacyReactionEvidence({
      liquiditySweep: false,
      closeBackInDirection: true,
      momentumShift: false,
      candlePattern: 'PIN_BAR',
    })).toBe(true);
  });

  it('preserves volume evidence behavior', () => {
    const result = scoreLegacyVolumeEvidence({
      available: true,
      reliable: true,
      volume: 100,
      relativeVolume: 2,
      scoreImpact: 0,
      warnings: [],
    });
    expect(result[0]?.code).toBe('IMPULSE_VOLUME_CONFIRMED');
  });
});
