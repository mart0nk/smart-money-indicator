import { describe, expect, it } from 'vitest';
import { runSmartMoneyEngine } from '../../src/index.js';
import {
  assertNoFutureEvidence,
  assertNoRuntimeTradingSemantics,
  expectAoi,
  expectFact,
  expectSweep,
  loadCuratedCase,
} from './smc-v2-test-helpers.js';

const CASES = [
  'btc-15m-bullish-fvg-reaction.json',
  'sol-15m-bearish-fvg-invalidation.json',
  'eth-15m-order-block.json',
  'bnb-15m-bullish-fvg.json',
  'xrp-3m-buy-side-sweep.json',
] as const;

describe('SMI core v2 curated real-data cases', () => {
  it.each(CASES)('matches expected SMC evidence for %s', (caseFile) => {
    const testCase = loadCuratedCase(caseFile);
    const cursorMs = Math.max(
      ...Object.values(testCase.candlesByTimeframe)
        .flatMap((candles) => candles ?? [])
        .map((candle) => candle.closeTime!),
    );
    const output = runSmartMoneyEngine({
      symbol: testCase.symbol,
      cursorMs,
      candlesByTimeframe: testCase.candlesByTimeframe,
      ...(testCase.referenceLevels === undefined ? {} : { referenceLevels: testCase.referenceLevels }),
    });

    for (const expectedAoi of testCase.expected.aois ?? []) {
      if (expectedAoi.aoiType === 'FVG') {
        expectAoi(output, 'FVG', expectedAoi.side);
      } else {
        expectAoi(output, 'ORDER_BLOCK', expectedAoi.side);
      }
    }
    for (const factType of testCase.expected.facts ?? []) {
      expectFact(output, factType);
    }
    for (const side of testCase.expected.sweeps ?? []) {
      expectSweep(output, side);
    }

    expect(output.valid).toBe(true);
    assertNoFutureEvidence(output);
    assertNoRuntimeTradingSemantics(output);
  });
});
