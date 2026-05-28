import { describe, expect, it } from 'vitest';
import { detectFvgZones, type PrimitiveCandle as Candle } from '../../src/index.js';

function candle(i: number, open: number, high: number, low: number, close: number, closed = true): Candle {
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

describe('FVG primitives', () => {
  it('detects bullish geometry gaps and preserves stable id mapping', () => {
    const zones = detectFvgZones([
      candle(0, 100, 105, 98, 104),
      candle(1, 104, 115, 103, 114),
      candle(2, 114, 120, 108, 119),
    ], 10);

    expect(zones).toHaveLength(1);
    expect(zones[0]!.direction).toBe('BULLISH');
    expect(zones[0]!.id).toBe(zones[0]!.zoneId);
    expect(zones[0]!.zoneId).toBeDefined();
    expect(zones[0]!.gapSizeAtr).toBeCloseTo(0.3);
  });

  it('keeps geometry-valid FVG when impulse candle is bearish by default', () => {
    const zones = detectFvgZones([
      candle(0, 100, 105, 98, 104),
      candle(1, 115, 116, 103, 106),
      candle(2, 106, 120, 108, 119),
    ], 10);

    expect(zones).toHaveLength(1);
  });

  it('can still apply an explicit candle-color impulse filter', () => {
    const zones = detectFvgZones([
      candle(0, 100, 105, 98, 104),
      candle(1, 115, 116, 103, 106),
      candle(2, 106, 120, 108, 119),
    ], 10, { impulseRule: 'CANDLE_COLOR' });

    expect(zones).toHaveLength(0);
  });
});
