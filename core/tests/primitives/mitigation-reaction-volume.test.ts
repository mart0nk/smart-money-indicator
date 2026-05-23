import { describe, expect, it } from 'vitest';
import {
  calculateMitigationPenalty,
  hasSufficientReactionEvidence,
  scoreVolumeEvidence,
} from '../../src/index.js';

describe('mitigation, reaction and volume primitives', () => {
  it('preserves mitigation penalty behavior', () => {
    expect(calculateMitigationPenalty({
      mitigationState: 'MITIGATED',
      fillPct: 100,
      touchCount: 3,
      htfTrendAlignment: 'AGAINST',
      relativeStrengthState: 'UNFAVORABLE',
    })).toBe(21);
  });

  it('preserves reaction evidence behavior', () => {
    expect(hasSufficientReactionEvidence({
      liquiditySweep: false,
      closeBackInDirection: true,
      momentumShift: false,
      candlePattern: 'PIN_BAR',
    })).toBe(true);
  });

  it('preserves volume evidence behavior', () => {
    const result = scoreVolumeEvidence({
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
