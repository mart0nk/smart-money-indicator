import { describe, it } from 'vitest';
import {
  assertSummaryMatchesSnapshot,
  buildReplayCursors,
  loadRealFixture,
  replayStateless,
  summarizeReplay,
} from './smc-v2-test-helpers.js';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'] as const;

describe('SMI core v2 real-data regression summaries', () => {
  it.each(SYMBOLS)('matches committed summary snapshot for %s', (symbol) => {
    const candles15m = loadRealFixture(`${symbol}-15m-sample.json`);
    const candles3m = loadRealFixture(`${symbol}-3m-sample.json`);
    const outputs = replayStateless({
      symbol,
      candlesByTimeframe: { '15m': candles15m, '3m': candles3m },
      cursors: buildReplayCursors(candles15m),
    });
    const summary = summarizeReplay({
      symbol,
      timeframes: ['15m', '3m'],
      outputs,
    });

    assertSummaryMatchesSnapshot(summary, `${symbol.toLowerCase()}-summary.snapshot.json`);
  });
});
