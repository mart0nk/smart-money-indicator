import { describe, expect, it } from 'vitest';
import {
  linkSweepToZone,
  runSmartMoneyEngine,
  strictCryptoIntradayConfig,
  type LiquiditySweepEvidence,
} from '../../src/index.js';
import { candle, expectAoi } from './smc-v2-test-helpers.js';

describe('SMI core v2 quality, eligibility and evidence linking', () => {
  it('keeps tiny FVGs visible but blocks trigger eligibility under strict profile', () => {
    const history = [
      candle('15m', 0, 100, 100, 99, 99.5),
      candle('15m', 1, 99.5, 101, 99, 100),
      candle('15m', 2, 100.01, 101.5, 100.005, 101),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: strictCryptoIntradayConfig,
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.quality.grade).toBe('LOW');
    expect(fvg.quality.penalties).toContain('GAP_TOO_SMALL');
    expect(fvg.eligibility.visibleOnChart).toBe(true);
    expect(fvg.eligibility.usableAsTriggerContext).toBe(false);
    expect(fvg.recordedAtCursor).toBe(output.cursorMs);
    expect(fvg.availableFrom).toBeLessThanOrEqual(output.cursorMs);
  });

  it('accepts only side-compatible sweeps near the zone', () => {
    const history = [
      candle('15m', 0, 98, 100, 97, 99),
      candle('15m', 1, 99, 110, 99, 109),
      candle('15m', 2, 109, 112, 105, 111),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const zone = expectAoi(output, 'FVG', 'BULLISH');
    const baseSweep = {
      sweepId: 'sweep:1',
      symbol: 'BTCUSDT',
      sourceTimeframe: '15m',
      referenceId: 'swing-low:1',
      referenceLevel: zone.aoiLow,
      sweptExtreme: zone.aoiLow * 0.999,
      reclaimClose: zone.aoiLow * 1.001,
      sourceTime: zone.availableFrom,
      availableFrom: zone.availableFrom,
      observedAt: output.cursorMs,
      recordedAtCursor: output.cursorMs,
      validForCandles: 8,
      expiresAt: output.cursorMs + 8 * 15 * 60_000,
      stale: false,
      quality: {
        score: 80,
        grade: 'HIGH',
        reasons: ['WICK_RECLAIM_CONFIRMED'],
        penalties: [],
      },
    } satisfies Omit<LiquiditySweepEvidence, 'side'>;

    const accepted = linkSweepToZone({
      zone,
      sweep: { ...baseSweep, side: 'SELL_SIDE_SWEEP' },
      cursorTime: output.cursorMs,
    });
    const rejected = linkSweepToZone({
      zone,
      sweep: { ...baseSweep, sweepId: 'sweep:2', side: 'BUY_SIDE_SWEEP' },
      cursorTime: output.cursorMs,
    });

    expect(accepted.accepted).toBe(true);
    expect(accepted.relation).toBe('SIDE_COMPATIBLE');
    expect(rejected.accepted).toBe(false);
    expect(rejected.relation).toBe('SIDE_INCOMPATIBLE');
  });
});
