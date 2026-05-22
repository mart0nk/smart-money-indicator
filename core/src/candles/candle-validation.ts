import type { SmartMoneyCandle, SmartMoneyProof, Timeframe } from '../types/index.js';

export type CandleValidationResult = {
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  proof: SmartMoneyProof;
  formingCandles: number;
  lookaheadCandles: number;
};

export function validateClosedCandles(input: {
  cursorMs: number;
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
}): CandleValidationResult {
  const latestClosedByTimeframe: Partial<Record<Timeframe, number>> = {};
  const sourceTimestamps: Record<string, number> = {};
  const missingFeatures: string[] = [];
  const warnings: string[] = [];
  const result: Partial<Record<Timeframe, SmartMoneyCandle[]>> = {};
  let formingCandles = 0;
  let lookaheadCandles = 0;

  for (const [timeframe, rawCandles] of Object.entries(input.candlesByTimeframe) as Array<[Timeframe, SmartMoneyCandle[] | undefined]>) {
    const accepted: SmartMoneyCandle[] = [];
    for (const candle of rawCandles ?? []) {
      if (!candle.closed) {
        formingCandles += 1;
        continue;
      }
      if (candle.openTime > input.cursorMs || (candle.closeTime !== undefined && candle.closeTime > input.cursorMs)) {
        lookaheadCandles += 1;
        continue;
      }
      accepted.push(candle);
    }
    accepted.sort((a, b) => a.openTime - b.openTime);
    result[timeframe] = accepted;
    const latest = accepted.at(-1);
    if (latest !== undefined) {
      latestClosedByTimeframe[timeframe] = latest.openTime;
      sourceTimestamps[`candles:${timeframe}`] = latest.openTime;
    } else {
      missingFeatures.push(`CANDLES_${timeframe}`);
    }
  }

  if (formingCandles > 0) warnings.push('FORMING_CANDLES_IGNORED');
  if (lookaheadCandles > 0) warnings.push('LOOKAHEAD_CANDLES_IGNORED');

  return {
    candlesByTimeframe: result,
    formingCandles,
    lookaheadCandles,
    proof: {
      cursorMs: input.cursorMs,
      closedCandlesOnly: formingCandles === 0,
      lookaheadSafe: lookaheadCandles === 0,
      latestClosedByTimeframe,
      sourceTimestamps,
      missingFeatures,
      warnings,
    },
  };
}
