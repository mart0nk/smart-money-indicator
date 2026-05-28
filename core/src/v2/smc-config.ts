import type { SmartMoneyConfig, SmartMoneyConfigInput, SmartMoneyRollingConfig } from './smc-core.types.js';

export const defaultSmartMoneyConfig: SmartMoneyConfig = {
  version: 'smi-config-v2',
  sourceZoneTimeframes: ['4h', '1h', '30m', '15m'],
  sweepTimeframes: ['15m', '5m', '3m'],
  forbiddenSourceZoneTimeframes: ['5m', '3m', '1m'],
  strictMode: true,
  fvg: {
    minGapBps: 1,
    quality: {
      atrPeriod: 14,
      minGapBpsForAcceptable: 1,
      displacement: {
        minBodyToRangeRatio: 0.6,
        minRangeAtrMultiple: 1.2,
        bullishMinCloseLocationPct: 0.7,
        bearishMaxCloseLocationPct: 0.3,
      },
      structure: {
        maxCandlesAfterBos: 3,
      },
      barriers: {
        maxDistancePct: 0.25,
      },
    },
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

export function resolveSmartMoneyConfig(input?: SmartMoneyConfigInput): SmartMoneyConfig {
  return {
    ...defaultSmartMoneyConfig,
    ...input,
    fvg: {
      ...defaultSmartMoneyConfig.fvg,
      ...input?.fvg,
      quality: {
        ...defaultSmartMoneyConfig.fvg.quality,
        ...input?.fvg?.quality,
        displacement: {
          ...defaultSmartMoneyConfig.fvg.quality.displacement,
          ...input?.fvg?.quality?.displacement,
        },
        structure: {
          ...defaultSmartMoneyConfig.fvg.quality.structure,
          ...input?.fvg?.quality?.structure,
        },
        barriers: {
          ...defaultSmartMoneyConfig.fvg.quality.barriers,
          ...input?.fvg?.quality?.barriers,
        },
      },
    },
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
