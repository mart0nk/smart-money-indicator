import type { SmartMoneyEngineConfig } from '../types/index.js';

export const DEFAULT_SMART_MONEY_ENGINE_CONFIG: SmartMoneyEngineConfig = {
  timeframes: ['15m', '5m', '1h', '4h'],
  timeframeRoles: {
    '1m': 'MICRO_CONFIRMATION',
    '5m': 'SWEEP_REACTION',
    '15m': 'CORE_AOI',
    '1h': 'HTF_CONTEXT',
    '4h': 'HTF_CONTEXT',
  },
  structure: {
    swingPivotLeft: 2,
    swingPivotRight: 2,
    bosBreakMode: 'CLOSE_BEYOND_SWING',
    chochBreakMode: 'CLOSE_BEYOND_SWING',
    requireSweepBeforeMss: true,
  },
  fvg: {
    impulseRule: 'CANDLE_COLOR',
    requireDisplacementCandle: false,
    rejectTinyFvg: true,
    minGapBps: 1,
    maxActiveZonesPerTimeframe: 40,
  },
  orderBlock: {
    zonePolicy: 'FULL_WICK',
    requireConfirmedBos: true,
    originCandlePolicy: 'LAST_OPPOSITE_BEFORE_BOS',
    requireBos: false,
    requireDisplacement: false,
    maxCandlesBackFromBos: 5,
    allowMultipleOriginCandles: false,
  },
  sweeps: {
    validForCandles: 12,
    minWickExtensionBps: 1,
    requireConfirmedSwing: true,
    requireCloseBack: true,
  },
};

export const SMART_MONEY_LEGACY_COMPAT_CONFIG: SmartMoneyEngineConfig = {
  ...DEFAULT_SMART_MONEY_ENGINE_CONFIG,
  fvg: {
    ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.fvg,
    impulseRule: 'CANDLE_COLOR',
    requireDisplacementCandle: true,
  },
  orderBlock: {
    ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.orderBlock,
    requireConfirmedBos: true,
    originCandlePolicy: 'LAST_OPPOSITE_BEFORE_BOS',
    maxCandlesBackFromBos: 5,
  },
  sweeps: {
    ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.sweeps,
    requireConfirmedSwing: true,
    requireCloseBack: true,
  },
};

export function mergeSmartMoneyConfig(input?: Partial<SmartMoneyEngineConfig>): SmartMoneyEngineConfig {
  return {
    ...DEFAULT_SMART_MONEY_ENGINE_CONFIG,
    ...input,
    timeframeRoles: {
      ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.timeframeRoles,
      ...input?.timeframeRoles,
    },
    structure: {
      ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.structure,
      ...input?.structure,
    },
    fvg: {
      ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.fvg,
      ...input?.fvg,
    },
    orderBlock: {
      ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.orderBlock,
      ...input?.orderBlock,
    },
    sweeps: {
      ...DEFAULT_SMART_MONEY_ENGINE_CONFIG.sweeps,
      ...input?.sweeps,
    },
  };
}
