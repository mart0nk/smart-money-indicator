import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index.js';
import {
  runSmartMoneyEngine,
  type CanonicalSmcCandle,
  type LiquidityReferenceLevel,
} from '../../src/index.js';

const FIFTEEN_MINUTES = 15 * 60_000;
const THREE_MINUTES = 3 * 60_000;
const START = 1_700_000_000_000;

function candle(
  timeframe: CanonicalSmcCandle['timeframe'],
  index: number,
  periodMs: number,
  open: number,
  high: number,
  low: number,
  close: number,
  closed = true,
): CanonicalSmcCandle {
  return {
    symbol: 'BTCUSDT',
    timeframe,
    openTime: START + index * periodMs,
    closeTime: START + (index + 1) * periodMs,
    open,
    high,
    low,
    close,
    volume: 100,
    closed,
  };
}

function fvgCandles(): CanonicalSmcCandle[] {
  return [
    candle('15m', 0, FIFTEEN_MINUTES, 98, 100, 97, 99),
    candle('15m', 1, FIFTEEN_MINUTES, 99, 106, 99, 105),
    candle('15m', 2, FIFTEEN_MINUTES, 105, 109, 104, 108),
    candle('15m', 3, FIFTEEN_MINUTES, 106, 108, 102, 107),
  ];
}

describe('SMI core v2 contract', () => {
  it('does not expose trading-runtime API concepts or emit runtime decision fields', () => {
    const forbiddenExports = [
      'createSmartMoneyEngine',
      'evaluateSmartMoneySnapshot',
      'SmartMoneyAlert',
      'Watch',
      'Watchable',
      'Trigger',
      'Risk',
      'Alert',
      'Execution',
      'CandidateScore',
      'SetupModelHint',
    ];
    const exportedNames = Object.keys(publicApi);
    expect(forbiddenExports.filter((name) => exportedNames.some((item) => item.includes(name)))).toEqual([]);

    const history = fvgCandles();
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });
    expect(JSON.stringify(output)).not.toMatch(/watch|trigger|alert|execution|model/i);
  });

  it('emits canonical FVG facts with temporal provenance and reaction evidence', () => {
    const history = fvgCandles();
    const cursorMs = history.at(-1)!.closeTime!;
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs,
      candlesByTimeframe: { '15m': history },
    });

    const fvg = output.aois.find((aoi) => aoi.aoiType === 'FVG');
    expect(output.contractVersion).toBe('smi-core-v2');
    expect(fvg).toBeDefined();
    expect(fvg).toMatchObject({
      aoiLow: 100,
      aoiHigh: 104,
      midpoint: 102,
      reactionConfirmed: true,
      state: 'REACTION_CONFIRMED',
      sourceTimeframe: '15m',
    });
    expect(fvg).toMatchObject({
      lifecycle: {
        isFresh: false,
        touchCount: 1,
        firstTouchedAt: history[3]!.closeTime,
        lastTouchedAt: history[3]!.closeTime,
      },
      quality: {
        policyVersion: 'fvg-quality-v1',
        verdict: 'STRONG',
        flags: expect.arrayContaining(['CREATED_WITH_DISPLACEMENT', 'CREATED_AFTER_BOS']),
      },
    });
    expect(output.facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining([
      'FVG_ZONE_AVAILABLE',
      'FVG_CREATED_WITH_DISPLACEMENT',
      'FVG_CREATED_AFTER_BOS',
      'PRICE_RETURNED_TO_FVG',
      'FVG_FIRST_RETURN_CONFIRMED',
      'FVG_REACTION_CONFIRMED',
    ]));
    for (const fact of output.facts.filter((item) => item.zoneId === fvg!.zoneId)) {
      expect(fact.sourceTime).toBeLessThanOrEqual(fact.availableFrom);
      expect(fact.availableFrom).toBeLessThanOrEqual(fact.observedAt);
      expect(fact.observedAt).toBeLessThanOrEqual(cursorMs);
      expect(fact.sourceId).toBeTruthy();
    }
  });

  it('has stable ids and deterministic output ordering across identical runs', () => {
    const history = fvgCandles();
    const input = {
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    } as const;

    expect(runSmartMoneyEngine(input)).toEqual(runSmartMoneyEngine(input));
  });

  it('rejects forming and future candles and does not use them in facts', () => {
    const valid = fvgCandles().slice(0, 2);
    const forming = candle('15m', 2, FIFTEEN_MINUTES, 105, 109, 104, 108, false);
    const future = candle('15m', 3, FIFTEEN_MINUTES, 106, 108, 102, 107);
    const cursorMs = valid.at(-1)!.closeTime!;
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs,
      candlesByTimeframe: { '15m': [...valid, forming, future] },
    });

    expect(output.aois).toHaveLength(0);
    expect(output.violations.map((item) => item.code)).toEqual(expect.arrayContaining([
      'FORMING_CANDLE_REJECTED',
      'FUTURE_CANDLE_REJECTED',
    ]));
    expect(output.violations.filter((item) => item.code.endsWith('CANDLE_REJECTED')).every((item) => item.severity === 'FATAL')).toBe(true);
  });

  it('produces 3m sweep evidence without creating 3m zones', () => {
    const sweep = candle('3m', 0, THREE_MINUTES, 100, 101, 98, 100.5);
    const reference: LiquidityReferenceLevel = {
      referenceId: 'swing-low:1',
      type: 'SWING_LOW',
      price: 99,
      side: 'SELL_SIDE_LIQUIDITY',
      sourceTimeframe: '15m',
      detectedAt: START - FIFTEEN_MINUTES,
    };
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: sweep.closeTime!,
      candlesByTimeframe: { '3m': [sweep] },
      referenceLevels: [reference],
    });

    expect(output.aois).toHaveLength(0);
    expect(output.sweeps).toHaveLength(1);
    expect(output.sweeps[0]!.side).toBe('SELL_SIDE_SWEEP');
    expect(output.facts.some((fact) => fact.factType === 'SELL_SIDE_SWEEP_DETECTED')).toBe(true);
  });

  it('does not create FVG without a real three-candle gap, even with a large middle candle', () => {
    const history = [
      candle('15m', 0, FIFTEEN_MINUTES, 98, 100, 97, 99),
      candle('15m', 1, FIFTEEN_MINUTES, 99, 130, 99, 128),
      candle('15m', 2, FIFTEEN_MINUTES, 128, 129, 99.5, 120),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
    });

    expect(output.aois.filter((aoi) => aoi.aoiType === 'FVG')).toHaveLength(0);
  });

  it('keeps a weak FVG as an AOI instead of dropping it by quality threshold', () => {
    const history = [
      candle('15m', 0, FIFTEEN_MINUTES, 100, 100, 99, 99.5),
      candle('15m', 1, FIFTEEN_MINUTES, 99.5, 101, 99, 100),
      candle('15m', 2, FIFTEEN_MINUTES, 100.01, 101.5, 100.005, 101),
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
    const fvg = output.aois.find((aoi) => aoi.aoiType === 'FVG');

    expect(fvg).toBeDefined();
    expect(fvg!.quality.verdict).toBe('WEAK');
    expect(fvg!.quality.flags).toContain('TOO_SMALL');
    expect(output.facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining(['FVG_TOO_SMALL', 'FVG_LOW_QUALITY']));
    expect(output.violations.map((item) => item.code)).toContain('FVG_TOO_SMALL');
  });

  it('marks FVG near a visible barrier as trap risk metadata only', () => {
    const history = fvgCandles().slice(0, 3);
    const reference: LiquidityReferenceLevel = {
      referenceId: 'resistance:1',
      type: 'SUPPORT_RESISTANCE',
      price: 104.1,
      side: 'BUY_SIDE_LIQUIDITY',
      sourceTimeframe: '15m',
      detectedAt: history[1]!.closeTime!,
    };
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      referenceLevels: [reference],
    });
    const fvg = output.aois.find((aoi) => aoi.aoiType === 'FVG');

    expect(fvg).toBeDefined();
    expect(fvg!.quality.verdict).toBe('TRAP_RISK');
    expect(fvg!.quality.nearbyBarriers[0]).toMatchObject({ referenceId: 'resistance:1', direction: 'ABOVE' });
    expect(output.facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining(['FVG_NEAR_MAJOR_BARRIER', 'FVG_TRAP_RISK']));
  });
});
