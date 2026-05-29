import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  assertOutputOrdering,
  assertStableZoneIds,
  assertTerminalInvalidation,
  buildReplayCursors,
  buildBullishFvgSequence,
  candle,
  createReplayState,
  replayRolling,
  replayStateless,
} from './smc-v2-test-helpers.js';

describe('SMI core v2 walk-forward integrity', () => {
  it('enforces point-in-time, deterministic, ordered output through cursor replay', () => {
    const candles = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 103, 104),
      candle('15m', 4, 104, 107, 103, 106),
      candle('15m', 5, 106, 107, 97, 98),
      candle('15m', 6, 98, 106, 98, 104),
    ];
    const cursors = buildReplayCursors(candles);
    const state = createReplayState();

    for (let index = 0; index < cursors.length; index += 1) {
      const cursorMs = cursors[index]!;
      const input = {
        symbol: 'BTCUSDT',
        cursorMs,
        candlesByTimeframe: { '15m': candles.slice(0, index + 1) },
      } as const;
      const output = runSmartMoneyEngine(input);

      expect(runSmartMoneyEngine(input)).toEqual(output);
      assertNoFutureEvidence(output, cursorMs);
      assertNoRuntimeTradingSemantics(output);
      assertOutputOrdering(output);
      assertStableZoneIds(state, output);
      assertTerminalInvalidation(state, output);
    }
  });

  it('does not let forming candles contribute to walk-forward evidence', () => {
    const valid = buildBullishFvgSequence().slice(0, 2);
    const formingWouldCompleteFvg = candle('15m', 2, 109, 112, 105, 111, { closed: false });
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: valid.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': [...valid, formingWouldCompleteFvg] },
    });

    expect(output.valid).toBe(false);
    expect(output.aois).toHaveLength(0);
    expect(output.facts).toHaveLength(0);
    expect(output.violations.map((item) => item.code)).toContain('FORMING_CANDLE_REJECTED');
  });

  it('matches rolling engine and stateless replay at every synthetic cursor', () => {
    const candles = [
      ...buildBullishFvgSequence(),
      candle('15m', 3, 108, 109, 103, 104),
      candle('15m', 4, 104, 107, 103, 106),
    ];
    const cursors = buildReplayCursors(candles);
    const stateless = replayStateless({
      symbol: 'BTCUSDT',
      candlesByTimeframe: { '15m': candles },
      cursors,
    });
    const rolling = replayRolling({
      symbol: 'BTCUSDT',
      candlesByTimeframe: { '15m': candles },
      cursors,
    });

    for (let index = 0; index < cursors.length; index += 1) {
      expect(rolling[index]!.aois).toEqual(stateless[index]!.aois);
      expect(rolling[index]!.sweeps).toEqual(stateless[index]!.sweeps);
      expect(rolling[index]!.facts).toEqual(stateless[index]!.facts);
      expect(rolling[index]!.events).toEqual(stateless[index]!.events);
    }
  });
});
