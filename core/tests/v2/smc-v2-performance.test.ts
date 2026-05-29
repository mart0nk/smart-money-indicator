import { describe, expect, it } from 'vitest';
import { buildReplayCursors, loadRealFixture, replayRolling, replayStateless } from './smc-v2-test-helpers.js';

describe('SMI core v2 performance smoke tests', () => {
  it('replays a bounded real-data window without unbounded output growth', () => {
    const symbol = 'BTCUSDT';
    const candles15m = loadRealFixture(`${symbol}-15m-sample.json`).slice(0, 140);
    const candles3m = loadRealFixture(`${symbol}-3m-sample.json`).filter((candle) => candle.closeTime! <= candles15m.at(-1)!.closeTime!);
    const cursors = buildReplayCursors(candles15m, 20);
    const startedAt = Date.now();
    const stateless = replayStateless({
      symbol,
      candlesByTimeframe: { '15m': candles15m, '3m': candles3m },
      cursors,
    });
    const rolling = replayRolling({
      symbol,
      candlesByTimeframe: { '15m': candles15m, '3m': candles3m },
      cursors,
    });
    const elapsedMs = Date.now() - startedAt;
    const final = stateless.at(-1)!;

    expect(elapsedMs).toBeLessThan(10_000);
    expect(final.aois.length).toBeLessThan(500);
    expect(final.facts.length).toBeLessThan(2_000);
    expect(rolling.at(-1)!.aois).toEqual(final.aois);
  });
});
