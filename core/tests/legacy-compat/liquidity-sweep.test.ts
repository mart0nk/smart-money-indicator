import { describe, expect, it } from 'vitest';
import {
  detectLegacyLiquiditySweep,
  type LegacyCandle,
  type SwingPoint,
} from '../../src/legacy/index.js';

function candle(overrides: Partial<LegacyCandle>): LegacyCandle {
  return {
    symbol: 'BTCUSDT',
    timeframe: '5m',
    openTime: new Date(1700000000000),
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume: 100,
    closed: true,
    ...overrides,
  };
}

function swing(overrides: Partial<SwingPoint>): SwingPoint {
  return {
    id: 'sw',
    type: 'HIGH',
    price: 103,
    candleIndex: 5,
    candleOpenTime: 1699999000000,
    leftBars: 2,
    rightBars: 2,
    confirmationStatus: 'CONFIRMED',
    confirmedAtCandleIndex: 8,
    confirmedAtOpenTime: 1699999900000,
    strength: 'MEDIUM',
    source: 'CLOSED_CANDLES_ONLY',
    ...overrides,
  };
}

describe('legacy liquidity sweep compatibility', () => {
  it('detects wick beyond plus close back as sweep', () => {
    const result = detectLegacyLiquiditySweep(candle({ high: 106, close: 101 }), swing({ type: 'HIGH', price: 103 }), 10, 10);
    expect(result?.direction).toBe('BUY_SIDE_SWEEP');
    expect(result?.closeBackBeyondLevel).toBe(true);
  });

  it('rejects BOS-style close beyond as sweep', () => {
    const result = detectLegacyLiquiditySweep(candle({ high: 110, close: 108 }), swing({ type: 'HIGH', price: 103 }), 10, 10);
    expect(result).toBeNull();
  });

  it('rejects unconfirmed swing', () => {
    const candidate = swing({ confirmationStatus: 'CANDIDATE' });
    delete candidate.confirmedAtCandleIndex;
    delete candidate.confirmedAtOpenTime;
    const result = detectLegacyLiquiditySweep(candle({ high: 106, close: 101 }), candidate, 10, 10);
    expect(result).toBeNull();
  });
});
