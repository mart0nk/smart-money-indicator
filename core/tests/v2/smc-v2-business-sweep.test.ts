import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  candle,
  expectFact,
  expectSweep,
  referenceLevel,
} from './smc-v2-test-helpers.js';

describe('SMI core v2 business logic: liquidity sweeps', () => {
  it('creates sell-side sweep only when downside liquidity is reclaimed', () => {
    const sweepCandle = candle('3m', 0, 100, 101, 98, 101);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweepCandle.closeTime!,
      candlesByTimeframe: { '3m': [sweepCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'swing-low:100',
        type: 'SWING_LOW',
        price: 100,
        side: 'SELL_SIDE_LIQUIDITY',
        detectedAt: sweepCandle.openTime,
      })],
    });
    const sweep = expectSweep(output, 'SELL_SIDE_SWEEP');

    expect(sweep).toMatchObject({
      side: 'SELL_SIDE_SWEEP',
      referenceId: 'swing-low:100',
      referenceLevel: 100,
      sweptExtreme: 98,
      reclaimClose: 101,
    });
    expectFact(output, 'SELL_SIDE_SWEEP_DETECTED');
    assertNoFutureEvidence(output);
    assertNoRuntimeTradingSemantics(output);
  });

  it('creates buy-side sweep only when upside liquidity is rejected', () => {
    const sweepCandle = candle('3m', 0, 100, 102, 99, 99);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweepCandle.closeTime!,
      candlesByTimeframe: { '3m': [sweepCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'swing-high:100',
        type: 'SWING_HIGH',
        price: 100,
        side: 'BUY_SIDE_LIQUIDITY',
        detectedAt: sweepCandle.openTime,
      })],
    });
    const sweep = expectSweep(output, 'BUY_SIDE_SWEEP');

    expect(sweep).toMatchObject({
      side: 'BUY_SIDE_SWEEP',
      referenceId: 'swing-high:100',
      referenceLevel: 100,
      sweptExtreme: 102,
      reclaimClose: 99,
    });
    expectFact(output, 'BUY_SIDE_SWEEP_DETECTED');
  });

  it('does not create sweep when price breaks the level without reclaim or rejection', () => {
    const breakCandle = candle('3m', 0, 100, 102, 99, 101);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: breakCandle.closeTime!,
      candlesByTimeframe: { '3m': [breakCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'swing-high:100',
        type: 'SWING_HIGH',
        price: 100,
        side: 'BUY_SIDE_LIQUIDITY',
        detectedAt: breakCandle.openTime,
      })],
    });

    expect(output.sweeps).toHaveLength(0);
    expect(output.facts.some((fact) => fact.factType === 'BUY_SIDE_SWEEP_DETECTED')).toBe(false);
  });

  it('emits sweep evidence as context only, not entry or signal semantics', () => {
    const sweepCandle = candle('3m', 0, 100, 101, 98, 101);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweepCandle.closeTime!,
      candlesByTimeframe: { '3m': [sweepCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'swing-low:100',
        type: 'SWING_LOW',
        price: 100,
        side: 'SELL_SIDE_LIQUIDITY',
        detectedAt: sweepCandle.openTime,
      })],
    });

    expect(output.sweeps).toHaveLength(1);
    assertNoRuntimeTradingSemantics(output);
  });
});
