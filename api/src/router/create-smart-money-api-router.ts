import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  createSmartMoneyEngine,
  type EvaluateSmartMoneyResult,
  type SmartMoneyCandle,
  type SmartMoneyEngine,
  type SmartMoneyEngineConfig,
  type Timeframe,
} from '@trader-agent/smart-money-indicator-core';
import type { SmartMoneyCandleProvider } from '../providers/candle-provider.types.js';
import type { SmartMoneyStateStore } from '../providers/state-store.types.js';

const VALID_TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h'];
const DEFAULT_LOOKBACK: Partial<Record<Timeframe, number>> = {
  '1m': 300,
  '5m': 300,
  '15m': 300,
  '1h': 300,
  '4h': 300,
};

export type CreateSmartMoneyApiRouterInput = {
  candleProvider: SmartMoneyCandleProvider;
  engine?: SmartMoneyEngine;
  config?: SmartMoneyEngineConfig;
  stateStore?: SmartMoneyStateStore;
  defaultLookback?: Partial<Record<Timeframe, number>>;
};

export function createSmartMoneyApiRouter(input: CreateSmartMoneyApiRouterInput): Router {
  const router = Router();
  const engine = input.engine ?? createSmartMoneyEngine(input.config);
  const lookback = { ...DEFAULT_LOOKBACK, ...input.defaultLookback };

  async function evaluate(req: Request): Promise<EvaluateSmartMoneyResult> {
    const symbol = normalizeSymbol(req.params['symbol']);
    const cursorMs = parseCursorMs(req.query['cursorMs']);
    const candlesByTimeframe = await loadCandles({
      symbol,
      cursorMs,
      candleProvider: input.candleProvider,
      lookback,
    });
    const previousState = await input.stateStore?.getState(symbol);
    const result = previousState === undefined || previousState === null
      ? engine.evaluate({ symbol, cursorMs, candlesByTimeframe, mode: 'STATELESS_REBUILD' })
      : engine.evaluate({ symbol, cursorMs, candlesByTimeframe, mode: 'INCREMENTAL', previousState });
    await input.stateStore?.saveState(symbol, result.nextState);
    return result;
  }

  router.get('/smi/v1/snapshot/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot });
  }));

  router.get('/smi/v1/timeframe/:symbol/:timeframe', asyncHandler(async (req, res) => {
    const timeframe = parseTimeframe(req.params['timeframe']);
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.timeframes[timeframe] ?? null });
  }));

  router.get('/smi/v1/aoi/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.activeAois });
  }));

  router.get('/smi/v1/fvg/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.zones.fvgs });
  }));

  router.get('/smi/v1/order-blocks/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.zones.orderBlocks });
  }));

  router.get('/smi/v1/liquidity-pools/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.liquidity.pools });
  }));

  router.get('/smi/v1/sweeps/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.liquidity.recentSweeps });
  }));

  router.get('/smi/v1/reactions/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.reactions });
  }));

  router.get('/smi/v1/alerts/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.alerts });
  }));

  router.get('/debug/smi/v1/zone/:zoneId', asyncHandler(async (req, res) => {
    const zoneId = req.params['zoneId'] ?? '';
    const symbol = parseSymbolFromId(zoneId);
    const state = symbol !== undefined ? await input.stateStore?.getState(symbol) : null;
    res.json({ ok: true, data: state?.zoneRegistry.zonesById[zoneId] ?? null });
  }));

  router.get('/debug/smi/v1/aoi/:aoiId', asyncHandler(async (req, res) => {
    const aoiId = req.params['aoiId'] ?? '';
    const symbol = parseSymbolFromId(aoiId.replace(/^aoi:/, ''));
    const state = symbol !== undefined ? await input.stateStore?.getState(symbol) : null;
    res.json({ ok: true, data: state?.activeAois.find((aoi) => aoi.aoiId === aoiId) ?? null });
  }));

  router.get('/debug/smi/v1/events/:symbol', asyncHandler(async (req, res) => {
    const symbol = normalizeSymbol(req.params['symbol']);
    const limit = parseLimit(req.query['limit'], 1000);
    const stored = await input.stateStore?.getEvents?.({ symbol, limit });
    if (stored !== undefined) {
      res.json({ ok: true, data: stored });
      return;
    }
    const state = await input.stateStore?.getState(symbol);
    res.json({ ok: true, data: (state?.eventLog ?? []).slice(-limit) });
  }));

  router.get('/debug/smi/v1/violations/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.diagnostics.violations });
  }));

  router.get('/debug/smi/v1/registry/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.nextState.zoneRegistry });
  }));

  router.get('/debug/smi/v1/proof/:symbol', asyncHandler(async (req, res) => {
    const result = await evaluate(req);
    res.json({ ok: true, data: result.snapshot.proof });
  }));

  return router;
}

async function loadCandles(input: {
  symbol: string;
  cursorMs: number;
  candleProvider: SmartMoneyCandleProvider;
  lookback: Partial<Record<Timeframe, number>>;
}): Promise<Partial<Record<Timeframe, SmartMoneyCandle[]>>> {
  const entries = await Promise.all(VALID_TIMEFRAMES.map(async (timeframe) => {
    const candles = await input.candleProvider.getClosedCandles({
      symbol: input.symbol,
      timeframe,
      limit: input.lookback[timeframe] ?? 300,
      beforeOrAt: input.cursorMs,
    });
    return [timeframe, candles] as const;
  }));
  return Object.fromEntries(entries) as Partial<Record<Timeframe, SmartMoneyCandle[]>>;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

function normalizeSymbol(value: string | undefined): string {
  const symbol = (value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,30}$/.test(symbol)) {
    throw httpError(400, 'INVALID_SYMBOL', 'Invalid symbol');
  }
  return symbol;
}

function parseTimeframe(value: string | undefined): Timeframe {
  if (value !== undefined && VALID_TIMEFRAMES.includes(value as Timeframe)) return value as Timeframe;
  throw httpError(400, 'INVALID_TIMEFRAME', `timeframe must be one of: ${VALID_TIMEFRAMES.join(', ')}`);
}

function parseCursorMs(value: unknown): number {
  if (value === undefined || value === null || value === '') return Date.now();
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw httpError(400, 'INVALID_CURSOR_MS', 'cursorMs must be a positive timestamp');
  return parsed;
}

function parseLimit(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10_000) throw httpError(400, 'INVALID_LIMIT', 'limit must be an integer between 1 and 10000');
  return parsed;
}

function parseSymbolFromId(id: string): string | undefined {
  const first = id.split(':')[0];
  if (first === undefined || first.length === 0) return undefined;
  return normalizeSymbol(first);
}

function httpError(statusCode: number, code: string, message: string): Error {
  const error = new Error(message) as Error & { statusCode: number; code: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
