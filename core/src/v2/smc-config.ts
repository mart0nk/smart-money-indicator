import type { SmartMoneyConfig, SmartMoneyRollingConfig } from './smc-core.types.js';

export const defaultSmartMoneyConfig: SmartMoneyConfig = {
  version: 'smi-config-v2',
  sourceZoneTimeframes: ['4h', '1h', '30m', '15m'],
  sweepTimeframes: ['15m', '5m', '3m'],
  forbiddenSourceZoneTimeframes: ['5m', '3m', '1m'],
  strictMode: true,
  fvg: {
    minGapBps: 1,
  },
  orderBlock: {
    requireBos: true,
    requireConfirmedBos: true,
    requireDisplacement: true,
    boundsPolicy: 'WICK',
  },
  sweeps: {
    validForCandles: 12,
    minWickExtensionBps: 1,
  },
};

export const defaultSmartMoneyRollingConfig: SmartMoneyRollingConfig = {
  ...defaultSmartMoneyConfig,
  bufferSizes: {
    sourceZoneTimeframes: {
      '4h': 200,
      '1h': 300,
      '30m': 300,
      '15m': 500,
    },
    sweepTimeframes: {
      '15m': 300,
      '5m': 500,
      '3m': 500,
    },
  },
};

export function resolveSmartMoneyConfig(input?: Partial<SmartMoneyConfig>): SmartMoneyConfig {
  return {
    ...defaultSmartMoneyConfig,
    ...input,
    fvg: { ...defaultSmartMoneyConfig.fvg, ...input?.fvg },
    orderBlock: { ...defaultSmartMoneyConfig.orderBlock, ...input?.orderBlock },
    sweeps: { ...defaultSmartMoneyConfig.sweeps, ...input?.sweeps },
  };
}

export function resolveRollingConfig(input?: Partial<SmartMoneyRollingConfig>): SmartMoneyRollingConfig {
  const base = resolveSmartMoneyConfig(input);
  return {
    ...defaultSmartMoneyRollingConfig,
    ...base,
    ...input,
    fvg: base.fvg,
    orderBlock: base.orderBlock,
    sweeps: base.sweeps,
    bufferSizes: {
      sourceZoneTimeframes: {
        ...defaultSmartMoneyRollingConfig.bufferSizes.sourceZoneTimeframes,
        ...input?.bufferSizes?.sourceZoneTimeframes,
      },
      sweepTimeframes: {
        ...defaultSmartMoneyRollingConfig.bufferSizes.sweepTimeframes,
        ...input?.bufferSizes?.sweepTimeframes,
      },
    },
  };
}
