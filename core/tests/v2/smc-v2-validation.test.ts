import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine, type CanonicalSmcCandle } from '../../src/index.js';
import { buildBullishFvgSequence, candle } from './smc-v2-test-helpers.js';

function expectStrictSafeEmpty(candles: CanonicalSmcCandle[]): void {
  const output = runSmartMoneyEngine({
    symbol: 'BTCUSDT',
    cursorMs: candles.at(-1)?.closeTime ?? 1_700_000_900_000,
    candlesByTimeframe: { '15m': candles },
  });

  expect(output.valid).toBe(false);
  expect(output.violations.some((item) => item.severity === 'FATAL')).toBe(true);
  expect(output.aois).toHaveLength(0);
  expect(output.sweeps).toHaveLength(0);
  expect(output.facts).toHaveLength(0);
  expect(output.events).toHaveLength(0);
}

describe('SMI core v2 validation', () => {
  it.each([
    ['zero open', { open: 0 }],
    ['negative high', { high: -1 }],
    ['NaN low', { low: Number.NaN }],
    ['Infinity close', { close: Infinity }],
    ['high below close', { high: 98 }],
    ['low above open', { low: 101 }],
    ['negative volume', { volume: -1 }],
    ['missing closeTime', { closeTime: undefined }],
    ['wrong 15m duration', { closeTime: candle('15m', 0, 100, 101, 99, 100).openTime + 5 * 60_000 }],
  ])('returns safe-empty output for malformed candles in strict mode: %s', (_name, override) => {
    const malformed = { ...candle('15m', 0, 100, 101, 99, 100), ...override } as unknown as CanonicalSmcCandle;
    if ('closeTime' in override && override.closeTime === undefined) {
      delete malformed.closeTime;
    }
    expectStrictSafeEmpty([
      malformed,
      candle('15m', 1, 100, 102, 99, 101),
    ]);
  });

  it('rejects forming and future candles as fatal strict-mode input', () => {
    const valid = candle('15m', 0, 100, 101, 99, 100);
    const forming = candle('15m', 1, 100, 102, 99, 101, { closed: false });
    const future = candle('15m', 2, 101, 103, 100, 102);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: valid.closeTime!,
      candlesByTimeframe: { '15m': [valid, forming, future] },
    });

    expect(output.valid).toBe(false);
    expect(output.violations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'FORMING_CANDLE_REJECTED',
      'FUTURE_CANDLE_REJECTED',
    ]));
    expect(output.aois).toHaveLength(0);
    expect(output.facts).toHaveLength(0);
  });

  it('allows non-strict partial output from valid normalized candles only', () => {
    const valid = buildBullishFvgSequence();
    const forming = candle('15m', 3, 111, 112, 100, 101, { closed: false });
    const future = candle('15m', 4, 101, 102, 99, 100);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: valid.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': [...valid, forming, future] },
      config: { strictMode: false },
    });

    expect(output.valid).toBe(false);
    expect(output.violations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'FORMING_CANDLE_REJECTED',
      'FUTURE_CANDLE_REJECTED',
    ]));
    expect(output.aois.some((aoi) => aoi.aoiType === 'FVG')).toBe(true);
    expect(output.facts.length).toBeGreaterThan(0);
  });

  it('sorts unordered candles and ignores duplicates deterministically', () => {
    const history = buildBullishFvgSequence();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': [history[2]!, history[0]!, history[1]!, history[1]!] },
    });

    expect(output.valid).toBe(true);
    expect(output.violations.map((item) => item.code)).toContain('DUPLICATE_CANDLE_IGNORED');
    expect(output.aois.some((aoi) => aoi.aoiType === 'FVG')).toBe(true);
  });

  it('rejects invalid reference levels by not letting them create sweep evidence', () => {
    const sweep = candle('3m', 0, 100, 101, 98, 100.5);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweep.closeTime!,
      candlesByTimeframe: { '3m': [sweep] },
      referenceLevels: [
        {
          referenceId: 'bad-ref',
          type: 'SWING_LOW',
          price: Number.NaN,
          side: 'SELL_SIDE_LIQUIDITY',
          sourceTimeframe: '15m',
          detectedAt: sweep.openTime,
        },
      ],
    });

    expect(output.sweeps).toHaveLength(0);
    expect(output.facts.some((fact) => fact.factType.endsWith('SWEEP_DETECTED'))).toBe(false);
  });

  it('returns safe-empty output for invalid config in strict mode', () => {
    const history = buildBullishFvgSequence();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: { sweeps: { validForCandles: 0 } },
    });

    expect(output.valid).toBe(false);
    expect(output.violations.map((item) => item.code)).toContain('INVALID_CONFIG');
    expect(output.aois).toHaveLength(0);
    expect(output.facts).toHaveLength(0);
  });
});
