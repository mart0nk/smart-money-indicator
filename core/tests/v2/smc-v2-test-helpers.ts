import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import {
  createSmartMoneyRollingEngine,
  runSmartMoneyEngine,
  type CanonicalSmcCandle,
  type FvgAoi,
  type LiquidityReferenceLevel,
  type LiquiditySweepEvidence,
  type OrderBlockAoi,
  type SmartMoneyConfigInput,
  type SmartMoneyEngineInput,
  type SmartMoneyEngineOutput,
  type SmcAoiFact,
  type SmcAoiFactType,
  type SmcInputTimeframe,
  type SmcSide,
  type SmcSweepSide,
  type Timeframe,
} from '../../src/index.js';

export const START = 1_700_000_000_000;

export const INTERVAL_MS: Record<SmcInputTimeframe, number> = {
  '4h': 4 * 60 * 60_000,
  '1h': 60 * 60_000,
  '30m': 30 * 60_000,
  '15m': 15 * 60_000,
  '5m': 5 * 60_000,
  '3m': 3 * 60_000,
};

const RUNTIME_TERMS = [
  'ENTRY_TRIGGER',
  'LONG_TRIGGER',
  'SHORT_TRIGGER',
  'WATCH',
  'MONITORING',
  'EXECUTION',
  'BUY_SIGNAL',
  'SELL_SIGNAL',
  'POSITION_OPENED',
  'POSITION_CLOSED',
  'ORDER_PLACED',
];

type ReplayState = {
  invalidatedZoneIds: Set<string>;
  seenZones: Map<string, { aoiType: string; side: string; sourceTime: number; aoiLow: number; aoiHigh: number }>;
};

export function candle(
  timeframe: SmcInputTimeframe,
  index: number,
  open: number,
  high: number,
  low: number,
  close: number,
  overrides: Partial<CanonicalSmcCandle> = {},
): CanonicalSmcCandle {
  const period = INTERVAL_MS[timeframe];
  return {
    symbol: overrides.symbol ?? 'BTCUSDT',
    timeframe,
    openTime: START + index * period,
    closeTime: START + (index + 1) * period,
    open,
    high,
    low,
    close,
    volume: overrides.volume ?? 100,
    closed: overrides.closed ?? true,
    ...overrides,
  };
}

export function buildBullishFvgSequence(): CanonicalSmcCandle[] {
  return [
    candle('15m', 0, 98, 100, 97, 99),
    candle('15m', 1, 99, 110, 99, 109),
    candle('15m', 2, 109, 112, 105, 111),
  ];
}

export function buildBearishFvgSequence(): CanonicalSmcCandle[] {
  return [
    candle('15m', 0, 102, 103, 100, 101),
    candle('15m', 1, 101, 102, 90, 91),
    candle('15m', 2, 91, 95, 88, 89),
  ];
}

export function referenceLevel(overrides: Partial<LiquidityReferenceLevel>): LiquidityReferenceLevel {
  return {
    referenceId: 'ref:1',
    type: 'SWING_LOW',
    price: 100,
    side: 'SELL_SIDE_LIQUIDITY',
    sourceTimeframe: '15m',
    detectedAt: START,
    ...overrides,
  };
}

export function runAtCursor(input: {
  symbol?: string;
  candles: CanonicalSmcCandle[];
  timeframe?: SmcInputTimeframe;
  cursorIndex: number;
  config?: SmartMoneyConfigInput;
  referenceLevels?: LiquidityReferenceLevel[];
}): SmartMoneyEngineOutput {
  const timeframe = input.timeframe ?? input.candles[0]?.timeframe ?? '15m';
  const cursor = input.candles[input.cursorIndex];
  if (cursor === undefined || cursor.closeTime === undefined) throw new Error(`Missing cursor candle at ${input.cursorIndex}`);
  return runSmartMoneyEngine({
    symbol: input.symbol ?? cursor.symbol,
    cursorMs: cursor.closeTime,
    candlesByTimeframe: { [timeframe]: input.candles.slice(0, input.cursorIndex + 1) },
    ...(input.referenceLevels === undefined ? {} : { referenceLevels: input.referenceLevels }),
    ...(input.config === undefined ? {} : { config: input.config }),
  });
}

export function replayStateless(input: {
  symbol: string;
  candlesByTimeframe: Partial<Record<SmcInputTimeframe, CanonicalSmcCandle[]>>;
  cursors: number[];
  config?: SmartMoneyConfigInput;
  referenceLevels?: LiquidityReferenceLevel[];
}): SmartMoneyEngineOutput[] {
  return input.cursors.map((cursorMs) => {
    const candlesByTimeframe = Object.fromEntries(
      Object.entries(input.candlesByTimeframe).map(([timeframe, candles]) => [
        timeframe,
        sliceClosedCandlesAtCursor(candles ?? [], cursorMs),
      ]),
    ) as Partial<Record<SmcInputTimeframe, CanonicalSmcCandle[]>>;
    return runSmartMoneyEngine({
      symbol: input.symbol,
      cursorMs,
      candlesByTimeframe,
      ...(input.referenceLevels === undefined ? {} : { referenceLevels: sliceReferencesAtCursor(input.referenceLevels, cursorMs) }),
      ...(input.config === undefined ? {} : { config: input.config }),
    });
  });
}

export function replayRolling(input: {
  symbol: string;
  candlesByTimeframe: Partial<Record<SmcInputTimeframe, CanonicalSmcCandle[]>>;
  cursors: number[];
  config?: SmartMoneyConfigInput;
  referenceLevels?: LiquidityReferenceLevel[];
}): SmartMoneyEngineOutput[] {
  const engine = createSmartMoneyRollingEngine();
  const sent = new Map<SmcInputTimeframe, number>();
  return input.cursors.map((cursorMs) => {
    const closedCandlesByTimeframe = Object.fromEntries(
      Object.entries(input.candlesByTimeframe).map(([rawTimeframe, candles]) => {
        const timeframe = rawTimeframe as SmcInputTimeframe;
        const start = sent.get(timeframe) ?? 0;
        const visible = sliceClosedCandlesAtCursor(candles ?? [], cursorMs);
        sent.set(timeframe, visible.length);
        return [timeframe, visible.slice(start)];
      }),
    ) as Partial<Record<SmcInputTimeframe, CanonicalSmcCandle[]>>;
    return engine.update({
      symbol: input.symbol,
      cursorMs,
      closedCandlesByTimeframe,
      ...(input.referenceLevels === undefined ? {} : { referenceLevels: sliceReferencesAtCursor(input.referenceLevels, cursorMs) }),
      ...(input.config === undefined ? {} : { config: input.config }),
    });
  });
}

export function sliceClosedCandlesAtCursor(candles: CanonicalSmcCandle[], cursorMs: number): CanonicalSmcCandle[] {
  return candles.filter((item) => item.closed && item.closeTime !== undefined && item.closeTime <= cursorMs);
}

export function sliceReferencesAtCursor(references: LiquidityReferenceLevel[], cursorMs: number): LiquidityReferenceLevel[] {
  return references.filter((item) => item.detectedAt <= cursorMs);
}

export function buildReplayCursors(candles: CanonicalSmcCandle[], warmup = 0, maxCount = candles.length): number[] {
  return candles.slice(warmup, maxCount).map((item) => item.closeTime!);
}

export function createReplayState(): ReplayState {
  return { invalidatedZoneIds: new Set(), seenZones: new Map() };
}

export function assertNoFutureEvidence(output: SmartMoneyEngineOutput, cursorMs = output.cursorMs): void {
  for (const aoi of output.aois) {
    expect(aoi.sourceTime).toBeLessThanOrEqual(aoi.availableFrom);
    expect(aoi.availableFrom).toBeLessThanOrEqual(aoi.observedAt);
    expect(aoi.observedAt).toBeLessThanOrEqual(cursorMs);
  }
  for (const fact of output.facts) {
    expect(fact.sourceTime).toBeLessThanOrEqual(fact.availableFrom);
    expect(fact.availableFrom).toBeLessThanOrEqual(fact.observedAt);
    expect(fact.observedAt).toBeLessThanOrEqual(cursorMs);
  }
  for (const event of output.events) {
    expect(event.eventTime).toBeLessThanOrEqual(event.observedAt);
    expect(event.observedAt).toBeLessThanOrEqual(cursorMs);
  }
  for (const sweep of output.sweeps) {
    expect(sweep.sourceTime).toBeLessThanOrEqual(sweep.availableFrom);
    expect(sweep.availableFrom).toBeLessThanOrEqual(sweep.observedAt);
    expect(sweep.observedAt).toBeLessThanOrEqual(cursorMs);
  }
}

export function assertNoRuntimeTradingSemantics(output: SmartMoneyEngineOutput): void {
  const encoded = JSON.stringify(output).toUpperCase();
  for (const term of RUNTIME_TERMS) {
    expect(encoded).not.toContain(term);
  }
}

export function assertDeterministicRerun(input: SmartMoneyEngineInput, output = runSmartMoneyEngine(input)): void {
  expect(runSmartMoneyEngine(input)).toEqual(output);
}

export function assertStableZoneIds(state: ReplayState, output: SmartMoneyEngineOutput): void {
  for (const aoi of output.aois) {
    const identity = {
      aoiType: aoi.aoiType,
      side: aoi.side,
      sourceTime: aoi.sourceTime,
      aoiLow: aoi.aoiLow,
      aoiHigh: aoi.aoiHigh,
    };
    const previous = state.seenZones.get(aoi.zoneId);
    if (previous !== undefined) expect(identity).toEqual(previous);
    state.seenZones.set(aoi.zoneId, identity);
  }
}

export function assertTerminalInvalidation(state: ReplayState, output: SmartMoneyEngineOutput): void {
  for (const aoi of output.aois) {
    if (state.invalidatedZoneIds.has(aoi.zoneId)) {
      expect(aoi.state).toBe('INVALIDATED');
    }
    if (aoi.state === 'INVALIDATED') {
      state.invalidatedZoneIds.add(aoi.zoneId);
    }
  }
}

export function assertOutputOrdering(output: SmartMoneyEngineOutput): void {
  expect(output.aois).toEqual([...output.aois].sort(compareAois));
  expect(output.sweeps).toEqual([...output.sweeps].sort(compareSweeps));
  expect(output.facts).toEqual([...output.facts].sort(compareFacts));
  expect(output.events).toEqual([...output.events].sort(compareEvents));
  expect(output.violations).toEqual([...output.violations].sort(compareViolations));
}

export function findAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'FVG',
  side?: SmcSide,
): FvgAoi | undefined;
export function findAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'ORDER_BLOCK',
  side?: SmcSide,
): OrderBlockAoi | undefined;
export function findAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'FVG' | 'ORDER_BLOCK',
  side?: SmcSide,
): FvgAoi | OrderBlockAoi | undefined {
  return output.aois.find((aoi) => aoi.aoiType === aoiType && (side === undefined || aoi.side === side));
}

export function expectAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'FVG',
  side?: SmcSide,
): FvgAoi;
export function expectAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'ORDER_BLOCK',
  side?: SmcSide,
): OrderBlockAoi;
export function expectAoi(
  output: SmartMoneyEngineOutput,
  aoiType: 'FVG' | 'ORDER_BLOCK',
  side?: SmcSide,
): FvgAoi | OrderBlockAoi {
  const aoi = output.aois.find((item) => item.aoiType === aoiType && (side === undefined || item.side === side));
  expect(aoi).toBeDefined();
  return aoi!;
}

export function expectFact(output: SmartMoneyEngineOutput, factType: SmcAoiFactType, zoneId?: string): SmcAoiFact {
  const fact = output.facts.find((item) => item.factType === factType && (zoneId === undefined || item.zoneId === zoneId));
  expect(fact).toBeDefined();
  return fact!;
}

export function expectSweep(output: SmartMoneyEngineOutput, side: SmcSweepSide): LiquiditySweepEvidence {
  const sweep = output.sweeps.find((item) => item.side === side);
  expect(sweep).toBeDefined();
  return sweep!;
}

export function loadRealFixture(name: string): CanonicalSmcCandle[] {
  const testsDir = dirname(dirname(fileURLToPath(import.meta.url)));
  return JSON.parse(readFileSync(resolve(testsDir, 'fixtures/real', name), 'utf8')) as CanonicalSmcCandle[];
}

export type CuratedCase = {
  caseId: string;
  description: string;
  symbol: string;
  timeframes: SmcInputTimeframe[];
  candlesByTimeframe: Partial<Record<SmcInputTimeframe, CanonicalSmcCandle[]>>;
  referenceLevels?: LiquidityReferenceLevel[];
  expected: {
    aois?: Array<{ aoiType: 'FVG' | 'ORDER_BLOCK'; side: SmcSide }>;
    facts?: SmcAoiFactType[];
    sweeps?: SmcSweepSide[];
  };
};

export function loadCuratedCase(name: string): CuratedCase {
  const testsDir = dirname(dirname(fileURLToPath(import.meta.url)));
  return JSON.parse(readFileSync(resolve(testsDir, 'fixtures/real/cases', name), 'utf8')) as CuratedCase;
}

export type RegressionSummary = ReturnType<typeof summarizeOutput> & {
  totalCursors: number;
  symbol: string;
  timeframes: Timeframe[];
};

export function summarizeOutput(output: SmartMoneyEngineOutput): {
  finalAoiCount: number;
  fvgCount: number;
  orderBlockCount: number;
  sweepCount: number;
  factsByType: Record<string, number>;
  invalidatedCount: number;
  reactionConfirmedCount: number;
} {
  return {
    finalAoiCount: output.aois.length,
    fvgCount: output.aois.filter((aoi) => aoi.aoiType === 'FVG').length,
    orderBlockCount: output.aois.filter((aoi) => aoi.aoiType === 'ORDER_BLOCK').length,
    sweepCount: output.sweeps.length,
    factsByType: output.facts.reduce<Record<string, number>>((counts, fact) => {
      counts[fact.factType] = (counts[fact.factType] ?? 0) + 1;
      return counts;
    }, {}),
    invalidatedCount: output.aois.filter((aoi) => aoi.state === 'INVALIDATED').length,
    reactionConfirmedCount: output.aois.filter((aoi) => aoi.reactionConfirmed).length,
  };
}

export function summarizeReplay(input: {
  symbol: string;
  timeframes: Timeframe[];
  outputs: SmartMoneyEngineOutput[];
}): RegressionSummary {
  const final = input.outputs.at(-1);
  if (final === undefined) throw new Error('Cannot summarize empty replay.');
  return {
    symbol: input.symbol,
    timeframes: input.timeframes,
    totalCursors: input.outputs.length,
    ...summarizeOutput(final),
  };
}

export function assertSummaryMatchesSnapshot(summary: RegressionSummary, snapshotName: string): void {
  const testsDir = dirname(dirname(fileURLToPath(import.meta.url)));
  const expected = JSON.parse(readFileSync(resolve(testsDir, 'fixtures/real/snapshots', snapshotName), 'utf8')) as RegressionSummary;
  expect(summary).toEqual(expected);
}

function compareAois(a: FvgAoi | OrderBlockAoi, b: FvgAoi | OrderBlockAoi): number {
  return a.symbol.localeCompare(b.symbol) ||
    sourceTimeframeRank(a.sourceTimeframe) - sourceTimeframeRank(b.sourceTimeframe) ||
    a.sourceTime - b.sourceTime ||
    a.aoiType.localeCompare(b.aoiType) ||
    a.side.localeCompare(b.side) ||
    a.zoneId.localeCompare(b.zoneId);
}

function compareFacts(a: SmcAoiFact, b: SmcAoiFact): number {
  return a.availableFrom - b.availableFrom ||
    a.factType.localeCompare(b.factType) ||
    (a.zoneId ?? a.factId).localeCompare(b.zoneId ?? b.factId);
}

function compareEvents(a: SmartMoneyEngineOutput['events'][number], b: SmartMoneyEngineOutput['events'][number]): number {
  return a.eventTime - b.eventTime ||
    a.eventType.localeCompare(b.eventType) ||
    (a.zoneId ?? a.eventId).localeCompare(b.zoneId ?? b.eventId);
}

function compareSweeps(a: LiquiditySweepEvidence, b: LiquiditySweepEvidence): number {
  return a.availableFrom - b.availableFrom ||
    a.side.localeCompare(b.side) ||
    a.referenceLevel - b.referenceLevel ||
    a.sweepId.localeCompare(b.sweepId);
}

function compareViolations(
  a: SmartMoneyEngineOutput['violations'][number],
  b: SmartMoneyEngineOutput['violations'][number],
): number {
  const ranks = { FATAL: 0, ERROR: 1, WARN: 2, INFO: 3 };
  return ranks[a.severity] - ranks[b.severity] ||
    a.code.localeCompare(b.code) ||
    (a.timeframe ?? '').localeCompare(b.timeframe ?? '') ||
    (a.candleTime ?? 0) - (b.candleTime ?? 0);
}

function sourceTimeframeRank(timeframe: Timeframe): number {
  return { '4h': 0, '1h': 1, '30m': 2, '15m': 3, '5m': 4, '3m': 5, '1m': 6, '1d': 7 }[timeframe];
}
