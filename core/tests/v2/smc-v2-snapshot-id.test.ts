import { describe, expect, it } from 'vitest';
import { buildZoneId, normalizeIdNumber, runSmartMoneyEngine } from '../../src/index.js';
import { buildBullishFvgSequence, referenceLevel } from './smc-v2-test-helpers.js';

describe('SMI core v2 snapshot identity', () => {
  it('keeps identical canonical payloads stable', () => {
    const history = buildBullishFvgSequence();
    const input = {
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    } as const;

    expect(runSmartMoneyEngine(input).snapshotId).toBe(runSmartMoneyEngine(input).snapshotId);
    expect(runSmartMoneyEngine(input)).toEqual(runSmartMoneyEngine(input));
  });

  it('changes when OHLC, config, or reference payload changes', () => {
    const history = buildBullishFvgSequence();
    const base = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const changedOhlc = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history.map((item, index) => index === 1 ? { ...item, high: item.high + 0.25 } : item) },
    });
    const changedConfig = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: { fvg: { minGapBps: 25 } },
    });
    const changedReference = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      referenceLevels: [referenceLevel({ referenceId: 'same', price: 101 })],
    });
    const changedReferencePrice = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      referenceLevels: [referenceLevel({ referenceId: 'same', price: 102 })],
    });

    expect(base.snapshotId).not.toBe(changedOhlc.snapshotId);
    expect(base.snapshotId).not.toBe(changedConfig.snapshotId);
    expect(changedReference.snapshotId).not.toBe(changedReferencePrice.snapshotId);
  });

  it('encodes NaN and Infinity distinctly in snapshot payloads', () => {
    const history = buildBullishFvgSequence();
    const nan = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history.map((item, index) => index === 0 ? { ...item, high: Number.NaN } : item) },
    });
    const inf = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history.map((item, index) => index === 0 ? { ...item, high: Infinity } : item) },
    });

    expect(nan.valid).toBe(false);
    expect(inf.valid).toBe(false);
    expect(nan.snapshotId).not.toBe(inf.snapshotId);
  });

  it('normalizes finite ID number components and rejects non-finite ID numbers', () => {
    const a = buildZoneId({
      symbol: 'BTCUSDT',
      sourceTimeframe: '15m',
      aoiType: 'FVG',
      side: 'BULLISH',
      sourceCandleTime: 1,
      aoiLow: 1.2,
      aoiHigh: 2.4,
    });
    const b = buildZoneId({
      symbol: 'BTCUSDT',
      sourceTimeframe: '15m',
      aoiType: 'FVG',
      side: 'BULLISH',
      sourceCandleTime: 1,
      aoiLow: 1.2000000000000002,
      aoiHigh: 2.4000000000000004,
    });

    expect(a).toBe(b);
    expect(normalizeIdNumber(1.2000000000000002)).toBe('1.2');
    expect(() => normalizeIdNumber(Number.NaN)).toThrow(/non-finite number/);
    expect(() => normalizeIdNumber(Infinity)).toThrow(/non-finite number/);
  });
});
