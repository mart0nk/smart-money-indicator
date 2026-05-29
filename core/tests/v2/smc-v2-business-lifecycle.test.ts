import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoRuntimeTradingSemantics,
  buildBearishFvgSequence,
  buildBullishFvgSequence,
  candle,
  expectAoi,
  expectFact,
} from './smc-v2-test-helpers.js';

describe('SMI core v2 business logic: AOI lifecycle', () => {
  it('marks bullish FVG pullback when price touches the AOI', () => {
    const history = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 103, 104),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.state).toBe('RETURNED');
    expect(fvg.lifecycle.touchCount).toBe(1);
    expect(fvg.lifecycle.firstTouchedAt).toBe(history[3]!.closeTime);
    expectFact(output, 'IMBALANCE_PULLBACK_LOCATION_CONFIRMED', fvg.zoneId);
  });

  it('confirms FVG reaction without emitting an entry trigger', () => {
    const history = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 103, 106),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.state).toBe('REACTION_CONFIRMED');
    expect(fvg.reactionConfirmed).toBe(true);
    expectFact(output, 'FVG_REACTION_CONFIRMED', fvg.zoneId);
    assertNoRuntimeTradingSemantics(output);
  });

  it('invalidates bullish AOI when price closes below the zone', () => {
    const history = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 97, 98),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.state).toBe('INVALIDATED');
    expect(fvg.invalidated).toBe(true);
    expectFact(output, 'FVG_INVALIDATED', fvg.zoneId);
  });

  it('invalidates bearish AOI when price closes above the zone', () => {
    const history = [
      ...buildBearishFvgSequence(),
      candle('15m', 3, 92, 103, 92, 102),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BEARISH');

    expect(fvg.state).toBe('INVALIDATED');
    expect(fvg.invalidated).toBe(true);
    expectFact(output, 'FVG_INVALIDATED', fvg.zoneId);
  });

  it('keeps invalidated FVG terminal after later candles return into the zone', () => {
    const history = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 97, 98),
      candle('15m', 4, 98, 106, 98, 104),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.state).toBe('INVALIDATED');
    expect(fvg.state).not.toBe('AVAILABLE');
    expect(fvg.state).not.toBe('RETURNED');
    expect(fvg.state).not.toBe('REACTION_CONFIRMED');
  });

  it('emits order-block pullback fact when price returns into the OB', () => {
    const origin = candle('15m', 0, 100, 102, 98, 99);
    const confirmation = candle('15m', 1, 99, 105, 99, 104);
    const touch = candle('15m', 2, 104, 105, 100, 101.5);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: touch.closeTime!,
      candlesByTimeframe: { '15m': [origin, confirmation, touch] },
      config: {
        orderBlock: {
          requireBos: true,
          requireConfirmedBos: false,
          requireDisplacement: true,
          boundsPolicy: 'WICK',
        },
      },
    });
    const ob = expectAoi(output, 'ORDER_BLOCK', 'BULLISH');

    expect(ob.state).toBe('RETURNED');
    expectFact(output, 'PULLBACK_INTO_ORDER_BLOCK', ob.zoneId);
  });
});
