import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createSmartMoneyApiRouter, type SmartMoneyCandleProvider } from '../src/index.js';
import type { SmartMoneyCandle } from '@trader-agent/smart-money-indicator-core';

function makeCandle(timeframe: SmartMoneyCandle['timeframe'], openTime: number): SmartMoneyCandle {
  return {
    symbol: 'ETHUSDT',
    timeframe,
    openTime,
    closeTime: openTime + 60_000,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 10,
    closed: true,
  };
}

describe('smart money api router', () => {
  it('serves read-only snapshot endpoints from a candle provider', async () => {
    const provider: SmartMoneyCandleProvider = {
      getClosedCandles: vi.fn(async ({ timeframe }) => [makeCandle(timeframe, 1)]),
    };
    const app = express();
    app.use(createSmartMoneyApiRouter({ candleProvider: provider }));

    const response = await request(app).get('/smi/v1/snapshot/ETHUSDT?cursorMs=10').expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.data.symbol).toBe('ETHUSDT');
    expect(provider.getClosedCandles).toHaveBeenCalled();
  });

  it('uses optional state store when provided', async () => {
    const provider: SmartMoneyCandleProvider = {
      getClosedCandles: vi.fn(async ({ timeframe }) => [makeCandle(timeframe, 1)]),
    };
    const stateStore = {
      getState: vi.fn(async () => null),
      saveState: vi.fn(async () => undefined),
    };
    const app = express();
    app.use(createSmartMoneyApiRouter({ candleProvider: provider, stateStore }));

    await request(app).get('/debug/smi/v1/registry/ETHUSDT?cursorMs=10').expect(200);

    expect(stateStore.getState).toHaveBeenCalledWith('ETHUSDT');
    expect(stateStore.saveState).toHaveBeenCalled();
  });
});
