import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import { loadRealFixture } from './smc-v2-test-helpers.js';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'] as const;

describe('SMI core v2 real-data multi-symbol coverage', () => {
  it('keeps zone and sweep identities scoped by symbol across real fixtures', () => {
    const seenZoneIds = new Set<string>();
    const seenSweepIds = new Set<string>();

    for (const symbol of SYMBOLS) {
      const candles15m = loadRealFixture(`${symbol}-15m-sample.json`);
      const candles3m = loadRealFixture(`${symbol}-3m-sample.json`);
      const output = runSmartMoneyEngine({
        symbol,
        cursorMs: candles15m.at(-1)!.closeTime!,
        candlesByTimeframe: {
          '15m': candles15m,
          '3m': candles3m.filter((candle) => candle.closeTime! <= candles15m.at(-1)!.closeTime!),
        },
      });

      expect(output.symbol).toBe(symbol);
      expect(output.aois.length).toBeGreaterThan(0);
      for (const aoi of output.aois) {
        expect(aoi.symbol).toBe(symbol);
        expect(aoi.zoneId.startsWith(`${symbol}:`)).toBe(true);
        expect(seenZoneIds.has(aoi.zoneId)).toBe(false);
        seenZoneIds.add(aoi.zoneId);
      }
      for (const sweep of output.sweeps) {
        expect(sweep.symbol).toBe(symbol);
        expect(sweep.sweepId.startsWith(`${symbol}:`)).toBe(true);
        expect(seenSweepIds.has(sweep.sweepId)).toBe(false);
        seenSweepIds.add(sweep.sweepId);
      }
    }
  });
});
