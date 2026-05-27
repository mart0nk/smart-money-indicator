import { validateClosedCandles } from '../candles/candle-validation.js';
import { mergeSmartMoneyConfig } from '../config/index.js';
import { detectSmartMoneyLiquiditySweeps } from '../liquidity/liquidity-sweep-detector.js';
import { detectSmartMoneyFvgZones } from '../zones/fvg-detector.js';
import { detectSmartMoneyOrderBlockZones } from '../zones/order-block-detector.js';
import { buildStableZoneId } from '../zones/zone-id.js';
import type {
  EvaluateSmartMoneyIncrementalInput,
  EvaluateSmartMoneyInput,
  EvaluateSmartMoneyResult,
  LiquidityPool,
  LiquiditySweepEvidence,
  SmartMoneyAlert,
  SmartMoneyAOI,
  SmartMoneyCandle,
  SmartMoneyDiagnosticsReport,
  SmartMoneyEngine,
  SmartMoneyEngineConfig,
  SmartMoneyEngineState,
  SmartMoneyEvent,
  SmartMoneyFvgZone,
  SmartMoneyIndicatorOutput,
  SmartMoneyOrderBlockZone,
  SmartMoneyProof,
  SmartMoneyQuality,
  SmartMoneyReactionEvidence,
  SmartMoneyStatus,
  SmartMoneyStructure,
  SmartMoneyTimeframeState,
  SmartMoneyZone,
  SmcSourceTimeframe,
  SweepDiagnosticsTimeframe,
  Timeframe,
} from '../types/index.js';

export function createSmartMoneyEngine(config: SmartMoneyEngineConfig = mergeSmartMoneyConfig()): SmartMoneyEngine {
  const resolvedConfig = mergeSmartMoneyConfig(config);
  return {
    evaluate(input) {
      return evaluateSmartMoneySnapshot({ ...input, config: mergeSmartMoneyConfig({ ...resolvedConfig, ...input.config }) });
    },
    evaluateIncremental(input) {
      return evaluateSmartMoneySnapshot({
        symbol: input.symbol,
        cursorMs: input.cursorMs,
        candlesByTimeframe: input.newlyClosedCandlesByTimeframe,
        mode: 'INCREMENTAL',
        previousState: input.previousState,
        config: mergeSmartMoneyConfig({ ...resolvedConfig, ...input.config }),
      });
    },
    getConfig() {
      return resolvedConfig;
    },
  };
}

export function evaluateSmartMoneySnapshot(input: EvaluateSmartMoneyInput): EvaluateSmartMoneyResult {
  const config = mergeSmartMoneyConfig(input.config);
  const validation = validateClosedCandles({
    cursorMs: input.cursorMs,
    candlesByTimeframe: input.candlesByTimeframe,
  });
  const proof = validation.proof;
  const symbol = input.symbol.toUpperCase();
  const previousState = input.mode === 'INCREMENTAL' ? input.previousState : undefined;
  const previousZones = previousState?.zoneRegistry.zonesById ?? {};
  const previousEventIds = new Set(previousState?.eventLog.map((event) => event.eventId) ?? []);
  const events: SmartMoneyEvent[] = [];
  const reactions: SmartMoneyReactionEvidence[] = [];
  const zonesById: Record<string, SmartMoneyZone> = { ...previousZones };
  const lastStructureByTimeframe: Partial<Record<Timeframe, SmartMoneyStructure>> = { ...(previousState?.lastStructureByTimeframe ?? {}) };

  for (const timeframe of config.sourceZoneTimeframes) {
    const candles = validation.candlesByTimeframe[timeframe] ?? [];
    if (candles.length === 0) continue;
    const structure = deriveStructure(candles);
    lastStructureByTimeframe[timeframe] = structure;
    const sourceCandles = candles.map((candle) => ({ ...candle, timeframe }));

    for (const zone of detectSmartMoneyFvgZones({ symbol, timeframe, candles: sourceCandles, proof, config })) {
      const existing = zonesById[zone.zoneId] as SmartMoneyFvgZone | undefined;
      zonesById[zone.zoneId] = updateFvgLifecycle(existing ?? zone, candles, input.cursorMs, proof);
      pushEventOnce(events, previousEventIds, makeEvent({ symbol, timeframe, cursorMs: input.cursorMs, type: 'FVG_DETECTED', zoneId: zone.zoneId, proof, details: { side: zone.side } }));
    }

    for (const zone of detectSmartMoneyOrderBlockZones({ symbol, timeframe, candles: sourceCandles, proof, config })) {
      const existing = zonesById[zone.zoneId] as SmartMoneyOrderBlockZone | undefined;
      zonesById[zone.zoneId] = updateOrderBlockLifecycle(existing ?? zone, candles, input.cursorMs, proof);
      pushEventOnce(events, previousEventIds, makeEvent({ symbol, timeframe, cursorMs: input.cursorMs, type: 'ORDER_BLOCK_DETECTED', zoneId: zone.zoneId, proof, details: { side: zone.side } }));
    }
  }

  const liquidityPools = buildLiquidityPools({ symbol, candlesByTimeframe: validation.candlesByTimeframe, proof });
  const activeSweeps = [
    ...(previousState?.activeSweeps ?? []),
    ...detectSmartMoneyLiquiditySweeps({
      symbol,
      candlesByTimeframe: validation.candlesByTimeframe,
      proof,
      validForCandles: config.sweeps.validForCandles,
      timeframes: config.sweepTimeframes,
      minWickExtensionBps: config.sweeps.minWickExtensionBps,
    }),
  ].map((sweep) => refreshSweep(sweep, input.cursorMs));

  for (const sweep of activeSweeps) {
    if (!previousEventIds.has(`SWEEP_DETECTED:${sweep.sweepId}`)) {
      pushEventOnce(events, previousEventIds, makeEvent({
        symbol,
        timeframe: sweep.sourceTimeframe,
        cursorMs: input.cursorMs,
        type: 'SWEEP_DETECTED',
        sweepId: sweep.sweepId,
        proof,
        details: { side: sweep.side, referenceLevel: sweep.referenceLevel },
      }));
    }
  }

  const zoneList = Object.values(zonesById);
  const activeAois = zoneList.map((zone) => toAoi(zone, proof, activeSweeps)).filter((aoi) => aoi.state !== 'INVALIDATED');
  for (const aoi of activeAois) {
    if (aoi.state === 'REACTION_CONFIRMED') {
      reactions.push({
        reactionId: `reaction:${aoi.aoiId}:${input.cursorMs}`,
        symbol,
        timeframe: aoi.timeframe,
        aoiId: aoi.aoiId,
        ...(aoi.relatedZoneId !== undefined ? { zoneId: aoi.relatedZoneId } : {}),
        side: aoi.side === 'BEARISH' ? 'BEARISH' : 'BULLISH',
        reactionType: 'CLOSE_BACK_FROM_MIDPOINT',
        detectedAt: input.cursorMs,
        sourceCandleTime: proof.latestClosedByTimeframe[aoi.timeframe] ?? input.cursorMs,
        strength: 'MEDIUM',
        proof,
      });
    }
  }

  const alerts = buildAlerts({ symbol, cursorMs: input.cursorMs, activeAois, activeSweeps, reactions, proof });
  const snapshot = buildSnapshot({
    symbol,
    cursorMs: input.cursorMs,
    proof,
    validationCandles: validation.candlesByTimeframe,
    structures: lastStructureByTimeframe,
    zones: zoneList,
    liquidityPools,
    activeSweeps,
    activeAois,
    reactions,
    alerts,
  });
  const diagnostics = buildDiagnostics({ cursorMs: input.cursorMs, proof, validation, zones: zoneList });
  const nextState: SmartMoneyEngineState = {
    symbol,
    zoneRegistry: {
      zonesById,
      invalidatedZoneIds: zoneList.filter((zone) => zone.state === 'INVALIDATED').map((zone) => zone.zoneId),
    },
    liquidityPools,
    activeSweeps,
    activeAois,
    lastStructureByTimeframe,
    eventLog: [...(previousState?.eventLog ?? []), ...events],
    lastEvaluatedCursorMs: input.cursorMs,
    latestClosedByTimeframe: proof.latestClosedByTimeframe,
  };

  return { snapshot, nextState, events, alerts, diagnostics };
}

function detectFvgZones(input: {
  symbol: string;
  timeframe: SmcSourceTimeframe;
  candles: SmartMoneyCandle[];
  proof: SmartMoneyProof;
  config: SmartMoneyEngineConfig;
}): SmartMoneyFvgZone[] {
  const zones: SmartMoneyFvgZone[] = [];
  for (let i = 0; i <= input.candles.length - 3; i += 1) {
    const c1 = input.candles[i];
    const c2 = input.candles[i + 1];
    const c3 = input.candles[i + 2];
    if (c1 === undefined || c2 === undefined || c3 === undefined) continue;
    if (c3.low > c1.high) {
      const gapBps = ((c3.low - c1.high) / c1.high) * 10_000;
      if (input.config.fvg.rejectTinyFvg && input.config.fvg.minGapBps !== undefined && gapBps < input.config.fvg.minGapBps) continue;
      zones.push(makeFvgZone({ symbol: input.symbol, timeframe: input.timeframe, side: 'BULLISH', zoneLow: c1.high, zoneHigh: c3.low, c1, c2, c3, proof: input.proof }));
    }
    if (c3.high < c1.low) {
      const gapBps = ((c1.low - c3.high) / c1.low) * 10_000;
      if (input.config.fvg.rejectTinyFvg && input.config.fvg.minGapBps !== undefined && gapBps < input.config.fvg.minGapBps) continue;
      zones.push(makeFvgZone({ symbol: input.symbol, timeframe: input.timeframe, side: 'BEARISH', zoneLow: c3.high, zoneHigh: c1.low, c1, c2, c3, proof: input.proof }));
    }
  }
  return zones;
}

function makeFvgZone(input: {
  symbol: string;
  timeframe: SmcSourceTimeframe;
  side: 'BULLISH' | 'BEARISH';
  zoneLow: number;
  zoneHigh: number;
  c1: SmartMoneyCandle;
  c2: SmartMoneyCandle;
  c3: SmartMoneyCandle;
  proof: SmartMoneyProof;
}): SmartMoneyFvgZone {
  const midpoint = midpointOf(input.zoneLow, input.zoneHigh);
  return {
    sourceId: `${input.symbol}:${input.timeframe}:FVG:SOURCE:${input.c3.openTime}:none`,
    zoneId: buildZoneId(input.symbol, input.timeframe, 'FVG', input.side, input.c3.openTime, input.zoneLow, input.zoneHigh),
    type: 'FVG',
    side: input.side,
    symbol: input.symbol,
    timeframe: input.timeframe,
    sourceTimeframe: input.timeframe,
    zoneLow: input.zoneLow,
    zoneHigh: input.zoneHigh,
    midpoint,
    sourceCandles: { candle1Time: input.c1.openTime, candle2Time: input.c2.openTime, candle3Time: input.c3.openTime },
    sourceCandleTime: input.c3.openTime,
    createdAt: input.c3.openTime,
    availableFrom: input.c3.closeTime ?? input.c3.openTime,
    state: 'DETECTED',
    mitigationPct: 0,
    proof: input.proof,
  };
}

function detectOrderBlocks(input: {
  symbol: string;
  timeframe: SmcSourceTimeframe;
  candles: SmartMoneyCandle[];
  proof: SmartMoneyProof;
  config: SmartMoneyEngineConfig;
}): SmartMoneyOrderBlockZone[] {
  const zones: SmartMoneyOrderBlockZone[] = [];
  for (let i = 2; i < input.candles.length; i += 1) {
    const prev = input.candles[i - 1];
    const current = input.candles[i];
    if (prev === undefined || current === undefined) continue;
    const bullishDisplacement = current.close > prev.high && current.close > current.open;
    const bearishDisplacement = current.close < prev.low && current.close < current.open;
    if (!bullishDisplacement && !bearishDisplacement) continue;
    const side = bullishDisplacement ? 'BULLISH' : 'BEARISH';
    const start = Math.max(0, i - input.config.orderBlock.maxCandlesBackFromBos);
    for (let j = i - 1; j >= start; j -= 1) {
      const origin = input.candles[j];
      if (origin === undefined) continue;
      if (side === 'BULLISH' && origin.close >= origin.open) continue;
      if (side === 'BEARISH' && origin.close <= origin.open) continue;
      const bounds = orderBlockBounds(origin, input.config.orderBlock.zonePolicy, side);
      const zoneId = buildZoneId(input.symbol, input.timeframe, 'ORDER_BLOCK', side, origin.openTime, bounds.zoneLow, bounds.zoneHigh);
      zones.push({
        sourceId: `${input.symbol}:${input.timeframe}:ORDER_BLOCK:SOURCE:${origin.openTime}:none`,
        zoneId,
        type: 'ORDER_BLOCK',
        side,
        symbol: input.symbol,
        timeframe: input.timeframe,
        sourceTimeframe: input.timeframe,
        zoneLow: bounds.zoneLow,
        zoneHigh: bounds.zoneHigh,
        midpoint: midpointOf(bounds.zoneLow, bounds.zoneHigh),
        originCandleTime: origin.openTime,
        sourceCandleTime: origin.openTime,
        displacementEventId: `${input.symbol}:${input.timeframe}:displacement:${current.openTime}`,
        createdAt: current.openTime,
        availableFrom: current.openTime,
        state: 'DETECTED',
        mitigationPct: 0,
        proof: input.proof,
      });
      if (!input.config.orderBlock.allowMultipleOriginCandles) break;
    }
  }
  return zones;
}

function updateFvgLifecycle(zone: SmartMoneyFvgZone, candles: SmartMoneyCandle[], cursorMs: number, proof: SmartMoneyProof): SmartMoneyFvgZone {
  if (zone.state === 'INVALIDATED') return withQuality({ ...zone, proof });
  let next: SmartMoneyFvgZone = { ...zone, proof };
  for (const candle of candles) {
    if (candle.openTime < zone.availableFrom) continue;
    if (next.state === 'INVALIDATED') break;
    const invalidated = zone.side === 'BULLISH' ? candle.close < zone.zoneLow : candle.close > zone.zoneHigh;
    if (invalidated) {
      next = { ...next, state: 'INVALIDATED', invalidatedAt: candle.openTime, invalidationReason: 'CLOSE_BEYOND_ZONE', proof };
      break;
    }
    const mitigationPct = Math.max(next.mitigationPct, calculateMitigationPct(zone, candle));
    if (mitigationPct > 0 && next.firstReturnAt === undefined) {
      next = { ...next, state: 'FIRST_RETURN', firstReturnAt: candle.openTime, mitigationPct, proof };
    } else if (mitigationPct >= 100 && next.state !== 'REACTION_CONFIRMED') {
      next = { ...next, state: 'MITIGATED', mitigatedAt: candle.openTime, mitigationPct, proof };
    } else if (mitigationPct > 0 && next.state !== 'REACTION_CONFIRMED') {
      next = { ...next, state: 'PARTIALLY_MITIGATED', mitigationPct, proof };
    } else if (next.state === 'DETECTED') {
      next = { ...next, state: 'ACTIVE', proof };
    }
    const reacted = mitigationPct >= 50 && (zone.side === 'BULLISH' ? candle.close > zone.midpoint : candle.close < zone.midpoint);
    if (reacted) {
      next = { ...next, state: 'REACTION_CONFIRMED', reactedAt: cursorMs, mitigationPct, proof };
    }
  }
  return withQuality(next);
}

function updateOrderBlockLifecycle(zone: SmartMoneyOrderBlockZone, candles: SmartMoneyCandle[], cursorMs: number, proof: SmartMoneyProof): SmartMoneyOrderBlockZone {
  if (zone.state === 'INVALIDATED') return withQuality({ ...zone, proof });
  let next: SmartMoneyOrderBlockZone = { ...zone, proof };
  for (const candle of candles) {
    if (candle.openTime < zone.availableFrom) continue;
    if (next.state === 'INVALIDATED') break;
    const invalidated = zone.side === 'BULLISH' ? candle.close < zone.zoneLow : candle.close > zone.zoneHigh;
    if (invalidated) {
      next = { ...next, state: 'INVALIDATED', invalidatedAt: candle.openTime, invalidationReason: 'CLOSE_BEYOND_OB_EDGE', proof };
      break;
    }
    const mitigationPct = Math.max(next.mitigationPct, calculateMitigationPct(zone, candle));
    if (mitigationPct > 0 && next.firstTouchAt === undefined) {
      next = { ...next, state: 'PULLBACK_INTO_ZONE', firstTouchAt: candle.openTime, mitigationPct, proof };
    } else if (mitigationPct >= 100 && next.state !== 'REACTION_CONFIRMED') {
      next = { ...next, state: 'MITIGATED', mitigationPct, proof };
    } else if (mitigationPct > 0 && next.state !== 'REACTION_CONFIRMED') {
      next = { ...next, state: 'PARTIALLY_MITIGATED', mitigationPct, proof };
    } else if (next.state === 'DETECTED') {
      next = { ...next, state: 'ACTIVE', proof };
    }
    const reacted = mitigationPct >= 50 && (zone.side === 'BULLISH' ? candle.close > zone.midpoint : candle.close < zone.midpoint);
    if (reacted) {
      next = { ...next, state: 'REACTION_CONFIRMED', reactedAt: cursorMs, mitigationPct, proof };
    }
  }
  return withQuality(next);
}

function detectLiquiditySweeps(input: {
  symbol: string;
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  cursorMs: number;
  proof: SmartMoneyProof;
  validForCandles: number;
  minWickExtensionBps: number;
}): LiquiditySweepEvidence[] {
  const sweeps: LiquiditySweepEvidence[] = [];
  for (const timeframe of ['15m', '5m', '3m'] as const) {
    const candles = input.candlesByTimeframe[timeframe] ?? [];
    for (let i = 2; i < candles.length; i += 1) {
      const reference = candles[i - 1];
      const candle = candles[i];
      if (reference === undefined || candle === undefined) continue;
      if (candle.low < reference.low && candle.close > reference.low) {
        const wickBps = ((reference.low - candle.low) / reference.low) * 10_000;
        if (wickBps >= input.minWickExtensionBps) {
          sweeps.push(makeSweep({ symbol: input.symbol, timeframe, side: 'SELL_SIDE', referenceLevel: reference.low, referenceType: 'LOCAL_LOW', sweptExtreme: candle.low, closeBackPrice: candle.close, candleTime: candle.openTime, wickBps, validForCandles: input.validForCandles, proof: input.proof }));
        }
      }
      if (candle.high > reference.high && candle.close < reference.high) {
        const wickBps = ((candle.high - reference.high) / reference.high) * 10_000;
        if (wickBps >= input.minWickExtensionBps) {
          sweeps.push(makeSweep({ symbol: input.symbol, timeframe, side: 'BUY_SIDE', referenceLevel: reference.high, referenceType: 'LOCAL_HIGH', sweptExtreme: candle.high, closeBackPrice: candle.close, candleTime: candle.openTime, wickBps, validForCandles: input.validForCandles, proof: input.proof }));
        }
      }
    }
  }
  return dedupeBy(sweeps, (sweep) => sweep.sweepId);
}

function makeSweep(input: {
  symbol: string;
  timeframe: SweepDiagnosticsTimeframe;
  side: 'SELL_SIDE' | 'BUY_SIDE';
  referenceLevel: number;
  referenceType: 'LOCAL_HIGH' | 'LOCAL_LOW';
  sweptExtreme: number;
  closeBackPrice: number;
  candleTime: number;
  wickBps: number;
  validForCandles: number;
  proof: SmartMoneyProof;
}): LiquiditySweepEvidence {
  return {
    sweepId: `${input.symbol}:${input.timeframe}:SWEEP:${input.side}:${input.candleTime}:${roundPrice(input.referenceLevel)}`,
    symbol: input.symbol,
    sourceTimeframe: input.timeframe,
    side: input.side,
    referenceLevel: input.referenceLevel,
    referenceType: input.referenceType,
    sweptExtreme: input.sweptExtreme,
    closeBackPrice: input.closeBackPrice,
    wickExtensionPct: input.wickBps / 100,
    closeBackPct: Math.abs(input.closeBackPrice - input.referenceLevel) / input.referenceLevel,
    detectedAt: input.candleTime,
    detectedCandleTime: input.candleTime,
    rejectionConfirmed: true,
    followedByChoCh: false,
    freshness: 'FRESH',
    validForCandles: input.validForCandles,
    expiresAt: input.candleTime + input.validForCandles * timeframeMs(input.timeframe),
    proof: input.proof,
  };
}

function refreshSweep(sweep: LiquiditySweepEvidence, cursorMs: number): LiquiditySweepEvidence {
  if (cursorMs <= sweep.expiresAt) return sweep;
  return { ...sweep, freshness: 'STALE', staleReason: 'TTL_EXPIRED' };
}

function buildLiquidityPools(input: {
  symbol: string;
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  proof: SmartMoneyProof;
}): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  for (const [timeframe, candles] of Object.entries(input.candlesByTimeframe) as Array<[Timeframe, SmartMoneyCandle[] | undefined]>) {
    const latest = candles?.at(-1);
    if (latest === undefined) continue;
    pools.push({
      poolId: `${input.symbol}:${timeframe}:LIQUIDITY_POOL:BUY_SIDE:${latest.openTime}:${roundPrice(latest.high)}`,
      symbol: input.symbol,
      timeframe,
      type: 'BUY_SIDE',
      source: 'SWING',
      level: latest.high,
      createdAt: latest.openTime,
      availableFrom: latest.openTime,
      state: 'ACTIVE',
      strength: 'LOW',
      proof: input.proof,
    });
    pools.push({
      poolId: `${input.symbol}:${timeframe}:LIQUIDITY_POOL:SELL_SIDE:${latest.openTime}:${roundPrice(latest.low)}`,
      symbol: input.symbol,
      timeframe,
      type: 'SELL_SIDE',
      source: 'SWING',
      level: latest.low,
      createdAt: latest.openTime,
      availableFrom: latest.openTime,
      state: 'ACTIVE',
      strength: 'LOW',
      proof: input.proof,
    });
  }
  return pools;
}

function deriveStructure(candles: SmartMoneyCandle[]): SmartMoneyStructure {
  const highs = candles.slice(-20).map((candle) => candle.high);
  const lows = candles.slice(-20).map((candle) => candle.low);
  const last = candles.at(-1);
  const prev = candles.at(-2);
  if (last === undefined) return { trend: 'UNCLEAR' };
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const result: SmartMoneyStructure = {
    trend: 'RANGE',
    range: { high, low, midpoint: midpointOf(low, high) },
    lastSwingHigh: { price: high, time: last.openTime, confirmedAt: last.openTime },
    lastSwingLow: { price: low, time: last.openTime, confirmedAt: last.openTime },
    protectedHigh: high,
    protectedLow: low,
  };
  if (prev !== undefined && last.close > prev.high) return { ...result, trend: 'BULLISH', lastEvent: 'BOS_BULLISH' };
  if (prev !== undefined && last.close < prev.low) return { ...result, trend: 'BEARISH', lastEvent: 'BOS_BEARISH' };
  return result;
}

function toAoi(zone: SmartMoneyZone, proof: SmartMoneyProof, sweeps: LiquiditySweepEvidence[]): SmartMoneyAOI {
  const relatedSweepIds = sweeps
    .filter((sweep) => sweep.freshness === 'FRESH' && sweep.symbol === zone.symbol)
    .map((sweep) => sweep.sweepId);
  const state = zone.state === 'INVALIDATED'
    ? 'INVALIDATED'
    : zone.state === 'REACTION_CONFIRMED'
      ? 'REACTION_CONFIRMED'
      : zone.state === 'FIRST_RETURN'
        ? 'FIRST_RETURN'
        : zone.state === 'PARTIALLY_MITIGATED'
          ? 'PARTIALLY_MITIGATED'
          : zone.state === 'MITIGATED'
            ? 'MITIGATED'
            : zone.mitigationPct > 0
              ? 'TOUCHED'
              : 'ACTIVE';
  const related: { relatedZoneId: string; relatedSweepIds?: string[] } = { relatedZoneId: zone.zoneId };
  if (relatedSweepIds.length > 0) related.relatedSweepIds = relatedSweepIds;
  return {
    aoiId: `aoi:${zone.zoneId}`,
    sourceId: zone.sourceId,
    zoneId: zone.zoneId,
    symbol: zone.symbol,
    timeframe: zone.timeframe,
    sourceTimeframe: zone.sourceTimeframe,
    type: zone.type,
    side: zone.side,
    zoneLow: zone.zoneLow,
    zoneHigh: zone.zoneHigh,
    midpoint: zone.midpoint,
    state,
    mitigationPct: zone.mitigationPct,
    quality: zone.quality ?? defaultQuality(zone),
    ...related,
    invalidationLevel: zone.side === 'BULLISH' ? zone.zoneLow : zone.zoneHigh,
    warnings: [],
    evidence: relatedSweepIds.length > 0 ? ['FRESH_SWEEP_NEAR_CONTEXT'] : [],
    proof,
  };
}

function buildAlerts(input: {
  symbol: string;
  cursorMs: number;
  activeAois: SmartMoneyAOI[];
  activeSweeps: LiquiditySweepEvidence[];
  reactions: SmartMoneyReactionEvidence[];
  proof: SmartMoneyProof;
}): SmartMoneyAlert[] {
  const alerts: SmartMoneyAlert[] = [];
  for (const aoi of input.activeAois) {
    if (aoi.state === 'FIRST_RETURN') {
      alerts.push(makeAlert({
        symbol: input.symbol,
        timeframe: aoi.timeframe,
        type: aoi.type === 'FVG' ? 'FVG_FIRST_RETURN' : 'OB_PULLBACK_INTO_ZONE',
        status: 'WAIT_FOR_REACTION',
        aoiId: aoi.aoiId,
        ...(aoi.relatedZoneId !== undefined ? { zoneId: aoi.relatedZoneId } : {}),
        createdAt: input.cursorMs,
        message: `${input.symbol} ${aoi.timeframe} ${aoi.type} first return. Context only, not entry.`,
        proof: input.proof,
      }));
    }
    if (aoi.quality.score >= 70) {
      alerts.push(makeAlert({
        symbol: input.symbol,
        timeframe: aoi.timeframe,
        type: 'HIGH_QUALITY_AOI_WATCHABLE',
        status: 'WATCHABLE',
        aoiId: aoi.aoiId,
        ...(aoi.relatedZoneId !== undefined ? { zoneId: aoi.relatedZoneId } : {}),
        createdAt: input.cursorMs,
        message: `${input.symbol} ${aoi.timeframe} high-quality AOI became watchable. Context only, not entry.`,
        proof: input.proof,
      }));
    }
  }
  for (const sweep of input.activeSweeps.filter((item) => item.freshness === 'FRESH')) {
    alerts.push(makeAlert({ symbol: input.symbol, timeframe: sweep.sourceTimeframe, type: sweep.side === 'SELL_SIDE' ? 'SELL_SIDE_SWEEP' : 'BUY_SIDE_SWEEP', status: 'CONTEXT_ONLY', sweepId: sweep.sweepId, createdAt: input.cursorMs, message: `${input.symbol} ${sweep.sourceTimeframe} ${sweep.side.toLowerCase().replace('_', '-')} liquidity swept. Context only, not entry.`, proof: input.proof }));
  }
  for (const reaction of input.reactions) {
    alerts.push(makeAlert({
      symbol: input.symbol,
      timeframe: reaction.timeframe,
      type: 'REACTION_CONFIRMED',
      status: 'REACTION_CONFIRMED',
      aoiId: reaction.aoiId,
      ...(reaction.zoneId !== undefined ? { zoneId: reaction.zoneId } : {}),
      createdAt: input.cursorMs,
      message: `${input.symbol} ${reaction.timeframe} zone reaction confirmed. Context only, not entry.`,
      proof: input.proof,
    }));
  }
  return dedupeBy(alerts, (alert) => alert.alertId);
}

function buildSnapshot(input: {
  symbol: string;
  cursorMs: number;
  proof: SmartMoneyProof;
  validationCandles: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  structures: Partial<Record<Timeframe, SmartMoneyStructure>>;
  zones: SmartMoneyZone[];
  liquidityPools: LiquidityPool[];
  activeSweeps: LiquiditySweepEvidence[];
  activeAois: SmartMoneyAOI[];
  reactions: SmartMoneyReactionEvidence[];
  alerts: SmartMoneyAlert[];
}): SmartMoneyIndicatorOutput {
  const fvgs = input.zones.filter((zone): zone is SmartMoneyFvgZone => zone.type === 'FVG');
  const orderBlocks = input.zones.filter((zone): zone is SmartMoneyOrderBlockZone => zone.type === 'ORDER_BLOCK');
  const timeframes: Partial<Record<Timeframe, SmartMoneyTimeframeState>> = {};
  for (const [timeframe, candles] of Object.entries(input.validationCandles) as Array<[Timeframe, SmartMoneyCandle[] | undefined]>) {
    const latestClosedCandleTime = candles?.at(-1)?.openTime ?? 0;
    timeframes[timeframe] = {
      timeframe,
      structure: input.structures[timeframe] ?? { trend: 'UNCLEAR' },
      activeAois: input.activeAois.filter((aoi) => aoi.timeframe === timeframe),
      zones: {
        fvgs: fvgs.filter((zone) => zone.timeframe === timeframe),
        orderBlocks: orderBlocks.filter((zone) => zone.timeframe === timeframe),
      },
      liquidity: {
        pools: input.liquidityPools.filter((pool) => pool.timeframe === timeframe),
        sweeps: input.activeSweeps.filter((sweep) => sweep.sourceTimeframe === timeframe),
      },
      reactions: input.reactions.filter((reaction) => reaction.timeframe === timeframe),
      latestClosedCandleTime,
      proof: input.proof,
    };
  }
  const bestBullish = input.activeAois.filter((aoi) => aoi.side === 'BULLISH').sort((a, b) => b.quality.score - a.quality.score).at(0);
  const bestBearish = input.activeAois.filter((aoi) => aoi.side === 'BEARISH').sort((a, b) => b.quality.score - a.quality.score).at(0);
  const status = resolveStatus(input.activeAois, input.reactions);
  const mtfSummary: SmartMoneyIndicatorOutput['mtfSummary'] = {
    bias: resolveBias(input.activeAois),
    status,
    conflicts: [],
    notes: ['SMI output is context-only and never confirms entries or runtime actions.'],
  };
  if (bestBullish !== undefined) mtfSummary.bestBullishAoiId = bestBullish.aoiId;
  if (bestBearish !== undefined) mtfSummary.bestBearishAoiId = bestBearish.aoiId;
  return {
    symbol: input.symbol,
    timestamp: input.cursorMs,
    cursorMs: input.cursorMs,
    timeframes,
    mtfSummary,
    activeAois: input.activeAois,
    zones: { fvgs, orderBlocks },
    liquidity: { pools: input.liquidityPools, recentSweeps: input.activeSweeps },
    reactions: input.reactions,
    alerts: input.alerts,
    proof: input.proof,
  };
}

function buildDiagnostics(input: {
  cursorMs: number;
  proof: SmartMoneyProof;
  validation: ReturnType<typeof validateClosedCandles>;
  zones: SmartMoneyZone[];
}): SmartMoneyDiagnosticsReport {
  const malformedZones = input.zones.filter((zone) => !zone.zoneId || zone.zoneLow >= zone.zoneHigh || !Number.isFinite(zone.midpoint)).length;
  const safety = input.validation.formingCandles === 0 && input.validation.lookaheadCandles === 0 && malformedZones === 0 ? 'PASS' : 'FAIL';
  return {
    cursorMs: input.cursorMs,
    safety,
    violations: {
      formingCandles: input.validation.formingCandles,
      lookahead: input.validation.lookaheadCandles,
      malformedZones,
      unstableZoneIds: 0,
      forbiddenTradingFields: 0,
    },
    warnings: input.proof.warnings,
    proof: input.proof,
  };
}

function makeAlert(input: {
  symbol: string;
  timeframe: Timeframe;
  type: SmartMoneyAlert['type'];
  status: SmartMoneyStatus;
  aoiId?: string;
  zoneId?: string;
  sweepId?: string;
  message: string;
  createdAt: number;
  proof: SmartMoneyProof;
}): SmartMoneyAlert {
  return {
    alertId: `${input.symbol}:${input.timeframe}:${input.type}:${input.aoiId ?? input.zoneId ?? input.sweepId ?? input.createdAt}`,
    symbol: input.symbol,
    timeframe: input.timeframe,
    type: input.type,
    status: input.status,
    ...(input.aoiId !== undefined ? { aoiId: input.aoiId } : {}),
    ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
    ...(input.sweepId !== undefined ? { sweepId: input.sweepId } : {}),
    message: input.message,
    createdAt: input.createdAt,
    proof: input.proof,
  };
}

function makeEvent(input: {
  symbol: string;
  timeframe: Timeframe;
  cursorMs: number;
  type: SmartMoneyEvent['type'];
  proof: SmartMoneyProof;
  details: Record<string, unknown>;
  zoneId?: string;
  sweepId?: string;
}): SmartMoneyEvent {
  return {
    eventId: `${input.type}:${input.zoneId ?? input.sweepId ?? input.timeframe}:${input.cursorMs}`,
    symbol: input.symbol,
    timeframe: input.timeframe,
    timestamp: input.cursorMs,
    cursorMs: input.cursorMs,
    type: input.type,
    ...(input.zoneId !== undefined ? { zoneId: input.zoneId } : {}),
    ...(input.sweepId !== undefined ? { sweepId: input.sweepId } : {}),
    details: input.details,
    proof: input.proof,
  };
}

function pushEventOnce(events: SmartMoneyEvent[], previousEventIds: Set<string>, event: SmartMoneyEvent): void {
  if (previousEventIds.has(event.eventId)) return;
  if (events.some((existing) => existing.eventId === event.eventId)) return;
  events.push(event);
}

function buildZoneId(symbol: string, timeframe: Timeframe, zoneType: 'FVG' | 'ORDER_BLOCK', side: 'BULLISH' | 'BEARISH', createdAt: number, zoneLow: number, zoneHigh: number): string {
  return buildStableZoneId({ symbol, timeframe, zoneType, side, createdAt, zoneLow, zoneHigh });
}

function calculateMitigationPct(zone: { side: 'BULLISH' | 'BEARISH'; zoneLow: number; zoneHigh: number }, candle: SmartMoneyCandle): number {
  if (zone.side === 'BULLISH') {
    if (candle.low > zone.zoneHigh) return 0;
    const depth = zone.zoneHigh - Math.max(candle.low, zone.zoneLow);
    return clamp((depth / (zone.zoneHigh - zone.zoneLow)) * 100, 0, 100);
  }
  if (candle.high < zone.zoneLow) return 0;
  const depth = Math.min(candle.high, zone.zoneHigh) - zone.zoneLow;
  return clamp((depth / (zone.zoneHigh - zone.zoneLow)) * 100, 0, 100);
}

function withQuality<T extends SmartMoneyZone>(zone: T): T {
  return { ...zone, quality: defaultQuality(zone) };
}

function defaultQuality(zone: SmartMoneyZone): SmartMoneyQuality {
  const invalid = zone.state === 'INVALIDATED';
  const reaction = zone.state === 'REACTION_CONFIRMED';
  const base = invalid ? 0 : reaction ? 75 : zone.mitigationPct > 0 ? 60 : 45;
  return {
    score: base,
    verdict: invalid ? 'INVALID' : reaction ? 'REACTION_CONFIRMED' : base >= 60 ? 'WATCHABLE' : 'WAIT_FOR_REACTION',
    components: {
      structureAlignment: 10,
      htfConfluence: 0,
      zoneFreshness: invalid ? 0 : 15,
      displacementQuality: 10,
      mitigationQuality: zone.mitigationPct > 0 ? 15 : 5,
      liquiditySweepQuality: 0,
      reactionQuality: reaction ? 25 : 0,
      conflictPenalty: 0,
      staleEvidencePenalty: 0,
      invalidationPenalty: invalid ? 100 : 0,
    },
    warnings: [],
    penalties: invalid ? ['INVALIDATED_ZONE'] : [],
    evidence: [zone.type, zone.side],
  };
}

function orderBlockBounds(candle: SmartMoneyCandle, policy: SmartMoneyEngineConfig['orderBlock']['zonePolicy'], side: 'BULLISH' | 'BEARISH'): { zoneLow: number; zoneHigh: number } {
  if (policy === 'BODY') {
    return { zoneLow: Math.min(candle.open, candle.close), zoneHigh: Math.max(candle.open, candle.close) };
  }
  if (policy === 'BODY_PLUS_WICK_BUFFER') {
    const bodyLow = Math.min(candle.open, candle.close);
    const bodyHigh = Math.max(candle.open, candle.close);
    const wickBuffer = side === 'BULLISH' ? bodyLow - candle.low : candle.high - bodyHigh;
    return side === 'BULLISH'
      ? { zoneLow: bodyLow - wickBuffer, zoneHigh: bodyHigh }
      : { zoneLow: bodyLow, zoneHigh: bodyHigh + wickBuffer };
  }
  return { zoneLow: candle.low, zoneHigh: candle.high };
}

function resolveStatus(aois: SmartMoneyAOI[], reactions: SmartMoneyReactionEvidence[]): SmartMoneyStatus {
  if (aois.length === 0) return 'NO_CONTEXT';
  if (reactions.length > 0) return 'REACTION_CONFIRMED';
  if (aois.some((aoi) => aoi.quality.score >= 60)) return 'WATCHABLE';
  return 'CONTEXT_ONLY';
}

function resolveBias(aois: SmartMoneyAOI[]): SmartMoneyIndicatorOutput['mtfSummary']['bias'] {
  const bullish = aois.filter((aoi) => aoi.side === 'BULLISH').length;
  const bearish = aois.filter((aoi) => aoi.side === 'BEARISH').length;
  if (bullish > 0 && bearish > 0) return 'MIXED';
  if (bullish > 0) return 'BULLISH';
  if (bearish > 0) return 'BEARISH';
  return 'NEUTRAL';
}

function midpointOf(low: number, high: number): number {
  return (low + high) / 2;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundPrice(value: number): string {
  return Number(value.toFixed(8)).toString();
}

function timeframeMs(timeframe: Timeframe): number {
  if (timeframe === '1m') return 60_000;
  if (timeframe === '3m') return 180_000;
  if (timeframe === '5m') return 300_000;
  if (timeframe === '15m') return 900_000;
  if (timeframe === '30m') return 1_800_000;
  if (timeframe === '1h') return 3_600_000;
  return 14_400_000;
}

function dedupeBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
