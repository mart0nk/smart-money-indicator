import { buildFactId, buildSnapshotId, buildSourceId, buildSweepId, buildZoneId } from './smc-ids.js';
import { resolveSmartMoneyConfig } from './smc-config.js';
import type {
  Candle,
  FvgAoi,
  LiquidityReferenceLevel,
  LiquiditySweepEvidence,
  OrderBlockAoi,
  SmcAoiFact,
  SmcEngineViolation,
  SmcInputTimeframe,
  SmcLifecycleEvent,
  SmcSide,
  SmcSourceTimeframe,
  SmartMoneyConfig,
  SmartMoneyEngineInput,
  SmartMoneyEngineOutput,
  SweepTimeframe,
  Timeframe,
} from './smc-core.types.js';

const SOURCE_TIMEFRAME_RANK: Record<SmcSourceTimeframe, number> = {
  '4h': 0,
  '1h': 1,
  '30m': 2,
  '15m': 3,
};

const INTERVAL_MS: Record<SmcInputTimeframe, number> = {
  '4h': 4 * 60 * 60_000,
  '1h': 60 * 60_000,
  '30m': 30 * 60_000,
  '15m': 15 * 60_000,
  '5m': 5 * 60_000,
  '3m': 3 * 60_000,
};

export function runSmartMoneyEngine(input: SmartMoneyEngineInput): SmartMoneyEngineOutput {
  const config = resolveSmartMoneyConfig(input.config);
  const violations: SmcEngineViolation[] = validateConfig(config, input);
  const candles = validateAndNormalizeCandles(input, violations);
  const observedAt = input.cursorMs;
  const aois = config.sourceZoneTimeframes.flatMap((timeframe) => {
    const history = candles[timeframe] ?? [];
    return [
      ...detectFvgAois(input.symbol, timeframe, history, observedAt, config, violations),
      ...detectOrderBlockAois(input.symbol, timeframe, history, observedAt, config),
    ];
  }).sort(compareAois);
  const facts: SmcAoiFact[] = [];
  const events: SmcLifecycleEvent[] = [];
  for (const aoi of aois) {
    appendAoiFacts(aoi, facts, events);
  }
  const sweeps = detectSweeps(input, candles, config, violations, facts, events).sort(compareSweeps);
  facts.sort(compareFacts);
  events.sort(compareEvents);
  violations.sort(compareViolations);
  return {
    contractVersion: 'smi-core-v2',
    snapshotId: buildSnapshotId(input, config.version),
    configVersion: config.version,
    symbol: input.symbol.toUpperCase(),
    cursorMs: input.cursorMs,
    aois,
    sweeps,
    facts,
    events,
    violations,
  };
}

function validateConfig(config: SmartMoneyConfig, input: SmartMoneyEngineInput): SmcEngineViolation[] {
  const violations: SmcEngineViolation[] = [];
  for (const timeframe of config.sourceZoneTimeframes as string[]) {
    if (config.forbiddenSourceZoneTimeframes.includes(timeframe as '5m' | '3m' | '1m')) {
      violations.push(violation(input, 'FORBIDDEN_SOURCE_TIMEFRAME', 'FATAL', `Source zone timeframe ${timeframe} is forbidden.`, timeframe as Timeframe));
    }
  }
  if (config.fvg.minGapBps < 0 || config.sweeps.validForCandles <= 0 || config.sweeps.minWickExtensionBps < 0) {
    violations.push(violation(input, 'INVALID_CONFIG', 'FATAL', 'SMI configuration contains invalid numeric thresholds.'));
  }
  return violations;
}

function validateAndNormalizeCandles(
  input: SmartMoneyEngineInput,
  violations: SmcEngineViolation[],
): Partial<Record<SmcInputTimeframe, Candle[]>> {
  const result: Partial<Record<SmcInputTimeframe, Candle[]>> = {};
  for (const [rawTimeframe, rawCandles] of Object.entries(input.candlesByTimeframe)) {
    const timeframe = rawTimeframe as SmcInputTimeframe;
    if (!(timeframe in INTERVAL_MS)) {
      violations.push(violation(input, 'FORBIDDEN_SOURCE_TIMEFRAME', 'FATAL', `Unsupported SMI timeframe ${rawTimeframe}.`, rawTimeframe as Timeframe));
      continue;
    }
    const byCloseTime = new Map<number, Candle>();
    for (const candle of rawCandles ?? []) {
      const rejection = candleRejection(candle, timeframe, input.cursorMs);
      if (rejection !== undefined) {
        violations.push(violation(input, rejection.code, rejection.severity, rejection.message, timeframe, candle.closeTime ?? candle.openTime));
        continue;
      }
      const closeTime = candle.closeTime!;
      if (byCloseTime.has(closeTime)) {
        violations.push(violation(input, 'DUPLICATE_CANDLE_IGNORED', 'WARN', `Duplicate ${timeframe} candle at ${closeTime} ignored.`, timeframe, closeTime));
        continue;
      }
      byCloseTime.set(closeTime, { ...candle, symbol: input.symbol.toUpperCase(), timeframe });
    }
    result[timeframe] = [...byCloseTime.values()].sort((a, b) => a.closeTime! - b.closeTime!);
  }
  return result;
}

export function isAcceptedClosedCandle(candle: Candle, timeframe: SmcInputTimeframe, cursorMs: number): boolean {
  return candleRejection(candle, timeframe, cursorMs) === undefined;
}

function candleRejection(candle: Candle, timeframe: SmcInputTimeframe, cursorMs: number): {
  code: 'FORMING_CANDLE_REJECTED' | 'FUTURE_CANDLE_REJECTED' | 'MALFORMED_CANDLE_REJECTED';
  severity: 'FATAL';
  message: string;
} | undefined {
  if (!candle.closed) {
    return { code: 'FORMING_CANDLE_REJECTED', severity: 'FATAL', message: `Forming ${timeframe} candle rejected.` };
  }
  if (candle.closeTime === undefined || !Number.isFinite(candle.openTime) || !Number.isFinite(candle.closeTime) ||
      candle.openTime >= candle.closeTime || candle.closeTime - candle.openTime !== INTERVAL_MS[timeframe] ||
      ![candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) ||
      candle.high < Math.max(candle.open, candle.close) || candle.low > Math.min(candle.open, candle.close) ||
      candle.volume < 0) {
    return { code: 'MALFORMED_CANDLE_REJECTED', severity: 'FATAL', message: `Malformed ${timeframe} candle rejected.` };
  }
  if (candle.closeTime > cursorMs) {
    return { code: 'FUTURE_CANDLE_REJECTED', severity: 'FATAL', message: `Future ${timeframe} candle rejected.` };
  }
  return undefined;
}

function detectFvgAois(
  symbol: string,
  timeframe: SmcSourceTimeframe,
  candles: Candle[],
  observedAt: number,
  config: SmartMoneyConfig,
  violations: SmcEngineViolation[],
): FvgAoi[] {
  const aois: FvgAoi[] = [];
  for (let index = 2; index < candles.length; index += 1) {
    const first = candles[index - 2]!;
    const middle = candles[index - 1]!;
    const confirming = candles[index]!;
    let side: SmcSide | undefined;
    let aoiLow = 0;
    let aoiHigh = 0;
    if (confirming.low > first.high) {
      side = 'BULLISH';
      aoiLow = first.high;
      aoiHigh = confirming.low;
    } else if (confirming.high < first.low) {
      side = 'BEARISH';
      aoiLow = confirming.high;
      aoiHigh = first.low;
    }
    if (side === undefined) continue;
    const gapBps = ((aoiHigh - aoiLow) / aoiLow) * 10_000;
    if (gapBps < config.fvg.minGapBps) {
      violations.push({
        code: 'FVG_TOO_SMALL',
        severity: 'INFO',
        message: `FVG candidate below minimum gap on ${timeframe}.`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTime: confirming.closeTime!,
        cursorMs: observedAt,
      });
      continue;
    }
    const sourceTime = confirming.openTime;
    const availableFrom = confirming.closeTime!;
    const base: FvgAoi = {
      aoiType: 'FVG',
      zoneId: buildZoneId({ symbol, sourceTimeframe: timeframe, aoiType: 'FVG', side, sourceCandleTime: sourceTime, aoiLow, aoiHigh }),
      sourceId: buildSourceId({ symbol, sourceTimeframe: timeframe, sourceType: 'FVG', sourceTime }),
      symbol: symbol.toUpperCase(),
      side,
      sourceTimeframe: timeframe,
      aoiLow,
      aoiHigh,
      midpoint: (aoiLow + aoiHigh) / 2,
      sourceTime,
      availableFrom,
      observedAt,
      state: 'AVAILABLE',
      mitigationPct: 0,
      reactionConfirmed: false,
      invalidated: false,
      sourceCandleTimes: [first.openTime, middle.openTime, confirming.openTime],
    };
    aois.push(applyLifecycle(base, candles));
  }
  return aois;
}

function detectOrderBlockAois(
  symbol: string,
  timeframe: SmcSourceTimeframe,
  candles: Candle[],
  observedAt: number,
  config: SmartMoneyConfig,
): OrderBlockAoi[] {
  const aois: OrderBlockAoi[] = [];
  if (!config.orderBlock.requireBos || !config.orderBlock.requireDisplacement) return aois;
  for (let index = 1; index < candles.length; index += 1) {
    const confirmation = candles[index]!;
    const previous = candles[index - 1]!;
    const bullish = confirmation.close > confirmation.open && confirmation.close > previous.high;
    const bearish = confirmation.close < confirmation.open && confirmation.close < previous.low;
    if (!bullish && !bearish) continue;
    const side: SmcSide = bullish ? 'BULLISH' : 'BEARISH';
    let origin: Candle | undefined;
    for (let originIndex = index - 1; originIndex >= Math.max(0, index - 5); originIndex -= 1) {
      const candidate = candles[originIndex]!;
      const opposing = side === 'BULLISH' ? candidate.close < candidate.open : candidate.close > candidate.open;
      if (opposing) {
        origin = candidate;
        break;
      }
    }
    if (origin === undefined) continue;
    const bounds = obBounds(origin, config.orderBlock.boundsPolicy);
    const sourceTime = origin.openTime;
    const availableFrom = confirmation.closeTime!;
    const originBosId = [symbol.toUpperCase(), timeframe, 'BOS', side, confirmation.closeTime].join(':');
    const base: OrderBlockAoi = {
      aoiType: 'ORDER_BLOCK',
      zoneId: buildZoneId({ symbol, sourceTimeframe: timeframe, aoiType: 'ORDER_BLOCK', side, sourceCandleTime: sourceTime, aoiLow: bounds.low, aoiHigh: bounds.high }),
      sourceId: buildSourceId({ symbol, sourceTimeframe: timeframe, sourceType: 'ORDER_BLOCK', sourceTime, provenanceId: originBosId }),
      symbol: symbol.toUpperCase(),
      side,
      sourceTimeframe: timeframe,
      aoiLow: bounds.low,
      aoiHigh: bounds.high,
      midpoint: (bounds.low + bounds.high) / 2,
      sourceTime,
      availableFrom,
      observedAt,
      state: 'AVAILABLE',
      mitigationPct: 0,
      reactionConfirmed: false,
      invalidated: false,
      originBosId,
      displacementCandleTime: confirmation.openTime,
    };
    aois.push(applyLifecycle(base, candles));
  }
  return dedupeBy(aois, (aoi) => aoi.zoneId);
}

function applyLifecycle<T extends FvgAoi | OrderBlockAoi>(aoi: T, candles: Candle[]): T {
  let next: T = aoi;
  let returned = false;
  for (const candle of candles) {
    if (candle.closeTime! <= aoi.availableFrom) continue;
    const invalidated = aoi.side === 'BULLISH' ? candle.close < aoi.aoiLow : candle.close > aoi.aoiHigh;
    if (invalidated) {
      next = { ...next, state: 'INVALIDATED', invalidated: true, reactionConfirmed: false, invalidatedAt: candle.closeTime! };
      break;
    }
    if (next.reactionConfirmed) continue;
    const intersects = candle.high >= aoi.aoiLow && candle.low <= aoi.aoiHigh;
    if (!intersects) continue;
    const mitigationPct = Math.max(next.mitigationPct, calculateMitigation(aoi, candle));
    const reaction = aoi.side === 'BULLISH' ? candle.close > aoi.aoiHigh : candle.close < aoi.aoiLow;
    if (reaction) {
      next = {
        ...next,
        state: 'REACTION_CONFIRMED',
        mitigationPct,
        reactionConfirmed: true,
        returnedAt: next.returnedAt ?? candle.closeTime!,
        reactionConfirmedAt: candle.closeTime!,
      };
    } else if (!returned) {
      next = { ...next, state: 'RETURNED', mitigationPct, returnedAt: candle.closeTime! };
    } else {
      next = { ...next, state: 'MITIGATED', mitigationPct };
    }
    returned = true;
  }
  return next;
}

function appendAoiFacts(aoi: FvgAoi | OrderBlockAoi, facts: SmcAoiFact[], events: SmcLifecycleEvent[]): void {
  const availableType = aoi.aoiType === 'FVG' ? 'FVG_ZONE_AVAILABLE' : 'ORDER_BLOCK_AVAILABLE';
  const availableFact = zoneFact(aoi, availableType, aoi.availableFrom);
  facts.push(availableFact);
  events.push(zoneEvent(aoi, aoi.aoiType === 'FVG' ? 'FVG_AVAILABLE' : 'ORDER_BLOCK_AVAILABLE', aoi.availableFrom));
  if (aoi.state === 'RETURNED' || aoi.state === 'MITIGATED' || aoi.state === 'REACTION_CONFIRMED') {
    const returnedType = aoi.aoiType === 'FVG' ? 'PRICE_RETURNED_TO_FVG' : 'PRICE_RETURNED_TO_ORDER_BLOCK';
    const returnedAt = aoi.returnedAt ?? aoi.observedAt;
    const returned = zoneFact(aoi, returnedType, returnedAt, [availableFact.factId]);
    facts.push(returned);
    events.push(zoneEvent(aoi, aoi.aoiType === 'FVG' ? 'FVG_RETURNED' : 'ORDER_BLOCK_RETURNED', returnedAt));
    if (aoi.aoiType === 'FVG') {
      facts.push(zoneFact(aoi, 'FVG_FIRST_RETURN_CONFIRMED', returnedAt, [availableFact.factId, returned.factId]));
    }
  }
  if (aoi.reactionConfirmed) {
    const reactionType = aoi.aoiType === 'FVG' ? 'FVG_REACTION_CONFIRMED' : 'ORDER_BLOCK_REACTION_CONFIRMED';
    const reactionAt = aoi.reactionConfirmedAt ?? aoi.observedAt;
    facts.push(zoneFact(aoi, reactionType, reactionAt, [availableFact.factId]));
    events.push(zoneEvent(aoi, aoi.aoiType === 'FVG' ? 'FVG_REACTION_CONFIRMED' : 'ORDER_BLOCK_REACTION_CONFIRMED', reactionAt));
  }
  if (aoi.invalidated) {
    const invalidatedType = aoi.aoiType === 'FVG' ? 'FVG_INVALIDATED' : 'ORDER_BLOCK_INVALIDATED';
    const invalidatedAt = aoi.invalidatedAt ?? aoi.observedAt;
    facts.push(zoneFact(aoi, invalidatedType, invalidatedAt, [availableFact.factId]));
    events.push(zoneEvent(aoi, aoi.aoiType === 'FVG' ? 'FVG_INVALIDATED' : 'ORDER_BLOCK_INVALIDATED', invalidatedAt));
  }
}

function zoneFact(aoi: FvgAoi | OrderBlockAoi, factType: SmcAoiFact['factType'], availableFrom: number, relatedFactIds?: string[]): SmcAoiFact {
  return {
    factId: buildFactId({ factType, zoneId: aoi.zoneId, availableFrom }),
    factType,
    zoneId: aoi.zoneId,
    sourceId: aoi.sourceId,
    symbol: aoi.symbol,
    side: aoi.side,
    sourceTimeframe: aoi.sourceTimeframe,
    aoiLow: aoi.aoiLow,
    aoiHigh: aoi.aoiHigh,
    midpoint: aoi.midpoint,
    sourceTime: aoi.sourceTime,
    availableFrom,
    observedAt: aoi.observedAt,
    ...(relatedFactIds === undefined ? {} : { relatedFactIds }),
  };
}

function zoneEvent(aoi: FvgAoi | OrderBlockAoi, eventType: SmcLifecycleEvent['eventType'], eventTime: number): SmcLifecycleEvent {
  return {
    eventId: `${eventType}:${aoi.zoneId}:${eventTime}`,
    eventType,
    symbol: aoi.symbol,
    sourceTimeframe: aoi.sourceTimeframe,
    zoneId: aoi.zoneId,
    sourceId: aoi.sourceId,
    eventTime,
    observedAt: aoi.observedAt,
  };
}

function detectSweeps(
  input: SmartMoneyEngineInput,
  candles: Partial<Record<SmcInputTimeframe, Candle[]>>,
  config: SmartMoneyConfig,
  violations: SmcEngineViolation[],
  facts: SmcAoiFact[],
  events: SmcLifecycleEvent[],
): LiquiditySweepEvidence[] {
  const sweeps: LiquiditySweepEvidence[] = [];
  for (const timeframe of config.sweepTimeframes) {
    for (const candle of candles[timeframe] ?? []) {
      for (const reference of input.referenceLevels ?? []) {
        if (reference.detectedAt > candle.closeTime! || !Number.isFinite(reference.price) || reference.price <= 0) continue;
        const sellSide = reference.side === 'SELL_SIDE_LIQUIDITY';
        const pierced = sellSide ? candle.low < reference.price : candle.high > reference.price;
        const closeBack = sellSide ? candle.close > reference.price : candle.close < reference.price;
        if (!pierced && closeBack && (sellSide ? candle.low === reference.price : candle.high === reference.price)) {
          appendSweepRejection('SWEEP_REJECTED_REACTION_ONLY', input, timeframe, candle, reference, violations, facts);
          continue;
        }
        if (!pierced || !closeBack) continue;
        const extreme = sellSide ? candle.low : candle.high;
        const extensionBps = (Math.abs(extreme - reference.price) / reference.price) * 10_000;
        if (extensionBps < config.sweeps.minWickExtensionBps) {
          appendSweepRejection('SWEEP_REJECTED_TINY_WICK', input, timeframe, candle, reference, violations, facts);
          continue;
        }
        const side = sellSide ? 'SELL_SIDE_SWEEP' : 'BUY_SIDE_SWEEP';
        const availableFrom = candle.closeTime!;
        const sweep: LiquiditySweepEvidence = {
          sweepId: buildSweepId({ symbol: input.symbol, sourceTimeframe: timeframe, side, referenceId: reference.referenceId, availableFrom }),
          symbol: input.symbol.toUpperCase(),
          side,
          sourceTimeframe: timeframe,
          referenceId: reference.referenceId,
          referenceLevel: reference.price,
          sweptExtreme: extreme,
          reclaimClose: candle.close,
          sourceTime: reference.detectedAt,
          availableFrom,
          observedAt: input.cursorMs,
          validForCandles: config.sweeps.validForCandles,
          expiresAt: availableFrom + config.sweeps.validForCandles * INTERVAL_MS[timeframe],
          stale: input.cursorMs > availableFrom + config.sweeps.validForCandles * INTERVAL_MS[timeframe],
        };
        sweeps.push(sweep);
        const detectedType = side === 'SELL_SIDE_SWEEP' ? 'SELL_SIDE_SWEEP_DETECTED' : 'BUY_SIDE_SWEEP_DETECTED';
        facts.push(sweepFact(sweep, detectedType));
        events.push(sweepEvent(sweep, 'SWEEP_DETECTED', availableFrom));
        if (sweep.stale) {
          facts.push(sweepFact(sweep, 'SWEEP_STALE'));
          events.push(sweepEvent(sweep, 'SWEEP_STALE', sweep.expiresAt));
        }
      }
    }
  }
  return dedupeBy(sweeps, (sweep) => sweep.sweepId);
}

function appendSweepRejection(
  type: 'SWEEP_REJECTED_TINY_WICK' | 'SWEEP_REJECTED_REACTION_ONLY',
  input: SmartMoneyEngineInput,
  timeframe: SweepTimeframe,
  candle: Candle,
  reference: LiquidityReferenceLevel,
  violations: SmcEngineViolation[],
  facts: SmcAoiFact[],
): void {
  const code = type;
  violations.push(violation(input, code, 'INFO', `${type} on ${timeframe}.`, timeframe, candle.closeTime));
  const availableFrom = candle.closeTime!;
  facts.push({
    factId: buildFactId({ factType: type, sweepId: reference.referenceId, availableFrom }),
    factType: type,
    symbol: input.symbol.toUpperCase(),
    sourceTimeframe: timeframe,
    sourceTime: reference.detectedAt,
    availableFrom,
    observedAt: input.cursorMs,
  });
}

function sweepFact(sweep: LiquiditySweepEvidence, factType: SmcAoiFact['factType']): SmcAoiFact {
  return {
    factId: buildFactId({ factType, sweepId: sweep.sweepId, availableFrom: sweep.availableFrom }),
    factType,
    symbol: sweep.symbol,
    sweepId: sweep.sweepId,
    side: sweep.side,
    sourceTimeframe: sweep.sourceTimeframe,
    sourceTime: sweep.sourceTime,
    availableFrom: sweep.availableFrom,
    observedAt: sweep.observedAt,
  };
}

function sweepEvent(sweep: LiquiditySweepEvidence, eventType: SmcLifecycleEvent['eventType'], eventTime: number): SmcLifecycleEvent {
  return {
    eventId: `${eventType}:${sweep.sweepId}:${eventTime}`,
    eventType,
    symbol: sweep.symbol,
    sourceTimeframe: sweep.sourceTimeframe,
    sweepId: sweep.sweepId,
    eventTime,
    observedAt: sweep.observedAt,
  };
}

function violation(
  input: SmartMoneyEngineInput,
  code: SmcEngineViolation['code'],
  severity: SmcEngineViolation['severity'],
  message: string,
  timeframe?: Timeframe,
  candleTime?: number,
): SmcEngineViolation {
  return {
    code,
    severity,
    message,
    symbol: input.symbol.toUpperCase(),
    cursorMs: input.cursorMs,
    ...(timeframe === undefined ? {} : { timeframe }),
    ...(candleTime === undefined ? {} : { candleTime }),
  };
}

function obBounds(candle: Candle, policy: SmartMoneyConfig['orderBlock']['boundsPolicy']): { low: number; high: number } {
  if (policy === 'BODY') return { low: Math.min(candle.open, candle.close), high: Math.max(candle.open, candle.close) };
  if (policy === 'HYBRID') {
    const bodyLow = Math.min(candle.open, candle.close);
    const bodyHigh = Math.max(candle.open, candle.close);
    return { low: (bodyLow + candle.low) / 2, high: (bodyHigh + candle.high) / 2 };
  }
  return { low: candle.low, high: candle.high };
}

function calculateMitigation(aoi: FvgAoi | OrderBlockAoi, candle: Candle): number {
  const width = aoi.aoiHigh - aoi.aoiLow;
  const depth = aoi.side === 'BULLISH'
    ? aoi.aoiHigh - Math.max(aoi.aoiLow, candle.low)
    : Math.min(aoi.aoiHigh, candle.high) - aoi.aoiLow;
  return Math.max(0, Math.min(100, (depth / width) * 100));
}

function compareAois(a: FvgAoi | OrderBlockAoi, b: FvgAoi | OrderBlockAoi): number {
  return a.symbol.localeCompare(b.symbol) ||
    SOURCE_TIMEFRAME_RANK[a.sourceTimeframe] - SOURCE_TIMEFRAME_RANK[b.sourceTimeframe] ||
    a.sourceTime - b.sourceTime ||
    a.aoiType.localeCompare(b.aoiType) ||
    a.side.localeCompare(b.side) ||
    a.zoneId.localeCompare(b.zoneId);
}

function compareFacts(a: SmcAoiFact, b: SmcAoiFact): number {
  return a.availableFrom - b.availableFrom || a.factType.localeCompare(b.factType) || (a.zoneId ?? a.factId).localeCompare(b.zoneId ?? b.factId);
}

function compareEvents(a: SmcLifecycleEvent, b: SmcLifecycleEvent): number {
  return a.eventTime - b.eventTime || a.eventType.localeCompare(b.eventType) || (a.zoneId ?? a.eventId).localeCompare(b.zoneId ?? b.eventId);
}

function compareSweeps(a: LiquiditySweepEvidence, b: LiquiditySweepEvidence): number {
  return a.availableFrom - b.availableFrom || a.side.localeCompare(b.side) || a.referenceLevel - b.referenceLevel || a.sweepId.localeCompare(b.sweepId);
}

function compareViolations(a: SmcEngineViolation, b: SmcEngineViolation): number {
  const ranks: Record<SmcEngineViolation['severity'], number> = { FATAL: 0, ERROR: 1, WARN: 2, INFO: 3 };
  return ranks[a.severity] - ranks[b.severity] || a.code.localeCompare(b.code) || (a.timeframe ?? '').localeCompare(b.timeframe ?? '') || (a.candleTime ?? 0) - (b.candleTime ?? 0);
}

function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(item);
  }
  return result;
}
