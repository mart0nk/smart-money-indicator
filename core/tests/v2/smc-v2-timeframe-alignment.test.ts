import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import { buildBullishFvgSequence, candle, referenceLevel } from './smc-v2-test-helpers.js';

describe('SMI core v2 timeframe and config matrix', () => {
  it('never creates source zones from forbidden lower timeframes', () => {
    const history = [
      candle('3m', 0, 98, 100, 97, 99),
      candle('3m', 1, 99, 110, 99, 109),
      candle('3m', 2, 109, 112, 105, 111),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '3m': history },
      config: { strictMode: false, sourceZoneTimeframes: ['3m' as any] },
    });

    expect(output.valid).toBe(false);
    expect(output.violations.map((item) => item.code)).toContain('FORBIDDEN_SOURCE_TIMEFRAME');
    expect(output.aois).toHaveLength(0);
  });

  it('keeps sweep timeframes separate from source-zone timeframes', () => {
    const sweepCandle = candle('3m', 0, 100, 101, 98, 101);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweepCandle.closeTime!,
      candlesByTimeframe: { '3m': [sweepCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'sell-side-ref',
        price: 100,
        side: 'SELL_SIDE_LIQUIDITY',
        detectedAt: sweepCandle.openTime,
      })],
      config: { sourceZoneTimeframes: ['15m'], sweepTimeframes: ['3m'] },
    });

    expect(output.aois).toHaveLength(0);
    expect(output.sweeps).toHaveLength(1);
    expect(output.sweeps[0]!.sourceTimeframe).toBe('3m');
  });

  it('allows empty source-zone timeframes without disabling sweep detection', () => {
    const sweepCandle = candle('3m', 0, 100, 101, 98, 101);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweepCandle.closeTime!,
      candlesByTimeframe: { '3m': [sweepCandle] },
      referenceLevels: [referenceLevel({
        referenceId: 'sell-side-ref',
        price: 100,
        side: 'SELL_SIDE_LIQUIDITY',
        detectedAt: sweepCandle.openTime,
      })],
      config: { sourceZoneTimeframes: [], sweepTimeframes: ['3m'] },
    });

    expect(output.valid).toBe(true);
    expect(output.aois).toHaveLength(0);
    expect(output.sweeps).toHaveLength(1);
  });

  it('allows empty sweep timeframes without disabling source-zone detection', () => {
    const history = buildBullishFvgSequence();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: { sourceZoneTimeframes: ['15m'], sweepTimeframes: [] },
    });

    expect(output.valid).toBe(true);
    expect(output.aois.some((aoi) => aoi.aoiType === 'FVG')).toBe(true);
    expect(output.sweeps).toHaveLength(0);
  });

  it('changes snapshot identity when config overrides change', () => {
    const history = buildBullishFvgSequence();
    const base = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const changed = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: { sourceZoneTimeframes: ['15m'], fvg: { minGapBps: 5 } },
    });

    expect(base.snapshotId).not.toBe(changed.snapshotId);
  });
});
