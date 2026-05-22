import { describe, expect, it } from 'vitest';
import {
  detectLegacyOrderBlocks,
  type LegacyCandle,
  type SwingPoint,
} from '../../src/legacy/index.js';

function candle(i: number, open: number, high: number, low: number, close: number): LegacyCandle {
  return {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    openTime: new Date(1700000000000 + i * 60_000),
    open,
    high,
    low,
    close,
    volume: 100,
    closed: true,
  };
}

function swing(): SwingPoint {
  return {
    id: 'sw-high',
    type: 'HIGH',
    price: 110,
    candleIndex: 0,
    candleOpenTime: 1700000000000,
    leftBars: 2,
    rightBars: 2,
    confirmationStatus: 'CONFIRMED',
    confirmedAtCandleIndex: 2,
    confirmedAtOpenTime: 1700000120000,
    strength: 'MEDIUM',
    source: 'CLOSED_CANDLES_ONLY',
  };
}

describe('legacy order block compatibility', () => {
  it('preserves OB as last opposite candle before confirmed BOS', () => {
    const obs = detectLegacyOrderBlocks([
      candle(0, 108, 110, 106, 109),
      candle(1, 109, 111, 105, 106),
      candle(2, 106, 108, 104, 107),
      candle(3, 107, 114, 106, 108),
      candle(4, 108, 118, 107, 115),
    ], [swing()], 5);

    expect(obs).toHaveLength(1);
    expect(obs[0]!.direction).toBe('BULLISH');
    expect(obs[0]!.candleIndex).toBe(1);
    expect(obs[0]!.id).toBe(obs[0]!.zoneId);
    expect(obs[0]!.legacyIdWasRandom).toBe(false);
  });
});
