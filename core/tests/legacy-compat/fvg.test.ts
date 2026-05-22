import { describe, expect, it } from 'vitest';
import { detectLegacyFvgZones, type LegacyCandle } from '../../src/legacy/index.js';

function candle(i: number, open: number, high: number, low: number, close: number, closed = true): LegacyCandle {
  return {
    symbol: 'BTCUSDT',
    timeframe: '15m',
    openTime: new Date(1700000000000 + i * 60_000),
    open,
    high,
    low,
    close,
    volume: 100,
    closed,
  };
}

describe('legacy FVG compatibility', () => {
  it('preserves bullish impulse candle color rule and stable id mapping', () => {
    const zones = detectLegacyFvgZones([
      candle(0, 100, 105, 98, 104),
      candle(1, 104, 115, 103, 114),
      candle(2, 114, 120, 108, 119),
    ], 10);

    expect(zones).toHaveLength(1);
    expect(zones[0]!.direction).toBe('BULLISH');
    expect(zones[0]!.id).toBe(zones[0]!.zoneId);
    expect(zones[0]!.legacyIdWasRandom).toBe(false);
    expect(zones[0]!.gapSizeAtr).toBeCloseTo(0.3);
  });

  it('rejects bullish FVG when impulse candle is bearish', () => {
    const zones = detectLegacyFvgZones([
      candle(0, 100, 105, 98, 104),
      candle(1, 115, 116, 103, 106),
      candle(2, 106, 120, 108, 119),
    ], 10);

    expect(zones).toHaveLength(0);
  });
});
