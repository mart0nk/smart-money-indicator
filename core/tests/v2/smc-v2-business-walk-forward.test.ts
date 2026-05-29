import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  buildBearishFvgSequence,
  buildBullishFvgSequence,
  candle,
  expectAoi,
  expectFact,
  expectSweep,
  referenceLevel,
} from './smc-v2-test-helpers.js';

describe('SMI core v2 business walk-forward timelines', () => {
  it('replays full bullish FVG lifecycle without future leakage', () => {
    const candles = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 106, 108),
      candle('15m', 4, 108, 109, 103, 104),
      candle('15m', 5, 104, 107, 103, 106),
      candle('15m', 6, 106, 107, 97, 98),
      candle('15m', 7, 98, 106, 98, 104),
    ];

    const noZone = runAt(1);
    expect(noZone.aois.filter((aoi) => aoi.aoiType === 'FVG')).toHaveLength(0);

    const created = runAt(2);
    const createdFvg = expectAoi(created, 'FVG', 'BULLISH');
    expect(createdFvg.state).toBe('AVAILABLE');
    expectFact(created, 'FVG_ZONE_AVAILABLE', createdFvg.zoneId);

    const stable = runAt(3);
    const stableFvg = expectAoi(stable, 'FVG', 'BULLISH');
    expect(stableFvg.zoneId).toBe(createdFvg.zoneId);
    expect(stableFvg.state).toBe('AVAILABLE');

    const touched = runAt(4);
    const touchedFvg = expectAoi(touched, 'FVG', 'BULLISH');
    expect(touchedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(touchedFvg.state).toBe('RETURNED');
    expectFact(touched, 'IMBALANCE_PULLBACK_LOCATION_CONFIRMED', touchedFvg.zoneId);

    const reacted = runAt(5);
    const reactedFvg = expectAoi(reacted, 'FVG', 'BULLISH');
    expect(reactedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(reactedFvg.state).toBe('REACTION_CONFIRMED');
    expectFact(reacted, 'FVG_REACTION_CONFIRMED', reactedFvg.zoneId);

    const invalidated = runAt(6);
    const invalidatedFvg = expectAoi(invalidated, 'FVG', 'BULLISH');
    expect(invalidatedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(invalidatedFvg.state).toBe('INVALIDATED');
    expectFact(invalidated, 'FVG_INVALIDATED', invalidatedFvg.zoneId);

    const terminal = runAt(7);
    const terminalFvg = expectAoi(terminal, 'FVG', 'BULLISH');
    expect(terminalFvg.zoneId).toBe(createdFvg.zoneId);
    expect(terminalFvg.state).toBe('INVALIDATED');

    for (let index = 0; index < candles.length; index += 1) {
      const output = runAt(index);
      expect(runAt(index)).toEqual(output);
      assertNoFutureEvidence(output);
      assertNoRuntimeTradingSemantics(output);
    }

    function runAt(index: number) {
      return runSmartMoneyEngine({
        symbol: 'BTCUSDT',
        cursorMs: candles[index]!.closeTime!,
        candlesByTimeframe: { '15m': candles.slice(0, index + 1) },
      });
    }
  });

  it('replays bearish FVG mirror lifecycle and terminal invalidation', () => {
    const candles = [
      ...buildBearishFvgSequence(),
      candle('15m', 3, 92, 94, 90, 92),
      candle('15m', 4, 92, 98, 91, 97),
      candle('15m', 5, 97, 98, 93, 94),
      candle('15m', 6, 94, 103, 94, 102),
      candle('15m', 7, 102, 103, 96, 98),
    ];

    const created = runAt(2);
    const createdFvg = expectAoi(created, 'FVG', 'BEARISH');
    expect(createdFvg.state).toBe('AVAILABLE');

    const touched = runAt(4);
    const touchedFvg = expectAoi(touched, 'FVG', 'BEARISH');
    expect(touchedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(touchedFvg.state).toBe('RETURNED');
    expectFact(touched, 'IMBALANCE_PULLBACK_LOCATION_CONFIRMED', touchedFvg.zoneId);

    const reacted = runAt(5);
    const reactedFvg = expectAoi(reacted, 'FVG', 'BEARISH');
    expect(reactedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(reactedFvg.state).toBe('REACTION_CONFIRMED');

    const invalidated = runAt(6);
    const invalidatedFvg = expectAoi(invalidated, 'FVG', 'BEARISH');
    expect(invalidatedFvg.zoneId).toBe(createdFvg.zoneId);
    expect(invalidatedFvg.state).toBe('INVALIDATED');

    const terminal = runAt(7);
    const terminalFvg = expectAoi(terminal, 'FVG', 'BEARISH');
    expect(terminalFvg.zoneId).toBe(createdFvg.zoneId);
    expect(terminalFvg.state).toBe('INVALIDATED');

    function runAt(index: number) {
      const output = runSmartMoneyEngine({
        symbol: 'BTCUSDT',
        cursorMs: candles[index]!.closeTime!,
        candlesByTimeframe: { '15m': candles.slice(0, index + 1) },
      });
      assertNoFutureEvidence(output);
      return output;
    }
  });

  it('replays bullish OB lifecycle with pullback and terminal invalidation', () => {
    const candles = [
      candle('15m', 0, 100, 102, 98, 99),
      candle('15m', 1, 99, 105, 99, 104),
      candle('15m', 2, 104, 106, 103, 105),
      candle('15m', 3, 105, 106, 100, 101.5),
      candle('15m', 4, 103, 104, 97, 97.5),
      candle('15m', 5, 97.5, 103, 97, 101),
    ];
    const config = {
      orderBlock: {
        requireBos: true,
        requireConfirmedBos: false,
        requireDisplacement: true,
        boundsPolicy: 'WICK' as const,
      },
    };

    expect(runAt(0).aois.some((aoi) => aoi.aoiType === 'ORDER_BLOCK')).toBe(false);
    const created = runAt(1);
    const ob = expectAoi(created, 'ORDER_BLOCK', 'BULLISH');
    expect(ob.state).toBe('AVAILABLE');
    expectFact(created, 'ORDER_BLOCK_AVAILABLE', ob.zoneId);

    const touched = runAt(3);
    const touchedOb = expectAoi(touched, 'ORDER_BLOCK', 'BULLISH');
    expect(touchedOb.zoneId).toBe(ob.zoneId);
    expect(touchedOb.state).toBe('RETURNED');
    expectFact(touched, 'PULLBACK_INTO_ORDER_BLOCK', touchedOb.zoneId);

    const invalidated = runAt(4);
    const invalidatedOb = expectAoi(invalidated, 'ORDER_BLOCK', 'BULLISH');
    expect(invalidatedOb.zoneId).toBe(ob.zoneId);
    expect(invalidatedOb.state).toBe('INVALIDATED');
    expectFact(invalidated, 'ORDER_BLOCK_INVALIDATED', invalidatedOb.zoneId);

    const terminal = runAt(5);
    const terminalOb = expectAoi(terminal, 'ORDER_BLOCK', 'BULLISH');
    expect(terminalOb.zoneId).toBe(ob.zoneId);
    expect(terminalOb.state).toBe('INVALIDATED');

    function runAt(index: number) {
      const output = runSmartMoneyEngine({
        symbol: 'BTCUSDT',
        cursorMs: candles[index]!.closeTime!,
        candlesByTimeframe: { '15m': candles.slice(0, index + 1) },
        config,
      });
      assertNoFutureEvidence(output);
      return output;
    }
  });

  it('replays sweep timeline from no reclaim to detected and stale context', () => {
    const candles = [
      candle('3m', 0, 100, 102, 98, 99),
      candle('3m', 1, 101, 102, 98, 101),
      candle('3m', 2, 101, 102, 100, 101),
      candle('3m', 3, 101, 102, 100, 101),
    ];
    const referenceLevels = [referenceLevel({
      referenceId: 'swing-low:100',
      type: 'SWING_LOW',
      price: 100,
      side: 'SELL_SIDE_LIQUIDITY',
      detectedAt: candles[0]!.openTime,
    })];

    const noSweep = runAt(0);
    expect(noSweep.sweeps).toHaveLength(0);

    const detected = runAt(1);
    const sweep = expectSweep(detected, 'SELL_SIDE_SWEEP');
    expect(sweep.stale).toBe(false);
    expectFact(detected, 'SELL_SIDE_SWEEP_DETECTED');
    assertNoRuntimeTradingSemantics(detected);

    const stale = runAt(3);
    const staleSweep = expectSweep(stale, 'SELL_SIDE_SWEEP');
    expect(staleSweep.sweepId).toBe(sweep.sweepId);
    expect(staleSweep.stale).toBe(true);
    expectFact(stale, 'SWEEP_STALE');

    function runAt(index: number) {
      const output = runSmartMoneyEngine({
        symbol: 'BTCUSDT',
        cursorMs: candles[index]!.closeTime!,
        candlesByTimeframe: { '3m': candles.slice(0, index + 1) },
        referenceLevels,
        config: { sweeps: { validForCandles: 1, minWickExtensionBps: 1 } },
      });
      assertNoFutureEvidence(output);
      return output;
    }
  });
});
