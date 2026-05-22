import type { LegacyCandle, LegacySwingPoint } from '../legacy/legacy.types.js';

export function detectSmartMoneySwingPoints(
  candles: readonly LegacyCandle[],
  options?: { leftBars?: number; rightBars?: number }
): LegacySwingPoint[] {
  const leftBars = options?.leftBars ?? 2;
  const rightBars = options?.rightBars ?? 2;
  const results: LegacySwingPoint[] = [];

  for (let i = leftBars; i < candles.length; i += 1) {
    const candle = candles[i];
    if (candle === undefined || !candle.closed) continue;

    const highCandidate = checkSwingHighCandidate(candles, i, leftBars, rightBars);
    if (highCandidate !== 'NONE') {
      results.push(buildSwingPoint(candles, i, 'HIGH', leftBars, rightBars, highCandidate));
    }

    const lowCandidate = checkSwingLowCandidate(candles, i, leftBars, rightBars);
    if (lowCandidate !== 'NONE') {
      results.push(buildSwingPoint(candles, i, 'LOW', leftBars, rightBars, lowCandidate));
    }
  }

  return results;
}

type CandidateResult = 'CONFIRMED' | 'CANDIDATE' | 'NONE';

function checkSwingHighCandidate(candles: readonly LegacyCandle[], i: number, leftBars: number, rightBars: number): CandidateResult {
  const pivot = candles[i];
  if (pivot === undefined) return 'NONE';
  for (let j = i - leftBars; j < i; j += 1) {
    const c = candles[j];
    if (c === undefined || !c.closed || c.high >= pivot.high) return 'NONE';
  }
  let availableRightBars = 0;
  for (let j = i + 1; j <= i + rightBars; j += 1) {
    const c = candles[j];
    if (c === undefined || !c.closed) break;
    if (c.high >= pivot.high) return 'NONE';
    availableRightBars += 1;
  }
  return availableRightBars < rightBars ? 'CANDIDATE' : 'CONFIRMED';
}

function checkSwingLowCandidate(candles: readonly LegacyCandle[], i: number, leftBars: number, rightBars: number): CandidateResult {
  const pivot = candles[i];
  if (pivot === undefined) return 'NONE';
  for (let j = i - leftBars; j < i; j += 1) {
    const c = candles[j];
    if (c === undefined || !c.closed || c.low <= pivot.low) return 'NONE';
  }
  let availableRightBars = 0;
  for (let j = i + 1; j <= i + rightBars; j += 1) {
    const c = candles[j];
    if (c === undefined || !c.closed) break;
    if (c.low <= pivot.low) return 'NONE';
    availableRightBars += 1;
  }
  return availableRightBars < rightBars ? 'CANDIDATE' : 'CONFIRMED';
}

function buildSwingPoint(
  candles: readonly LegacyCandle[],
  i: number,
  type: 'HIGH' | 'LOW',
  leftBars: number,
  rightBars: number,
  candidateResult: 'CONFIRMED' | 'CANDIDATE'
): LegacySwingPoint {
  const candle = candles[i]!;
  const confirmedIdx = i + rightBars;
  const confirmingCandle = candles[confirmedIdx];
  const price = type === 'HIGH' ? candle.high : candle.low;
  const id = `${candle.symbol}:${candle.timeframe}:SWING:${type}:${candle.openTime.getTime()}:${price}`;
  return {
    id,
    type,
    price,
    candleIndex: i,
    candleOpenTime: candle.openTime.getTime(),
    leftBars,
    rightBars,
    confirmationStatus: candidateResult,
    ...(candidateResult === 'CONFIRMED' && confirmingCandle !== undefined
      ? {
          confirmedAtCandleIndex: confirmedIdx,
          confirmedAtOpenTime: confirmingCandle.openTime.getTime(),
        }
      : {}),
    strength: computeStrength(candles, i, type, leftBars, rightBars),
    source: 'CLOSED_CANDLES_ONLY',
  };
}

function computeStrength(candles: readonly LegacyCandle[], i: number, type: 'HIGH' | 'LOW', leftBars: number, rightBars: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  const pivot = candles[i];
  if (pivot === undefined) return 'LOW';
  const pivotValue = type === 'HIGH' ? pivot.high : pivot.low;
  const neighborValues: number[] = [];
  for (let j = i - leftBars; j <= i + rightBars; j += 1) {
    if (j === i) continue;
    const c = candles[j];
    if (c === undefined) continue;
    neighborValues.push(type === 'HIGH' ? c.high : c.low);
  }
  if (neighborValues.length === 0) return 'LOW';
  neighborValues.sort((a, b) => (type === 'HIGH' ? b - a : a - b));
  const bestNeighbor = neighborValues[0]!;
  if (bestNeighbor === 0) return 'LOW';
  const ratio = type === 'HIGH' ? pivotValue / bestNeighbor : bestNeighbor / pivotValue;
  if (ratio >= 1.5) return 'HIGH';
  const secondBest = neighborValues[1];
  if (secondBest !== undefined && secondBest !== 0) {
    const secondRatio = type === 'HIGH' ? pivotValue / secondBest : secondBest / pivotValue;
    if (secondRatio >= 1.5) return 'MEDIUM';
  }
  return 'LOW';
}
