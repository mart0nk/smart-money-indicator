import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  buildBearishFvgSequence,
  buildBullishFvgSequence,
  candle,
  expectAoi,
} from './smc-v2-test-helpers.js';

describe('SMI core v2 business logic: FVG', () => {
  it('creates bullish FVG with exact bounds, midpoint, and provenance', () => {
    const history = buildBullishFvgSequence();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg).toMatchObject({
      aoiType: 'FVG',
      side: 'BULLISH',
      aoiLow: 100,
      aoiHigh: 105,
      midpoint: 102.5,
      sourceTimeframe: '15m',
      sourceTime: history[2]!.openTime,
      availableFrom: history[2]!.closeTime,
      state: 'AVAILABLE',
    });
    expect(fvg.zoneId).toContain('BTCUSDT:15m:FVG:BULLISH');
    expect(fvg.sourceCandleTimes).toEqual([history[0]!.openTime, history[1]!.openTime, history[2]!.openTime]);
    expect(output.facts.map((fact) => fact.factType)).toContain('FVG_ZONE_AVAILABLE');
    assertNoFutureEvidence(output);
    assertNoRuntimeTradingSemantics(output);
  });

  it('creates bearish FVG with exact bounds, midpoint, and provenance', () => {
    const history = buildBearishFvgSequence();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    const fvg = expectAoi(output, 'FVG', 'BEARISH');

    expect(fvg).toMatchObject({
      aoiType: 'FVG',
      side: 'BEARISH',
      aoiLow: 95,
      aoiHigh: 100,
      midpoint: 97.5,
      sourceTimeframe: '15m',
      sourceTime: history[2]!.openTime,
      availableFrom: history[2]!.closeTime,
      state: 'AVAILABLE',
    });
    expect(fvg.zoneId).toContain('BTCUSDT:15m:FVG:BEARISH');
    assertNoFutureEvidence(output);
  });

  it('marks weak FVGs as low quality instead of treating them as strong', () => {
    const history = [
      candle('15m', 0, 100, 100, 99, 99.5),
      candle('15m', 1, 99.5, 101, 99, 100),
      candle('15m', 2, 100.01, 101.5, 100.005, 101),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: {
        fvg: {
          minGapBps: 10,
          quality: {
            atrPeriod: 3,
            minGapBpsForAcceptable: 10,
            displacement: {
              minBodyToRangeRatio: 0.6,
              minRangeAtrMultiple: 1.2,
              bullishMinCloseLocationPct: 0.7,
              bearishMaxCloseLocationPct: 0.3,
            },
            structure: { maxCandlesAfterBos: 3 },
            barriers: { maxDistancePct: 0.25 },
          },
        },
      },
    });
    const fvg = expectAoi(output, 'FVG', 'BULLISH');

    expect(fvg.quality.verdict).toBe('WEAK');
    expect(fvg.quality.flags).toContain('TOO_SMALL');
    expect(fvg.quality.verdict).not.toBe('STRONG');
    expect(output.facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining([
      'FVG_TOO_SMALL',
      'FVG_LOW_QUALITY',
    ]));
    expect(output.violations.map((item) => item.code)).toContain('FVG_TOO_SMALL');
  });

  it('does not create FVG without a true three-candle gap', () => {
    const history = [
      candle('15m', 0, 98, 100, 97, 99),
      candle('15m', 1, 99, 130, 99, 128),
      candle('15m', 2, 128, 129, 99.5, 120),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });

    expect(output.aois.some((aoi) => aoi.aoiType === 'FVG')).toBe(false);
  });
});
