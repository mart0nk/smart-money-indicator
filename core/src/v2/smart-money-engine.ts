import { buildFactId, buildSnapshotId, buildSourceId, buildSweepId, buildZoneId } from './smc-ids.js';
import { resolveSmartMoneyConfig } from './smc-config.js';
import type {
  Candle,
  FvgDisplacementMetrics,
  FvgAoi,
  FvgLifecycleMetadata,
  FvgNearbyBarrier,
  FvgQualityAssessment,
  FvgQualityFlag,
  FvgSizeMetrics,
  FvgStructureContext,
  LiquidityReferenceLevel,
  LiquiditySweepEvidence,
  OrderBlockAoi,
  SmartMoneyInput,
  SmartMoneySnapshot,
  SmcAoiFact,
  SmcEngineViolation,
  SmcInputTimeframe,
  SmcLifecycleEvent,
  SmcSide,
  SmcSourceTimeframe,
  SmartMoneyConfig,
  SmartMoneyEngineInput,
  SmartMoneyEngineOutput,
  ZoneEligibility,
  ZoneEvidenceLink,
  ZoneQuality,
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

export function createSmartMoneyEngine(config?: SmartMoneyConfig['version'] | SmartMoneyEngineInput['config']): {
  run(input: SmartMoneyInput): SmartMoneySnapshot;
} {
  const resolvedConfig = typeof config === 'string' ? resolveSmartMoneyConfig({ version: config }) : resolveSmartMoneyConfig(config);
  return {
    run(input: SmartMoneyInput): SmartMoneySnapshot {
      const cursorMs = input.cursorTime ?? inferCursorMs(input.candlesByTimeframe);
      const output = runSmartMoneyEngine({
        ...input,
        cursorMs,
        config: resolvedConfig,
      });
      return toSmartMoneySnapshot(output);
    },
  };
}

export function toSmartMoneySnapshot(output: SmartMoneyEngineOutput): SmartMoneySnapshot {
  return {
    ...output,
    schemaVersion: 'smi.snapshot.v1',
    apiVersion: output.contractVersion,
    cursorTime: output.cursorMs,
    zones: output.aois,
    diagnostics: {
      valid: output.valid,
      violations: output.violations,
    },
  };
}

function inferCursorMs(candlesByTimeframe: SmartMoneyInput['candlesByTimeframe']): number {
  const closeTimes = Object.values(candlesByTimeframe)
    .flatMap((candles) => candles ?? [])
    .map((candle) => candle.closeTime)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  if (closeTimes.length === 0) {
    throw new Error('Cannot infer cursorTime from input without closed candle closeTime values.');
  }
  return Math.max(...closeTimes);
}

export function linkSweepToZone(params: {
  zone: FvgAoi | OrderBlockAoi;
  sweep: LiquiditySweepEvidence;
  config?: SmartMoneyEngineInput['config'];
  cursorTime: number;
}): ZoneEvidenceLink {
  const config = resolveSmartMoneyConfig(params.config);
  const reject = (relation: ZoneEvidenceLink['relation'], reason: string): ZoneEvidenceLink => ({
    zoneId: params.zone.zoneId,
    evidenceId: params.sweep.sweepId,
    evidenceType: 'SWEEP',
    relation,
    score: 0,
    accepted: false,
    reasons: [reason],
  });

  if (params.sweep.availableFrom > params.cursorTime) return reject('AFTER_TRIGGER', 'SWEEP_NOT_AVAILABLE_YET');
  if (params.sweep.stale || params.sweep.expiresAt < params.cursorTime) return reject('STALE', 'SWEEP_STALE');
  if (config.evidence.rejectSideIncompatibleSweeps && !isSweepSideCompatible(params.zone.side, params.sweep.side)) {
    return reject('SIDE_INCOMPATIBLE', 'SWEEP_SIDE_INCOMPATIBLE');
  }
  if (!isSweepNearZone(params.zone, params.sweep, config.evidence.maxSweepDistanceBps)) {
    return reject('UNRELATED_PRICE_LEVEL', 'SWEEP_NOT_ZONE_RELATED');
  }
  return {
    zoneId: params.zone.zoneId,
    evidenceId: params.sweep.sweepId,
    evidenceType: 'SWEEP',
    relation: 'SIDE_COMPATIBLE',
    score: 1,
    accepted: true,
    reasons: ['SWEEP_SIDE_COMPATIBLE', 'SWEEP_NEAR_ZONE'],
  };
}

function isSweepSideCompatible(zoneDirection: SmcSide, sweepSide: LiquiditySweepEvidence['side']): boolean {
  if (zoneDirection === 'BULLISH') return sweepSide === 'SELL_SIDE_SWEEP';
  return sweepSide === 'BUY_SIDE_SWEEP';
}

function isSweepNearZone(zone: FvgAoi | OrderBlockAoi, sweep: LiquiditySweepEvidence, maxDistanceBps: number): boolean {
  const edge = sweep.side === 'SELL_SIDE_SWEEP' ? zone.aoiLow : zone.aoiHigh;
  const distanceBps = (Math.abs(sweep.referenceLevel - edge) / edge) * 10_000;
  return distanceBps <= maxDistanceBps;
}

export function runSmartMoneyEngine(input: SmartMoneyEngineInput): SmartMoneyEngineOutput {
  const config = resolveSmartMoneyConfig(input.config);
  const violations: SmcEngineViolation[] = validateConfig(config, input);
  const candles = validateAndNormalizeCandles(input, violations);
  if (config.strictMode && hasFatalViolations(violations)) {
    return emptyOutput(input, config, violations);
  }
  const observedAt = input.cursorMs;
  const sourceTimeframes = validSourceTimeframes(config);
  const aois = sourceTimeframes.flatMap((timeframe) => {
    const history = candles[timeframe] ?? [];
    return [
      ...detectFvgAois(input.symbol, timeframe, history, observedAt, config, violations, input.referenceLevels ?? []),
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
    snapshotId: buildSnapshotId(input, config),
    configVersion: config.version,
    valid: !hasFatalViolations(violations),
    symbol: input.symbol.toUpperCase(),
    cursorMs: input.cursorMs,
    aois,
    sweeps,
    facts,
    events,
    violations,
  };
}

function emptyOutput(
  input: SmartMoneyEngineInput,
  config: SmartMoneyConfig,
  violations: SmcEngineViolation[],
): SmartMoneyEngineOutput {
  const sortedViolations = [...violations].sort(compareViolations);
  return {
    contractVersion: 'smi-core-v2',
    snapshotId: buildSnapshotId(input, config),
    configVersion: config.version,
    valid: false,
    symbol: input.symbol.toUpperCase(),
    cursorMs: input.cursorMs,
    aois: [],
    sweeps: [],
    facts: [],
    events: [],
    violations: sortedViolations,
  };
}

function hasFatalViolations(violations: SmcEngineViolation[]): boolean {
  return violations.some((violation) => violation.severity === 'FATAL');
}

function validSourceTimeframes(config: SmartMoneyConfig): SmcSourceTimeframe[] {
  return (config.sourceZoneTimeframes as string[]).filter((timeframe): timeframe is SmcSourceTimeframe =>
    timeframe in SOURCE_TIMEFRAME_RANK &&
    !config.forbiddenSourceZoneTimeframes.includes(timeframe as '5m' | '3m' | '1m'));
}

function validateConfig(config: SmartMoneyConfig, input: SmartMoneyEngineInput): SmcEngineViolation[] {
  const violations: SmcEngineViolation[] = [];
  for (const timeframe of config.sourceZoneTimeframes as string[]) {
    if (config.forbiddenSourceZoneTimeframes.includes(timeframe as '5m' | '3m' | '1m')) {
      violations.push(violation(input, 'FORBIDDEN_SOURCE_TIMEFRAME', 'FATAL', `Source zone timeframe ${timeframe} is forbidden.`, timeframe as Timeframe));
      continue;
    }
    if (!(timeframe in SOURCE_TIMEFRAME_RANK)) {
      violations.push(violation(input, 'INVALID_CONFIG', 'FATAL', `Source zone timeframe ${timeframe} is unsupported.`, timeframe as Timeframe));
    }
  }
  if (
    config.fvg.minGapBps < 0 ||
    config.fvg.quality.atrPeriod <= 0 ||
    config.fvg.quality.minGapBpsForAcceptable < 0 ||
    config.fvg.quality.displacement.minBodyToRangeRatio < 0 ||
    config.fvg.quality.displacement.minRangeAtrMultiple < 0 ||
    config.fvg.quality.barriers.maxDistancePct < 0 ||
    config.sweeps.validForCandles <= 0 ||
    config.sweeps.minWickExtensionBps < 0
  ) {
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

export function validateCandles(input: {
  candles: readonly Candle[];
  timeframe: SmcInputTimeframe;
  cursorMs: number;
}): SmcEngineViolation[] {
  const violations: SmcEngineViolation[] = [];
  for (const candle of input.candles) {
    const rejection = candleRejection(candle, input.timeframe, input.cursorMs);
    if (rejection === undefined) continue;
    violations.push({
      code: rejection.code,
      severity: rejection.severity,
      message: rejection.message,
      symbol: candle.symbol.toUpperCase(),
      timeframe: input.timeframe,
      candleTime: candle.closeTime ?? candle.openTime,
      cursorMs: input.cursorMs,
    });
  }
  return violations.sort(compareViolations);
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
      ![candle.open, candle.high, candle.low, candle.close].every((price) => price > 0) ||
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
  referenceLevels: LiquidityReferenceLevel[],
): FvgAoi[] {
  if (!config.fvg.enabled) return [];
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
    const sourceTime = confirming.openTime;
    const availableFrom = confirming.closeTime!;
    const quality = analyzeFvgQuality({
      candles,
      index,
      side,
      aoiLow,
      aoiHigh,
      config,
      referenceLevels,
      availableFrom,
    });
    if (quality.flags.includes('TOO_SMALL')) {
      violations.push({
        code: 'FVG_TOO_SMALL',
        severity: 'INFO',
        message: `FVG below quality minimum gap on ${timeframe}.`,
        symbol: symbol.toUpperCase(),
        timeframe,
        candleTime: availableFrom,
        cursorMs: observedAt,
      });
    }
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
      recordedAtCursor: observedAt,
      state: 'AVAILABLE',
      mitigationPct: 0,
      reactionConfirmed: false,
      invalidated: false,
      sourceCandleTimes: [first.openTime, middle.openTime, confirming.openTime],
      lifecycle: {
        state: 'AVAILABLE',
        isFresh: true,
        touchCount: 0,
        mitigationPct: 0,
        terminal: false,
      },
      quality,
      eligibility: makeZoneEligibility(quality, 'AVAILABLE', false),
    };
    aois.push(finalizeAoi(applyLifecycle(base, candles)));
  }
  return aois;
}

function analyzeFvgQuality(input: {
  candles: Candle[];
  index: number;
  side: SmcSide;
  aoiLow: number;
  aoiHigh: number;
  config: SmartMoneyConfig;
  referenceLevels: LiquidityReferenceLevel[];
  availableFrom: number;
}): FvgQualityAssessment {
  const middle = input.candles[input.index - 1]!;
  const atr = calculateAtr(input.candles, input.index, input.config.fvg.quality.atrPeriod);
  const displacement = calculateDisplacement(middle, input.side, atr, input.config);
  const size = calculateFvgSize(input.aoiLow, input.aoiHigh, atr, input.config);
  const structure = findFvgStructureContext(input.candles, input.index, input.side, input.config);
  const nearbyBarriers = findNearbyBarriers(input.aoiLow, input.aoiHigh, input.side, input.referenceLevels, input.availableFrom, input.config);
  const flags: FvgQualityFlag[] = [];

  flags.push(displacement.passed ? 'CREATED_WITH_DISPLACEMENT' : 'CREATED_WITHOUT_DISPLACEMENT');
  flags.push(structure.formedAfterBos ? 'CREATED_AFTER_BOS' : 'NO_BOS_CONTEXT');
  if (!size.passedMinSize) flags.push('TOO_SMALL');
  if (nearbyBarriers.length > 0) flags.push('NEAR_MAJOR_BARRIER');

  const verdict = nearbyBarriers.length > 0
    ? 'TRAP_RISK'
    : !size.passedMinSize || !displacement.passed || !structure.formedAfterBos
      ? 'WEAK'
      : 'STRONG';

  const quality = scoreFvgQuality({
    verdict,
    displacement,
    size,
    structure,
    nearbyBarriers,
    flags,
  }, 'AVAILABLE');
  return {
    policyVersion: 'fvg-quality-v1',
    verdict,
    ...quality,
    displacement,
    size,
    structure,
    nearbyBarriers,
    flags,
  };
}

function calculateDisplacement(
  candle: Candle,
  side: SmcSide,
  atr: number | undefined,
  config: SmartMoneyConfig,
): FvgDisplacementMetrics {
  const rangeSize = candle.high - candle.low;
  const bodySize = Math.abs(candle.close - candle.open);
  const bodyToRangeRatio = rangeSize > 0 ? bodySize / rangeSize : 0;
  const closeLocationPct = rangeSize > 0 ? (candle.close - candle.low) / rangeSize : 0.5;
  const rangeAtrMultiple = atr === undefined || atr <= 0 ? undefined : rangeSize / atr;
  const directionPasses = side === 'BULLISH' ? candle.close > candle.open : candle.close < candle.open;
  const closeLocationPasses = side === 'BULLISH'
    ? closeLocationPct >= config.fvg.quality.displacement.bullishMinCloseLocationPct
    : closeLocationPct <= config.fvg.quality.displacement.bearishMaxCloseLocationPct;
  const atrPasses = rangeAtrMultiple === undefined || rangeAtrMultiple >= config.fvg.quality.displacement.minRangeAtrMultiple;
  return {
    bodySize,
    rangeSize,
    bodyToRangeRatio,
    ...(rangeAtrMultiple === undefined ? {} : { rangeAtrMultiple }),
    closeLocationPct,
    direction: side,
    passed: directionPasses &&
      bodyToRangeRatio >= config.fvg.quality.displacement.minBodyToRangeRatio &&
      atrPasses &&
      closeLocationPasses,
  };
}

function calculateFvgSize(aoiLow: number, aoiHigh: number, atr: number | undefined, config: SmartMoneyConfig): FvgSizeMetrics {
  const gapSizeAbs = aoiHigh - aoiLow;
  const gapSizePct = (gapSizeAbs / aoiLow) * 100;
  const gapBps = gapSizePct * 100;
  const gapAtrMultiple = atr === undefined || atr <= 0 ? undefined : gapSizeAbs / atr;
  const minGapBps = Math.max(config.fvg.minGapBps, config.fvg.quality.minGapBpsForAcceptable);
  const passedAtr = config.fvg.quality.minGapAtrMultipleForAcceptable === undefined ||
    (gapAtrMultiple !== undefined && gapAtrMultiple >= config.fvg.quality.minGapAtrMultipleForAcceptable);
  return {
    gapSizeAbs,
    gapSizePct,
    gapBps,
    ...(gapAtrMultiple === undefined ? {} : { gapAtrMultiple }),
    passedMinSize: gapBps >= minGapBps && passedAtr,
  };
}

function scoreFvgQuality(input: {
  verdict: FvgQualityAssessment['verdict'];
  displacement: FvgDisplacementMetrics;
  size: FvgSizeMetrics;
  structure: FvgStructureContext;
  nearbyBarriers: FvgNearbyBarrier[];
  flags: FvgQualityFlag[];
}, state: FvgAoi['state']): ZoneQuality {
  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];

  if (input.size.passedMinSize) {
    score += 25;
    reasons.push('GAP_SIZE_ACCEPTABLE');
  } else {
    penalties.push('GAP_TOO_SMALL');
  }
  if ((input.size.gapAtrMultiple ?? 0) >= 0.25) {
    score += 15;
    reasons.push('GAP_SIZE_ATR_ACCEPTABLE');
  }
  if (input.displacement.passed) {
    score += 30;
    reasons.push('DISPLACEMENT_CONFIRMED');
  } else {
    penalties.push('DISPLACEMENT_WEAK');
  }
  if (input.structure.formedAfterBos) {
    score += 20;
    reasons.push('BOS_CONTEXT_CONFIRMED');
  } else {
    penalties.push('NO_BOS_CONTEXT');
  }
  if (input.nearbyBarriers.length > 0) {
    score = Math.max(0, score - 25);
    penalties.push('NEAR_MAJOR_BARRIER');
  }
  if (state === 'REACTION_CONFIRMED') {
    score += 10;
    reasons.push('REACTION_CONFIRMED');
  }
  if (state === 'INVALIDATED') {
    score = 0;
    penalties.push('ZONE_INVALIDATED');
  }

  return qualityFromScore(score, reasons, penalties);
}

function findFvgStructureContext(
  candles: Candle[],
  index: number,
  side: SmcSide,
  config: SmartMoneyConfig,
): FvgStructureContext {
  const minIndex = Math.max(1, index - config.fvg.quality.structure.maxCandlesAfterBos);
  for (let bosIndex = index; bosIndex >= minIndex; bosIndex -= 1) {
    const current = candles[bosIndex]!;
    const previous = candles[bosIndex - 1]!;
    const bullishBos = side === 'BULLISH' && current.close > previous.high;
    const bearishBos = side === 'BEARISH' && current.close < previous.low;
    if (!bullishBos && !bearishBos) continue;
    return {
      formedAfterBos: true,
      relatedStructureBreakId: [current.symbol.toUpperCase(), current.timeframe, 'BOS', side, current.closeTime].join(':'),
      candlesAfterBreak: index - bosIndex,
    };
  }
  return { formedAfterBos: false };
}

function findNearbyBarriers(
  aoiLow: number,
  aoiHigh: number,
  side: SmcSide,
  referenceLevels: LiquidityReferenceLevel[],
  availableFrom: number,
  config: SmartMoneyConfig,
): FvgNearbyBarrier[] {
  const maxDistancePct = config.fvg.quality.barriers.maxDistancePct;
  const barriers: FvgNearbyBarrier[] = [];
  for (const reference of referenceLevels) {
    if (reference.detectedAt > availableFrom || !Number.isFinite(reference.price) || reference.price <= 0) continue;
    const above = reference.price >= aoiHigh;
    const below = reference.price <= aoiLow;
    if (side === 'BULLISH' && !above) continue;
    if (side === 'BEARISH' && !below) continue;
    const edge = side === 'BULLISH' ? aoiHigh : aoiLow;
    const distancePct = (Math.abs(reference.price - edge) / edge) * 100;
    if (distancePct > maxDistancePct) continue;
    barriers.push({
      referenceId: reference.referenceId,
      type: reference.type,
      price: reference.price,
      distancePct,
      direction: above ? 'ABOVE' : 'BELOW',
    });
  }
  return barriers.sort((a, b) => a.distancePct - b.distancePct || a.referenceId.localeCompare(b.referenceId));
}

function calculateAtr(candles: Candle[], endIndex: number, period: number): number | undefined {
  const ranges: number[] = [];
  for (let index = Math.max(0, endIndex - period + 1); index <= endIndex; index += 1) {
    const candle = candles[index];
    if (candle === undefined) continue;
    ranges.push(candle.high - candle.low);
  }
  if (ranges.length === 0) return undefined;
  return ranges.reduce((sum, value) => sum + value, 0) / ranges.length;
}

function detectOrderBlockAois(
  symbol: string,
  timeframe: SmcSourceTimeframe,
  candles: Candle[],
  observedAt: number,
  config: SmartMoneyConfig,
): OrderBlockAoi[] {
  if (!config.orderBlock.enabled) return [];
  const aois: OrderBlockAoi[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const confirmation = candles[index]!;
    const previous = candles[index - 1]!;
    const bullishDisplacement = confirmation.close > confirmation.open;
    const bearishDisplacement = confirmation.close < confirmation.open;
    const shouldRequireBos = config.orderBlock.requireBos || config.orderBlock.requireConfirmedBos;
    const bullishBos = config.orderBlock.requireConfirmedBos ? confirmation.close > previous.high : confirmation.high > previous.high;
    const bearishBos = config.orderBlock.requireConfirmedBos ? confirmation.close < previous.low : confirmation.low < previous.low;
    const bullish = (!config.orderBlock.requireDisplacement || bullishDisplacement) &&
      (!shouldRequireBos || bullishBos);
    const bearish = (!config.orderBlock.requireDisplacement || bearishDisplacement) &&
      (!shouldRequireBos || bearishBos);
    if (!bullish && !bearish) continue;
    const side = chooseOrderBlockSide({ bullish, bearish, bullishDisplacement, bearishDisplacement, bullishBos, bearishBos });
    if (side === undefined) continue;
    let origin: Candle | undefined;
    for (let originIndex = index - 1; originIndex >= Math.max(0, index - config.orderBlock.maxCandlesBackFromBos); originIndex -= 1) {
      const candidate = candles[originIndex]!;
      const opposing = side === 'BULLISH' ? candidate.close < candidate.open : candidate.close > candidate.open;
      if (opposing) {
        origin = candidate;
        break;
      }
    }
    if (origin === undefined) continue;
    const bounds = obBounds(origin, config.orderBlock.boundsPolicy);
    const quality = scoreOrderBlockQuality({
      origin,
      confirmation,
      boundsPolicy: config.orderBlock.boundsPolicy,
      ...(config.orderBlock.minOriginBodyAtr === undefined ? {} : { minOriginBodyAtr: config.orderBlock.minOriginBodyAtr }),
      ...(config.orderBlock.minDisplacementAtr === undefined ? {} : { minDisplacementAtr: config.orderBlock.minDisplacementAtr }),
    });
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
      recordedAtCursor: observedAt,
      state: 'AVAILABLE',
      mitigationPct: 0,
      reactionConfirmed: false,
      invalidated: false,
      originBosId,
      displacementCandleTime: confirmation.openTime,
      lifecycle: {
        state: 'AVAILABLE',
        isFresh: true,
        touchCount: 0,
        mitigationPct: 0,
        terminal: false,
      },
      quality,
      eligibility: makeZoneEligibility(quality, 'AVAILABLE', false),
    };
    aois.push(finalizeAoi(applyLifecycle(base, candles)));
  }
  return dedupeBy(aois, (aoi) => aoi.zoneId);
}

function chooseOrderBlockSide(input: {
  bullish: boolean;
  bearish: boolean;
  bullishDisplacement: boolean;
  bearishDisplacement: boolean;
  bullishBos: boolean;
  bearishBos: boolean;
}): SmcSide | undefined {
  if (input.bullish && !input.bearish) return 'BULLISH';
  if (input.bearish && !input.bullish) return 'BEARISH';
  if (input.bullishDisplacement && !input.bearishDisplacement) return 'BULLISH';
  if (input.bearishDisplacement && !input.bullishDisplacement) return 'BEARISH';
  if (input.bullishBos && !input.bearishBos) return 'BULLISH';
  if (input.bearishBos && !input.bullishBos) return 'BEARISH';
  return undefined;
}

function applyLifecycle<T extends FvgAoi | OrderBlockAoi>(aoi: T, candles: Candle[]): T {
  let next: T = aoi;
  let returned = false;
  let touchCount = aoi.lifecycle.touchCount;
  let firstTouchedAt = aoi.lifecycle.firstTouchedAt;
  let midpointTouchedAt = aoi.lifecycle.midpointTouchedAt;
  let lastTouchedAt = aoi.lifecycle.lastTouchedAt;
  let fullyMitigatedAt = aoi.lifecycle.fullyMitigatedAt;
  let deepestMitigationPrice = aoi.lifecycle.deepestMitigationPrice;
  for (const candle of candles) {
    if (candle.closeTime! <= aoi.availableFrom) continue;
    const invalidated = aoi.side === 'BULLISH' ? candle.close < aoi.aoiLow : candle.close > aoi.aoiHigh;
    if (invalidated) {
      next = withLifecycle(
        { ...next, state: 'INVALIDATED', invalidated: true, reactionConfirmed: false, invalidatedAt: candle.closeTime! },
        {
          ...next.lifecycle,
          state: 'INVALIDATED',
          invalidatedAt: candle.closeTime!,
          mitigationPct: next.mitigationPct,
          terminal: true,
        },
      );
      break;
    }
    if (next.reactionConfirmed) continue;
    const intersects = candle.high >= aoi.aoiLow && candle.low <= aoi.aoiHigh;
    if (!intersects) continue;
    touchCount += 1;
    firstTouchedAt ??= candle.closeTime!;
    lastTouchedAt = candle.closeTime!;
    deepestMitigationPrice = deepestMitigation(aoi, candle, deepestMitigationPrice);
    const mitigationPct = Math.max(next.mitigationPct, calculateMitigation(aoi, candle));
    if (mitigationPct >= 50) midpointTouchedAt ??= candle.closeTime!;
    if (mitigationPct >= 100) fullyMitigatedAt ??= candle.closeTime!;
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
    next = withLifecycle(next, {
      state: toZoneLifecycleState(next.state, mitigationPct),
      isFresh: touchCount === 0,
      touchCount,
      ...(firstTouchedAt === undefined ? {} : { firstTouchedAt }),
      ...(midpointTouchedAt === undefined ? {} : { midpointTouchedAt }),
      ...(lastTouchedAt === undefined ? {} : { lastTouchedAt }),
      ...(fullyMitigatedAt === undefined ? {} : { fullyMitigatedAt }),
      ...(deepestMitigationPrice === undefined ? {} : { deepestMitigationPrice }),
      mitigationPct,
      terminal: next.state === 'INVALIDATED' || mitigationPct >= 100,
    });
    returned = true;
  }
  return next;
}

function withLifecycle<T extends FvgAoi | OrderBlockAoi>(aoi: T, lifecycle: FvgLifecycleMetadata): T {
  return { ...aoi, lifecycle } as T;
}

function finalizeAoi<T extends FvgAoi | OrderBlockAoi>(aoi: T): T {
  if (aoi.aoiType === 'FVG') {
    const quality = {
      ...aoi.quality,
      ...scoreFvgQuality(aoi.quality, aoi.state),
    };
    return {
      ...aoi,
      quality,
      eligibility: makeZoneEligibility(quality, aoi.state, aoi.invalidated),
    } as T;
  }
  return {
    ...aoi,
    eligibility: makeZoneEligibility(aoi.quality, aoi.state, aoi.invalidated),
  };
}

function toZoneLifecycleState(state: FvgAoi['state'], mitigationPct: number): FvgLifecycleMetadata['state'] {
  if (state === 'INVALIDATED') return 'INVALIDATED';
  if (mitigationPct >= 100) return 'MITIGATED';
  if (state === 'REACTION_CONFIRMED' || state === 'MITIGATED') return 'PARTIALLY_MITIGATED';
  if (state === 'RETURNED') return 'FIRST_RETURN';
  return 'AVAILABLE';
}

function makeZoneEligibility(quality: ZoneQuality, state: FvgAoi['state'], invalidated: boolean): ZoneEligibility {
  const terminal = invalidated || state === 'INVALIDATED';
  return {
    visibleOnChart: true,
    usableAsAoi: !terminal && quality.grade !== 'LOW',
    usableAsTriggerContext: !terminal && state === 'REACTION_CONFIRMED' && quality.grade === 'HIGH',
  };
}

function appendAoiFacts(aoi: FvgAoi | OrderBlockAoi, facts: SmcAoiFact[], events: SmcLifecycleEvent[]): void {
  const availableType = aoi.aoiType === 'FVG' ? 'FVG_ZONE_AVAILABLE' : 'ORDER_BLOCK_AVAILABLE';
  const availableFact = zoneFact(aoi, availableType, aoi.availableFrom);
  facts.push(availableFact);
  events.push(zoneEvent(aoi, aoi.aoiType === 'FVG' ? 'FVG_AVAILABLE' : 'ORDER_BLOCK_AVAILABLE', aoi.availableFrom));
  if (aoi.aoiType === 'FVG') {
    appendFvgQualityFacts(aoi, availableFact, facts);
  }
  if (aoi.state === 'RETURNED' || aoi.state === 'MITIGATED' || aoi.state === 'REACTION_CONFIRMED') {
    const returnedType = aoi.aoiType === 'FVG' ? 'IMBALANCE_PULLBACK_LOCATION_CONFIRMED' : 'PULLBACK_INTO_ORDER_BLOCK';
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

function appendFvgQualityFacts(aoi: FvgAoi, availableFact: SmcAoiFact, facts: SmcAoiFact[]): void {
  const relatedFactIds = [availableFact.factId];
  if (aoi.quality.flags.includes('CREATED_WITH_DISPLACEMENT')) {
    facts.push(zoneFact(aoi, 'FVG_CREATED_WITH_DISPLACEMENT', aoi.availableFrom, relatedFactIds));
  }
  if (aoi.quality.flags.includes('CREATED_AFTER_BOS')) {
    facts.push(zoneFact(aoi, 'FVG_CREATED_AFTER_BOS', aoi.availableFrom, relatedFactIds));
  }
  if (aoi.quality.flags.includes('TOO_SMALL')) {
    facts.push(zoneFact(aoi, 'FVG_TOO_SMALL', aoi.availableFrom, relatedFactIds));
  }
  if (aoi.quality.flags.includes('NEAR_MAJOR_BARRIER')) {
    facts.push(zoneFact(aoi, 'FVG_NEAR_MAJOR_BARRIER', aoi.availableFrom, relatedFactIds));
  }
  if (aoi.quality.verdict === 'WEAK') {
    facts.push(zoneFact(aoi, 'FVG_LOW_QUALITY', aoi.availableFrom, relatedFactIds));
  }
  if (aoi.quality.verdict === 'TRAP_RISK') {
    facts.push(zoneFact(aoi, 'FVG_TRAP_RISK', aoi.availableFrom, relatedFactIds));
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
  if (!config.sweeps.enabled) return [];
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
	        const expiresAt = availableFrom + config.sweeps.validForCandles * INTERVAL_MS[timeframe];
	        const stale = input.cursorMs > expiresAt;
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
	          recordedAtCursor: input.cursorMs,
	          validForCandles: config.sweeps.validForCandles,
	          expiresAt,
	          stale,
	          quality: scoreSweepQuality(extensionBps, stale),
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
  const rejectionId = [
    input.symbol.toUpperCase(),
    timeframe,
    type,
    reference.referenceId,
    availableFrom,
  ].join(':');
  facts.push({
    factId: buildFactId({ factType: type, sweepId: rejectionId, availableFrom }),
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

function scoreOrderBlockQuality(input: {
  origin: Candle;
  confirmation: Candle;
  boundsPolicy: SmartMoneyConfig['orderBlock']['boundsPolicy'];
  minOriginBodyAtr?: number;
  minDisplacementAtr?: number;
}): ZoneQuality {
  let score = 30;
  const reasons = ['BOS_CONFIRMED'];
  const penalties: string[] = [];
  const originRange = input.origin.high - input.origin.low;
  const originBody = Math.abs(input.origin.close - input.origin.open);
  const displacementRange = input.confirmation.high - input.confirmation.low;
  const originBodyAtr = originRange > 0 ? originBody / originRange : 0;
  const displacementAtr = originRange > 0 ? displacementRange / originRange : 0;

  if (input.minOriginBodyAtr === undefined || originBodyAtr >= input.minOriginBodyAtr) {
    score += 20;
    reasons.push('ORIGIN_BODY_CONFIRMED');
  } else {
    penalties.push('ORIGIN_BODY_WEAK');
  }
  if (input.minDisplacementAtr === undefined || displacementAtr >= input.minDisplacementAtr) {
    score += 25;
    reasons.push('DISPLACEMENT_CONFIRMED');
  } else {
    penalties.push('DISPLACEMENT_WEAK');
  }
  if (input.boundsPolicy === 'BODY' || input.boundsPolicy === 'HYBRID' || input.boundsPolicy === 'BODY_TO_WICK') {
    score += 15;
    reasons.push('BOUNDS_REFINED');
  } else {
    penalties.push('FULL_WICK_BOUNDS');
  }

  return qualityFromScore(score, reasons, penalties);
}

function scoreSweepQuality(extensionBps: number, stale: boolean): ZoneQuality {
  let score = 35;
  const reasons = ['WICK_RECLAIM_CONFIRMED'];
  const penalties: string[] = [];
  if (extensionBps >= 10) {
    score += 35;
    reasons.push('WICK_EXTENSION_HIGH');
  } else if (extensionBps >= 3) {
    score += 20;
    reasons.push('WICK_EXTENSION_ACCEPTABLE');
  } else {
    penalties.push('WICK_EXTENSION_SMALL');
  }
  if (stale) {
    score = Math.max(0, score - 40);
    penalties.push('SWEEP_STALE');
  }
  return qualityFromScore(score, reasons, penalties);
}

function qualityFromScore(score: number, reasons: string[], penalties: string[]): ZoneQuality {
  const boundedScore = Math.max(0, Math.min(100, score));
  return {
    score: boundedScore,
    grade: boundedScore >= 75 ? 'HIGH' : boundedScore >= 45 ? 'MEDIUM' : 'LOW',
    reasons,
    penalties,
  };
}

function obBounds(candle: Candle, policy: SmartMoneyConfig['orderBlock']['boundsPolicy']): { low: number; high: number } {
  if (policy === 'BODY') return { low: Math.min(candle.open, candle.close), high: Math.max(candle.open, candle.close) };
  if (policy === 'CE') {
    const midpoint = (candle.high + candle.low) / 2;
    return { low: Math.min(candle.open, candle.close, midpoint), high: Math.max(candle.open, candle.close, midpoint) };
  }
  if (policy === 'HYBRID') {
    const bodyLow = Math.min(candle.open, candle.close);
    const bodyHigh = Math.max(candle.open, candle.close);
    return { low: (bodyLow + candle.low) / 2, high: (bodyHigh + candle.high) / 2 };
  }
  if (policy === 'BODY_TO_WICK') {
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

function deepestMitigation(aoi: FvgAoi | OrderBlockAoi, candle: Candle, current: number | undefined): number {
  const candidate = aoi.side === 'BULLISH'
    ? Math.max(aoi.aoiLow, Math.min(aoi.aoiHigh, candle.low))
    : Math.min(aoi.aoiHigh, Math.max(aoi.aoiLow, candle.high));
  if (current === undefined) return candidate;
  return aoi.side === 'BULLISH' ? Math.min(current, candidate) : Math.max(current, candidate);
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
