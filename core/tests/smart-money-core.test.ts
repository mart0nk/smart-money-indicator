import { describe, expect, it } from 'vitest';
import {
  createSmartMoneyEngine,
  evaluateSmartMoneySnapshot,
  type SmartMoneyCandle,
} from '../src/index.js';

function candle(openTime: number, open: number, high: number, low: number, close: number, closed = true): SmartMoneyCandle {
  return {
    symbol: 'ETHUSDT',
    timeframe: '15m',
    openTime,
    closeTime: openTime + 15 * 60_000,
    open,
    high,
    low,
    close,
    volume: 100,
    closed,
  };
}

describe('smart money core contract', () => {
  it('produces deterministic stable zone ids in stateless rebuild mode', () => {
    const candles = [
      candle(1, 100, 101, 99, 100),
      candle(2, 100, 106, 100, 105),
      candle(3, 107, 110, 107, 109),
      candle(4, 109, 111, 103, 108),
    ];

    const first = evaluateSmartMoneySnapshot({
      symbol: 'ETHUSDT',
      cursorMs: 2_000_000,
      candlesByTimeframe: { '15m': candles },
      mode: 'STATELESS_REBUILD',
    });
    const second = evaluateSmartMoneySnapshot({
      symbol: 'ETHUSDT',
      cursorMs: 2_000_000,
      candlesByTimeframe: { '15m': candles },
      mode: 'STATELESS_REBUILD',
    });

    expect(first.snapshot.zones.fvgs[0]?.zoneId).toBe(second.snapshot.zones.fvgs[0]?.zoneId);
    expect(first.snapshot.zones.fvgs[0]?.zoneId).toContain('ETHUSDT:15m:FVG:BULLISH');
    expect(first.diagnostics.violations.unstableZoneIds).toBe(0);
  });

  it('ignores forming candles and reports safety proof', () => {
    const result = evaluateSmartMoneySnapshot({
      symbol: 'ETHUSDT',
      cursorMs: 2_000_000,
      candlesByTimeframe: {
        '15m': [
          candle(1, 100, 101, 99, 100),
          candle(2, 100, 106, 100, 105, false),
        ],
      },
    });

    expect(result.snapshot.proof.closedCandlesOnly).toBe(false);
    expect(result.diagnostics.violations.formingCandles).toBe(1);
    expect(result.snapshot.zones.fvgs).toHaveLength(0);
  });

  it('preserves explicit state through incremental evaluation', () => {
    const engine = createSmartMoneyEngine();
    const first = engine.evaluate({
      symbol: 'ETHUSDT',
      cursorMs: 2_000_000,
      candlesByTimeframe: {
        '15m': [
          candle(1, 100, 101, 99, 100),
          candle(2, 100, 106, 100, 105),
          candle(3, 107, 110, 107, 109),
        ],
      },
    });
    const zoneId = first.snapshot.zones.fvgs[0]?.zoneId;

    const next = engine.evaluateIncremental({
      symbol: 'ETHUSDT',
      cursorMs: 2_100_000,
      previousState: first.nextState,
      newlyClosedCandlesByTimeframe: {
        '15m': [candle(4, 109, 111, 104, 108)],
      },
    });

    expect(zoneId).toBeDefined();
    expect(Object.keys(next.nextState.zoneRegistry.zonesById)).toContain(zoneId);
    expect(next.nextState.lastEvaluatedCursorMs).toBe(2_100_000);
  });

  it('does not expose trigger, risk, execution or agent-decision fields', () => {
    const result = evaluateSmartMoneySnapshot({
      symbol: 'ETHUSDT',
      cursorMs: 2_000_000,
      candlesByTimeframe: { '15m': [candle(1, 100, 101, 99, 100)] },
    });
    const text = JSON.stringify(result.snapshot);

    expect(text).not.toContain('triggerConfirmed');
    expect(text).not.toContain('AgentDecision');
    expect(text).not.toContain('FinalEntryGuard');
    expect(text).not.toContain('execution');
    expect(text).not.toContain('riskSizing');
  });
});
