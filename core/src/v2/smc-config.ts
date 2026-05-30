import type { SmartMoneyConfig, SmartMoneyConfigInput, SmartMoneyRollingConfig } from './smc-core.types.js';

export const defaultSmartMoneyConfig: SmartMoneyConfig = {
  version: 'smi-config-v2',
  sourceZoneTimeframes: ['4h', '1h', '30m', '15m'],
  sweepTimeframes: ['15m', '5m', '3m'],
  forbiddenSourceZoneTimeframes: ['5m', '3m', '1m'],
  strictMode: true,
  fvg: {
    enabled: true,
    detectTinyGaps: true,
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
    enabled: true,
    requireBos: true,
    requireConfirmedBos: true,
    allowChoch: false,
    requireDisplacement: true,
    originPolicy: 'LAST_OPPOSITE_BEFORE_BOS',
    maxCandlesBackFromBos: 5,
    boundsPolicy: 'WICK',
    minQualityGrade: 'LOW',
    invalidation: {
      mode: 'CLOSE_THROUGH',
      bufferBps: 0,
    },
  },
  sweeps: {
    enabled: true,
    validForCandles: 12,
    minWickExtensionBps: 1,
    requireCloseReclaim: true,
    liquidityLevel: {
      swingLeft: 2,
      swingRight: 2,
      minTouchesForEqualHighLow: 2,
      equalLevelToleranceBps: 5,
    },
    significance: {
      usePivotDepth: true,
      minSignificance: 'LOW',
    },
  },
  reaction: {
    requireCloseAwayFromZone: true,
    minReactionBodyAtr: 0.25,
    minReactionRangeAtr: 0.4,
    requireNoInvalidationAfterTouch: true,
  },
  evidence: {
    requireZoneScopedSweeps: true,
    maxSweepDistanceBps: 20,
    rejectSideIncompatibleSweeps: true,
  },
  safety: {
    requireClosedCandlesOnly: true,
    requireAvailableFrom: true,
    rejectFutureData: true,
  },
};

export const primitiveResearchConfig: SmartMoneyConfig = {
  ...defaultSmartMoneyConfig,
  version: 'smi-config-v2-primitive-research',
  fvg: {
    ...defaultSmartMoneyConfig.fvg,
    detectTinyGaps: true,
    minGapBps: 1,
    quality: {
      ...defaultSmartMoneyConfig.fvg.quality,
      minGapBpsForAcceptable: 1,
    },
  },
  orderBlock: {
    ...defaultSmartMoneyConfig.orderBlock,
    boundsPolicy: 'WICK',
    minQualityGrade: 'LOW',
  },
  sweeps: {
    ...defaultSmartMoneyConfig.sweeps,
    minWickExtensionBps: 1,
    validForCandles: 12,
    significance: {
      ...defaultSmartMoneyConfig.sweeps.significance,
      minSignificance: 'LOW',
    },
  },
};

export const standardSmartMoneyConfig: SmartMoneyConfig = {
  ...defaultSmartMoneyConfig,
  version: 'smi-config-v2-standard',
  fvg: {
    ...defaultSmartMoneyConfig.fvg,
    detectTinyGaps: false,
    minGapBps: 3,
    quality: {
      ...defaultSmartMoneyConfig.fvg.quality,
      minGapBpsForAcceptable: 3,
      minGapAtrMultipleForAcceptable: 0.15,
      displacement: {
        ...defaultSmartMoneyConfig.fvg.quality.displacement,
        minBodyToRangeRatio: 0.6,
      },
    },
  },
  orderBlock: {
    ...defaultSmartMoneyConfig.orderBlock,
    minDisplacementAtr: 0.5,
    maxCandlesBackFromBos: 3,
    boundsPolicy: 'HYBRID',
    minOriginBodyAtr: 0.15,
    minQualityGrade: 'MEDIUM',
  },
  sweeps: {
    ...defaultSmartMoneyConfig.sweeps,
    minWickExtensionBps: 3,
    minWickExtensionAtr: 0.05,
    validForCandles: 8,
    significance: {
      ...defaultSmartMoneyConfig.sweeps.significance,
      minSignificance: 'MEDIUM',
    },
  },
};

export const strictCryptoIntradayConfig: SmartMoneyConfig = {
  ...standardSmartMoneyConfig,
  version: 'smi-config-v2-strict-crypto-intraday',
  fvg: {
    ...standardSmartMoneyConfig.fvg,
    detectTinyGaps: false,
    minGapBps: 5,
    quality: {
      ...standardSmartMoneyConfig.fvg.quality,
      minGapBpsForAcceptable: 5,
      minGapAtrMultipleForAcceptable: 0.25,
      displacement: {
        ...standardSmartMoneyConfig.fvg.quality.displacement,
        minRangeAtrMultiple: 1.2,
        bullishMinCloseLocationPct: 0.65,
        bearishMaxCloseLocationPct: 0.35,
      },
    },
  },
  orderBlock: {
    ...standardSmartMoneyConfig.orderBlock,
    allowChoch: true,
    minDisplacementAtr: 0.75,
    boundsPolicy: 'HYBRID',
    minOriginBodyAtr: 0.25,
    minQualityGrade: 'MEDIUM',
    invalidation: {
      mode: 'CLOSE_THROUGH',
      bufferBps: 2,
    },
  },
  sweeps: {
    ...standardSmartMoneyConfig.sweeps,
    minWickExtensionBps: 3,
    minWickExtensionAtr: 0.1,
    validForCandles: 8,
    significance: {
      ...standardSmartMoneyConfig.sweeps.significance,
      minSignificance: 'MEDIUM',
    },
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
    orderBlock: {
      ...defaultSmartMoneyConfig.orderBlock,
      ...input?.orderBlock,
      invalidation: {
        ...defaultSmartMoneyConfig.orderBlock.invalidation,
        ...input?.orderBlock?.invalidation,
      },
    },
    sweeps: {
      ...defaultSmartMoneyConfig.sweeps,
      ...input?.sweeps,
      liquidityLevel: {
        ...defaultSmartMoneyConfig.sweeps.liquidityLevel,
        ...input?.sweeps?.liquidityLevel,
      },
      significance: {
        ...defaultSmartMoneyConfig.sweeps.significance,
        ...input?.sweeps?.significance,
      },
    },
    reaction: { ...defaultSmartMoneyConfig.reaction, ...input?.reaction },
    evidence: { ...defaultSmartMoneyConfig.evidence, ...input?.evidence },
    safety: { ...defaultSmartMoneyConfig.safety, ...input?.safety },
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
