import { describe, expect, it } from 'vitest';
import {
  createSmartMoneyRollingEngine,
  runSmartMoneyEngine,
  type CanonicalSmcCandle,
} from '../../src/index.js';

const PERIOD = 15 * 60_000;
const START = 1_700_000_000_000;

function candle(index: number, open: number, high: number, low: number, close: number, closed = true): CanonicalSmcCandle {
  return {
    symbol: 'ETHUSDT',
    timeframe: '15m',
    openTime: START + index * PERIOD,
    closeTime: START + (index + 1) * PERIOD,
    open,
    high,
    low,
    close,
    volume: 10,
    closed,
  };
}

const history = [
  candle(0, 98, 100, 97, 99),
  candle(1, 99, 106, 99, 105),
  candle(2, 105, 109, 104, 108),
  candle(3, 106, 108, 102, 107),
];

describe('SMI rolling closed-candle buffer', () => {
  it('detects a cross-boundary FVG and matches stateless semantics', () => {
    const engine = createSmartMoneyRollingEngine();
    const first = engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[1]!.closeTime!,
      closedCandlesByTimeframe: { '15m': history.slice(0, 2) },
    });
    expect(first.aois).toHaveLength(0);

    engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[2]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [history[2]!] },
    });
    const rolling = engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[3]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [history[3]!] },
    });
    const stateless = runSmartMoneyEngine({
      symbol: 'ETHUSDT',
      cursorMs: history[3]!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });

    expect(rolling.aois).toEqual(stateless.aois);
    expect(rolling.facts).toEqual(stateless.facts);
    expect(rolling.events).toEqual(stateless.events);
  });

  it('dedupes updates, rejects invalid candles, and exposes diagnostics', () => {
    const engine = createSmartMoneyRollingEngine();
    engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[0]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [history[0]!, history[0]!] },
    });
    const future = history[2]!;
    const forming = { ...history[1]!, closed: false };
    const output = engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[1]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [forming, future] },
    });
    const timeframe = engine.getBufferState().symbols[0]!.timeframes[0]!;

    expect(output.violations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'FORMING_CANDLE_REJECTED',
      'FUTURE_CANDLE_REJECTED',
    ]));
    expect(timeframe).toMatchObject({
      candleCount: 1,
      duplicateCandles: 1,
      rejectedFutureCandles: 1,
      rejectedFormingCandles: 1,
    });
  });

  it('resets only the requested symbol/timeframe buffer', () => {
    const engine = createSmartMoneyRollingEngine();
    engine.update({
      symbol: 'ETHUSDT',
      cursorMs: history[0]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [history[0]!] },
    });
    engine.update({
      symbol: 'BTCUSDT',
      cursorMs: history[0]!.closeTime!,
      closedCandlesByTimeframe: { '15m': [{ ...history[0]!, symbol: 'BTCUSDT' }] },
    });

    engine.reset({ type: 'SYMBOL_TIMEFRAME', symbol: 'ETHUSDT', timeframe: '15m' });

    expect(engine.getBufferState().symbols.map((item) => item.symbol)).toEqual(['BTCUSDT']);
  });
});
