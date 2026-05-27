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
    expect(JSON.stringify(output)).not.toMatch(/watch|trigger|risk|alert|execution|model/i);
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
    expect(output.facts.map((fact) => fact.factType)).toEqual(expect.arrayContaining([
      'FVG_ZONE_AVAILABLE',
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
});
