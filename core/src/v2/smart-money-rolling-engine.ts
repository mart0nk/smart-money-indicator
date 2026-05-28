import { resolveRollingConfig } from './smc-config.js';
import { isAcceptedClosedCandle, runSmartMoneyEngine } from './smart-money-engine.js';
import type {
  Candle,
  SmcEngineViolation,
  SmcInputTimeframe,
  SmartMoneyBufferDiagnostics,
  SmartMoneyEngineOutput,
  SmartMoneyResetScope,
  SmartMoneyRollingConfig,
  SmartMoneyRollingEngine,
  SmartMoneyRollingUpdate,
  SmartMoneySnapshotInput,
  Timeframe,
} from './smc-core.types.js';

type BufferEntry = {
  candles: Candle[];
  lastCursorMs?: number;
  droppedCandles: number;
  duplicateCandles: number;
  rejectedFutureCandles: number;
  rejectedFormingCandles: number;
  rejectedMalformedCandles: number;
};

export function createSmartMoneyRollingEngine(
  inputConfig?: Partial<SmartMoneyRollingConfig>,
): SmartMoneyRollingEngine {
  const rollingConfig = resolveRollingConfig(inputConfig);
  const buffers = new Map<string, Map<SmcInputTimeframe, BufferEntry>>();

  return {
    update(input) {
      const updateViolations: SmcEngineViolation[] = [];
      const symbol = input.symbol.toUpperCase();
      const symbolBuffer = getSymbolBuffer(buffers, symbol);
      for (const [rawTimeframe, incoming] of Object.entries(input.closedCandlesByTimeframe)) {
        const timeframe = rawTimeframe as SmcInputTimeframe;
        const entry = getEntry(symbolBuffer, timeframe);
        entry.lastCursorMs = input.cursorMs;
        for (const candle of incoming ?? []) {
          if (!isAcceptedClosedCandle(candle, timeframe, input.cursorMs)) {
            updateViolations.push(rejectionViolation(symbol, timeframe, candle, input.cursorMs));
            incrementRejection(entry, candle, input.cursorMs);
            continue;
          }
          const closeTime = candle.closeTime!;
          if (entry.candles.some((existing) => existing.closeTime === closeTime)) {
            entry.duplicateCandles += 1;
            updateViolations.push({
              code: 'DUPLICATE_CANDLE_IGNORED',
              severity: 'WARN',
              message: `Duplicate ${timeframe} candle at ${closeTime} ignored.`,
              symbol,
              timeframe,
              candleTime: closeTime,
              cursorMs: input.cursorMs,
            });
            continue;
          }
          entry.candles.push({ ...candle, symbol, timeframe });
        }
        entry.candles.sort((a, b) => a.closeTime! - b.closeTime!);
        const max = maxBufferSize(timeframe, rollingConfig);
        if (entry.candles.length > max) {
          const dropped = entry.candles.length - max;
          entry.candles.splice(0, dropped);
          entry.droppedCandles += dropped;
        }
      }
      return withUpdateViolations(evaluateFromBuffer(symbolBuffer, {
        symbol,
        cursorMs: input.cursorMs,
        ...(input.referenceLevels === undefined ? {} : { referenceLevels: input.referenceLevels }),
        ...(input.config === undefined ? {} : { config: input.config }),
      }), updateViolations);
    },
    snapshot(input) {
      const symbolBuffer = buffers.get(input.symbol.toUpperCase()) ?? new Map();
      return evaluateFromBuffer(symbolBuffer, input);
    },
    getBufferState() {
      return diagnostics(buffers);
    },
    reset(scope: SmartMoneyResetScope = { type: 'ALL' }) {
      if (scope.type === 'ALL') {
        buffers.clear();
        return;
      }
      const symbol = scope.symbol.toUpperCase();
      if (scope.type === 'SYMBOL') {
        buffers.delete(symbol);
        return;
      }
      const entries = buffers.get(symbol);
      entries?.delete(scope.timeframe as SmcInputTimeframe);
      if (entries?.size === 0) buffers.delete(symbol);
    },
  };
}

function evaluateFromBuffer(
  buffer: Map<SmcInputTimeframe, BufferEntry>,
  input: SmartMoneySnapshotInput,
): SmartMoneyEngineOutput {
  const candlesByTimeframe: Partial<Record<SmcInputTimeframe, Candle[]>> = {};
  for (const [timeframe, entry] of buffer) {
    candlesByTimeframe[timeframe] = entry.candles.filter((candle) => candle.closeTime! <= input.cursorMs);
  }
  return runSmartMoneyEngine({
    symbol: input.symbol,
    cursorMs: input.cursorMs,
    candlesByTimeframe,
    ...(input.referenceLevels === undefined ? {} : { referenceLevels: input.referenceLevels }),
    ...(input.config === undefined ? {} : { config: input.config }),
  });
}

function withUpdateViolations(output: SmartMoneyEngineOutput, additional: SmcEngineViolation[]): SmartMoneyEngineOutput {
  const ranks: Record<SmcEngineViolation['severity'], number> = { FATAL: 0, ERROR: 1, WARN: 2, INFO: 3 };
  const violations = [...output.violations, ...additional].sort((a, b) =>
    ranks[a.severity] - ranks[b.severity] ||
    a.code.localeCompare(b.code) ||
    (a.timeframe ?? '').localeCompare(b.timeframe ?? '') ||
    (a.candleTime ?? 0) - (b.candleTime ?? 0));
  return {
    ...output,
    valid: output.valid && !additional.some((violation) => violation.severity === 'FATAL'),
    violations,
  };
}

function getSymbolBuffer(
  buffers: Map<string, Map<SmcInputTimeframe, BufferEntry>>,
  symbol: string,
): Map<SmcInputTimeframe, BufferEntry> {
  const existing = buffers.get(symbol);
  if (existing !== undefined) return existing;
  const created = new Map<SmcInputTimeframe, BufferEntry>();
  buffers.set(symbol, created);
  return created;
}

function getEntry(buffer: Map<SmcInputTimeframe, BufferEntry>, timeframe: SmcInputTimeframe): BufferEntry {
  const existing = buffer.get(timeframe);
  if (existing !== undefined) return existing;
  const created: BufferEntry = {
    candles: [],
    droppedCandles: 0,
    duplicateCandles: 0,
    rejectedFutureCandles: 0,
    rejectedFormingCandles: 0,
    rejectedMalformedCandles: 0,
  };
  buffer.set(timeframe, created);
  return created;
}

function maxBufferSize(timeframe: SmcInputTimeframe, config: SmartMoneyRollingConfig): number {
  if (timeframe === '4h' || timeframe === '1h' || timeframe === '30m') {
    return config.bufferSizes.sourceZoneTimeframes[timeframe];
  }
  if (timeframe === '15m') {
    return Math.max(
      config.bufferSizes.sourceZoneTimeframes[timeframe],
      config.bufferSizes.sweepTimeframes[timeframe],
    );
  }
  return config.bufferSizes.sweepTimeframes[timeframe];
}

function incrementRejection(entry: BufferEntry, candle: Candle, cursorMs: number): void {
  if (!candle.closed) {
    entry.rejectedFormingCandles += 1;
  } else if (candle.closeTime !== undefined && candle.closeTime > cursorMs) {
    entry.rejectedFutureCandles += 1;
  } else {
    entry.rejectedMalformedCandles += 1;
  }
}

function rejectionViolation(symbol: string, timeframe: SmcInputTimeframe, candle: Candle, cursorMs: number): SmcEngineViolation {
  if (!candle.closed) {
    return { code: 'FORMING_CANDLE_REJECTED', severity: 'FATAL', message: `Forming ${timeframe} candle rejected.`, symbol, timeframe, candleTime: candle.closeTime ?? candle.openTime, cursorMs };
  }
  if (candle.closeTime !== undefined && candle.closeTime > cursorMs) {
    return { code: 'FUTURE_CANDLE_REJECTED', severity: 'FATAL', message: `Future ${timeframe} candle rejected.`, symbol, timeframe, candleTime: candle.closeTime, cursorMs };
  }
  return { code: 'MALFORMED_CANDLE_REJECTED', severity: 'FATAL', message: `Malformed ${timeframe} candle rejected.`, symbol, timeframe, candleTime: candle.closeTime ?? candle.openTime, cursorMs };
}

function diagnostics(buffers: Map<string, Map<SmcInputTimeframe, BufferEntry>>): SmartMoneyBufferDiagnostics {
  return {
    symbols: [...buffers.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([symbol, entries]) => ({
        symbol,
        timeframes: [...entries.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([timeframe, entry]) => ({
            timeframe: timeframe as Timeframe,
            candleCount: entry.candles.length,
            ...(entry.candles[0]?.closeTime === undefined ? {} : { firstCloseTime: entry.candles[0].closeTime }),
            ...(entry.candles.at(-1)?.closeTime === undefined ? {} : { lastCloseTime: entry.candles.at(-1)!.closeTime }),
            ...(entry.lastCursorMs === undefined ? {} : { lastCursorMs: entry.lastCursorMs }),
            droppedCandles: entry.droppedCandles,
            duplicateCandles: entry.duplicateCandles,
            rejectedFutureCandles: entry.rejectedFutureCandles,
            rejectedFormingCandles: entry.rejectedFormingCandles,
            rejectedMalformedCandles: entry.rejectedMalformedCandles,
          })),
      })),
  };
}
