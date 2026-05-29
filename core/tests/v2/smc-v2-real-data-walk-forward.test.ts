import { describe, expect, it } from 'vitest';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  assertOutputOrdering,
  assertStableZoneIds,
  assertTerminalInvalidation,
  buildReplayCursors,
  createReplayState,
  loadRealFixture,
  replayRolling,
  replayStateless,
} from './smc-v2-test-helpers.js';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'] as const;

describe('SMI core v2 real-data walk-forward replay', () => {
  it.each(SYMBOLS)('replays %s real candles point-in-time and deterministically', (symbol) => {
    const candles15m = loadRealFixture(`${symbol}-15m-sample.json`);
    const candles3m = loadRealFixture(`${symbol}-3m-sample.json`);
    const cursors = buildReplayCursors(candles15m, 20);
    const outputs = replayStateless({
      symbol,
      candlesByTimeframe: { '15m': candles15m, '3m': candles3m },
      cursors,
    });
    const replayState = createReplayState();

    for (const output of outputs) {
      assertNoFutureEvidence(output);
      assertNoRuntimeTradingSemantics(output);
      assertOutputOrdering(output);
      assertStableZoneIds(replayState, output);
      assertTerminalInvalidation(replayState, output);
    }

    expect(outputs.at(-1)!.aois.length).toBeGreaterThan(0);
  });

  it.each(['BTCUSDT', 'ETHUSDT'] as const)('matches rolling and stateless replay on %s real candles', (symbol) => {
    const candles15m = loadRealFixture(`${symbol}-15m-sample.json`);
    const candles3m = loadRealFixture(`${symbol}-3m-sample.json`);
    const cursors = buildReplayCursors(candles15m, 20);
    const input = {
      symbol,
      candlesByTimeframe: { '15m': candles15m, '3m': candles3m },
      cursors,
    };
    const stateless = replayStateless(input);
    const rolling = replayRolling(input);

    for (let index = 0; index < cursors.length; index += 1) {
      expect(rolling[index]!.aois).toEqual(stateless[index]!.aois);
      expect(rolling[index]!.sweeps).toEqual(stateless[index]!.sweeps);
      expect(rolling[index]!.facts).toEqual(stateless[index]!.facts);
      expect(rolling[index]!.events).toEqual(stateless[index]!.events);
    }
  });
});
