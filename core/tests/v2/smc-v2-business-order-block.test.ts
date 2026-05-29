import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import { assertNoFutureEvidence, candle, expectAoi } from './smc-v2-test-helpers.js';

const OB_CONFIG = {
  orderBlock: {
    requireBos: true,
    requireConfirmedBos: false,
    requireDisplacement: true,
    boundsPolicy: 'WICK' as const,
  },
};

describe('SMI core v2 business logic: order blocks', () => {
  it('creates bullish OB from the last bearish origin candle before bullish break', () => {
    const firstBearish = candle('15m', 0, 104, 106, 100, 101);
    const origin = candle('15m', 1, 101, 103, 98, 99);
    const confirmation = candle('15m', 2, 99, 106, 99, 105);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: confirmation.closeTime!,
      candlesByTimeframe: { '15m': [firstBearish, origin, confirmation] },
      config: OB_CONFIG,
    });
    const ob = expectAoi(output, 'ORDER_BLOCK', 'BULLISH');

    expect(ob).toMatchObject({
      aoiType: 'ORDER_BLOCK',
      side: 'BULLISH',
      aoiLow: origin.low,
      aoiHigh: origin.high,
      sourceTime: origin.openTime,
      availableFrom: confirmation.closeTime,
      sourceTimeframe: '15m',
    });
    expect(output.facts.map((fact) => fact.factType)).toContain('ORDER_BLOCK_AVAILABLE');
    assertNoFutureEvidence(output);
  });

  it('creates bearish OB from the last bullish origin candle before bearish break', () => {
    const firstBullish = candle('15m', 0, 96, 100, 95, 99);
    const origin = candle('15m', 1, 99, 103, 98, 102);
    const confirmation = candle('15m', 2, 102, 102, 95, 96);
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: confirmation.closeTime!,
      candlesByTimeframe: { '15m': [firstBullish, origin, confirmation] },
      config: OB_CONFIG,
    });
    const ob = expectAoi(output, 'ORDER_BLOCK', 'BEARISH');

    expect(ob).toMatchObject({
      aoiType: 'ORDER_BLOCK',
      side: 'BEARISH',
      aoiLow: origin.low,
      aoiHigh: origin.high,
      sourceTime: origin.openTime,
      availableFrom: confirmation.closeTime,
    });
  });

  it('allows wick BOS when requireBos is true and requireConfirmedBos is false', () => {
    const history = [
      candle('15m', 0, 100, 101, 98, 99),
      candle('15m', 1, 99, 102, 98.5, 100.5),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: OB_CONFIG,
    });

    expect(output.aois.some((aoi) => aoi.aoiType === 'ORDER_BLOCK' && aoi.side === 'BULLISH')).toBe(true);
  });

  it('requires close confirmation when requireConfirmedBos is true, even if requireBos is false', () => {
    const history = [
      candle('15m', 0, 100, 101, 98, 99),
      candle('15m', 1, 99, 102, 98.5, 100.5),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: {
        orderBlock: {
          requireBos: false,
          requireConfirmedBos: true,
          requireDisplacement: true,
          boundsPolicy: 'WICK',
        },
      },
    });

    expect(output.aois.some((aoi) => aoi.aoiType === 'ORDER_BLOCK')).toBe(false);
  });

  it('rejects OB without directional displacement when requireDisplacement is true', () => {
    const history = [
      candle('15m', 0, 100, 101, 98, 99),
      candle('15m', 1, 101, 102, 98.5, 100.5),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: OB_CONFIG,
    });

    expect(output.aois.some((aoi) => aoi.aoiType === 'ORDER_BLOCK')).toBe(false);
  });

  it('does not disable OB detection when BOS, confirmed BOS, and displacement flags are all false', () => {
    const history = [
      candle('15m', 0, 100, 101, 98, 99),
      candle('15m', 1, 99, 100.5, 98.5, 100),
    ];
    const output = runSmartMoneyEngine({
      symbol: 'BTCUSDT',
      cursorMs: history.at(-1)!.closeTime!,
      candlesByTimeframe: { '15m': history },
      config: {
        orderBlock: {
          requireBos: false,
          requireConfirmedBos: false,
          requireDisplacement: false,
          boundsPolicy: 'WICK',
        },
      },
    });

    expect(output.aois.some((aoi) => aoi.aoiType === 'ORDER_BLOCK')).toBe(true);
  });
});
