export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type SmcSourceTimeframe = '4h' | '1h' | '30m' | '15m';
export type Candle = {
  symbol: string;
  timeframe: Timeframe;
  openTime: number;
  closeTime?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
};
export type SweepTimeframe = '15m' | '5m' | '3m';
export type SmcInputTimeframe = SmcSourceTimeframe | SweepTimeframe;
export type SmcSide = 'BULLISH' | 'BEARISH';
export type SmcSweepSide = 'BUY_SIDE_SWEEP' | 'SELL_SIDE_SWEEP';

export type TemporalProvenance = {
  sourceTime: number;
  availableFrom: number;
  observedAt: number;
};

export type LiquidityReferenceLevel = {
  referenceId: string;
  type:
    | 'SWING_HIGH'
    | 'SWING_LOW'
    | 'EQUAL_HIGH'
    | 'EQUAL_LOW'
    | 'PREVIOUS_DAY_HIGH'
    | 'PREVIOUS_DAY_LOW'
    | 'PREVIOUS_WEEK_HIGH'
    | 'PREVIOUS_WEEK_LOW'
    | 'SESSION_HIGH'
    | 'SESSION_LOW'
    | 'ROUND_NUMBER'
    | 'SUPPORT_RESISTANCE'
    | 'AOI_EDGE';
  price: number;
  side: 'BUY_SIDE_LIQUIDITY' | 'SELL_SIDE_LIQUIDITY';
  sourceTimeframe: Timeframe;
  detectedAt: number;
};

export type SmcAoiState =
  | 'AVAILABLE'
  | 'RETURNED'
  | 'MITIGATED'
  | 'REACTION_CONFIRMED'
  | 'INVALIDATED';

export type FvgQualityVerdict = 'STRONG' | 'ACCEPTABLE' | 'WEAK' | 'TRAP_RISK';
export type ZoneQualityGrade = 'LOW' | 'MEDIUM' | 'HIGH';

export type FvgQualityFlag =
  | 'CREATED_WITH_DISPLACEMENT'
  | 'CREATED_WITHOUT_DISPLACEMENT'
  | 'CREATED_AFTER_BOS'
  | 'NO_BOS_CONTEXT'
  | 'TOO_SMALL'
  | 'NEAR_MAJOR_BARRIER';

export type FvgDisplacementMetrics = {
  bodySize: number;
  rangeSize: number;
  bodyToRangeRatio: number;
  rangeAtrMultiple?: number;
  closeLocationPct: number;
  direction: SmcSide;
  passed: boolean;
};

export type FvgSizeMetrics = {
  gapSizeAbs: number;
  gapSizePct: number;
  gapBps: number;
  gapAtrMultiple?: number;
  passedMinSize: boolean;
};

export type FvgStructureContext = {
  formedAfterBos: boolean;
  relatedStructureBreakId?: string;
  candlesAfterBreak?: number;
};

export type FvgNearbyBarrier = {
  referenceId: string;
  type: LiquidityReferenceLevel['type'];
  price: number;
  distancePct: number;
  direction: 'ABOVE' | 'BELOW';
};

export type FvgQualityAssessment = {
  policyVersion: 'fvg-quality-v1';
  verdict: FvgQualityVerdict;
  score: number;
  grade: ZoneQualityGrade;
  reasons: string[];
  penalties: string[];
  displacement: FvgDisplacementMetrics;
  size: FvgSizeMetrics;
  structure: FvgStructureContext;
  nearbyBarriers: FvgNearbyBarrier[];
  flags: FvgQualityFlag[];
};

export type FvgLifecycleMetadata = {
  state: ZoneLifecycleState;
  isFresh: boolean;
  touchCount: number;
  firstTouchedAt?: number;
  midpointTouchedAt?: number;
  lastTouchedAt?: number;
  fullyMitigatedAt?: number;
  deepestMitigationPrice?: number;
  invalidatedAt?: number;
  expiredAt?: number;
  mitigationPct: number;
  terminal: boolean;
};

export type ZoneLifecycleState =
  | 'AVAILABLE'
  | 'FIRST_RETURN'
  | 'PARTIALLY_MITIGATED'
  | 'MITIGATED'
  | 'INVALIDATED'
  | 'EXPIRED';

export type ZoneQuality = {
  score: number;
  grade: ZoneQualityGrade;
  reasons: string[];
  penalties: string[];
};

export type ZoneEligibility = {
  visibleOnChart: boolean;
  usableAsAoi: boolean;
  usableAsTriggerContext: boolean;
};

export type BaseSmcAoi = TemporalProvenance & {
  zoneId: string;
  sourceId: string;
  symbol: string;
  side: SmcSide;
  sourceTimeframe: SmcSourceTimeframe;
  aoiLow: number;
  aoiHigh: number;
  midpoint: number;
  state: SmcAoiState;
  mitigationPct: number;
  reactionConfirmed: boolean;
  invalidated: boolean;
  returnedAt?: number;
  reactionConfirmedAt?: number;
  invalidatedAt?: number;
  recordedAtCursor: number;
  eligibility: ZoneEligibility;
};

export type FvgAoi = BaseSmcAoi & {
  aoiType: 'FVG';
  sourceCandleTimes: [number, number, number];
  lifecycle: FvgLifecycleMetadata;
  quality: FvgQualityAssessment;
};

export type OrderBlockAoi = BaseSmcAoi & {
  aoiType: 'ORDER_BLOCK';
  originBosId: string;
  displacementCandleTime: number;
  lifecycle: FvgLifecycleMetadata;
  quality: ZoneQuality;
};

export type LiquiditySweepEvidence = TemporalProvenance & {
  sweepId: string;
  symbol: string;
  side: SmcSweepSide;
  sourceTimeframe: SweepTimeframe;
  referenceId: string;
  referenceLevel: number;
  sweptExtreme: number;
  reclaimClose: number;
  validForCandles: number;
  expiresAt: number;
  stale: boolean;
  recordedAtCursor: number;
  quality: ZoneQuality;
};

export type ZoneEvidenceLinkRelation =
  | 'SIDE_COMPATIBLE'
  | 'SIDE_INCOMPATIBLE'
  | 'NEAR_ZONE'
  | 'STALE'
  | 'AFTER_TRIGGER'
  | 'UNRELATED_PRICE_LEVEL';

export type ZoneEvidenceLink = {
  zoneId: string;
  evidenceId: string;
  evidenceType: 'SWEEP' | 'BOS' | 'CHOCH' | 'REACTION' | 'MITIGATION';
  relation: ZoneEvidenceLinkRelation;
  score: number;
  accepted: boolean;
  reasons: string[];
};

export type SmcAoiFactType =
  | 'FVG_ZONE_AVAILABLE'
  | 'FVG_CREATED_WITH_DISPLACEMENT'
  | 'FVG_CREATED_AFTER_BOS'
  | 'FVG_TOO_SMALL'
  | 'FVG_NEAR_MAJOR_BARRIER'
  | 'FVG_LOW_QUALITY'
  | 'FVG_TRAP_RISK'
  | 'IMBALANCE_PULLBACK_LOCATION_CONFIRMED'
  | 'FVG_FIRST_RETURN_CONFIRMED'
  | 'FVG_REACTION_CONFIRMED'
  | 'FVG_INVALIDATED'
  | 'ORDER_BLOCK_AVAILABLE'
  | 'PULLBACK_INTO_ORDER_BLOCK'
  | 'ORDER_BLOCK_REACTION_CONFIRMED'
  | 'ORDER_BLOCK_INVALIDATED'
  | 'SELL_SIDE_SWEEP_DETECTED'
  | 'BUY_SIDE_SWEEP_DETECTED'
  | 'SWEEP_STALE'
  | 'SWEEP_REJECTED_TINY_WICK'
  | 'SWEEP_REJECTED_REACTION_ONLY';

export type SmcAoiFact = TemporalProvenance & {
  factId: string;
  factType: SmcAoiFactType;
  symbol: string;
  sourceTimeframe: SmcSourceTimeframe | SweepTimeframe;
  side?: SmcSide | SmcSweepSide;
  zoneId?: string;
  sourceId?: string;
  sweepId?: string;
  aoiLow?: number;
  aoiHigh?: number;
  midpoint?: number;
  relatedFactIds?: string[];
};

export type SmcLifecycleEventType =
  | 'FVG_AVAILABLE'
  | 'FVG_RETURNED'
  | 'FVG_REACTION_CONFIRMED'
  | 'FVG_INVALIDATED'
  | 'ORDER_BLOCK_AVAILABLE'
  | 'ORDER_BLOCK_RETURNED'
  | 'ORDER_BLOCK_REACTION_CONFIRMED'
  | 'ORDER_BLOCK_INVALIDATED'
  | 'SWEEP_DETECTED'
  | 'SWEEP_STALE';

export type SmcLifecycleEvent = {
  eventId: string;
  eventType: SmcLifecycleEventType;
  symbol: string;
  sourceTimeframe: SmcSourceTimeframe | SweepTimeframe;
  zoneId?: string;
  sourceId?: string;
  sweepId?: string;
  eventTime: number;
  observedAt: number;
};

export type SmcEngineViolationSeverity = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type SmcEngineViolationCode =
  | 'FORMING_CANDLE_REJECTED'
  | 'FUTURE_CANDLE_REJECTED'
  | 'MALFORMED_CANDLE_REJECTED'
  | 'DUPLICATE_CANDLE_IGNORED'
  | 'FORBIDDEN_SOURCE_TIMEFRAME'
  | 'INVALID_CONFIG'
  | 'FVG_TOO_SMALL'
  | 'SWEEP_REJECTED_TINY_WICK'
  | 'SWEEP_REJECTED_REACTION_ONLY';

export type SmcEngineViolation = {
  code: SmcEngineViolationCode;
  severity: SmcEngineViolationSeverity;
  message: string;
  cursorMs: number;
  symbol?: string;
  timeframe?: Timeframe;
  candleTime?: number;
};

export type SmartMoneyConfig = {
  version: string;
  sourceZoneTimeframes: SmcSourceTimeframe[];
  sweepTimeframes: SweepTimeframe[];
  forbiddenSourceZoneTimeframes: Array<'5m' | '3m' | '1m'>;
  strictMode: boolean;
  fvg: {
    enabled: boolean;
    detectTinyGaps: boolean;
    minGapBps: number;
    quality: {
      atrPeriod: number;
      minGapBpsForAcceptable: number;
      minGapAtrMultipleForAcceptable?: number;
      displacement: {
        minBodyToRangeRatio: number;
        minRangeAtrMultiple: number;
        bullishMinCloseLocationPct: number;
        bearishMaxCloseLocationPct: number;
      };
      structure: {
        maxCandlesAfterBos: number;
      };
      barriers: {
        maxDistancePct: number;
      };
    };
  };
  orderBlock: {
    enabled: boolean;
    requireBos: boolean;
    requireConfirmedBos: boolean;
    allowChoch: boolean;
    requireDisplacement: boolean;
    minDisplacementAtr?: number;
    originPolicy: 'LAST_OPPOSITE_BEFORE_BOS' | 'EXTREME_CANDLE_BEFORE_BOS' | 'HIGHEST_VOLUME_OPPOSITE_BEFORE_BOS';
    maxCandlesBackFromBos: number;
    boundsPolicy: 'WICK' | 'BODY' | 'HYBRID' | 'BODY_TO_WICK' | 'CE';
    minOriginBodyAtr?: number;
    minQualityGrade: ZoneQualityGrade;
    invalidation: {
      mode: 'WICK_THROUGH' | 'CLOSE_THROUGH';
      bufferBps: number;
    };
  };
  sweeps: {
    enabled: boolean;
    validForCandles: number;
    minWickExtensionBps: number;
    minWickExtensionAtr?: number;
    requireCloseReclaim: boolean;
    liquidityLevel: {
      swingLeft: number;
      swingRight: number;
      minTouchesForEqualHighLow: number;
      equalLevelToleranceBps: number;
    };
    significance: {
      usePivotDepth: boolean;
      minSignificance: ZoneQualityGrade;
    };
  };
  reaction: {
    requireCloseAwayFromZone: boolean;
    minReactionBodyAtr: number;
    minReactionRangeAtr: number;
    requireNoInvalidationAfterTouch: boolean;
  };
  evidence: {
    requireZoneScopedSweeps: boolean;
    maxSweepDistanceBps: number;
    rejectSideIncompatibleSweeps: boolean;
  };
  safety: {
    requireClosedCandlesOnly: boolean;
    requireAvailableFrom: boolean;
    rejectFutureData: boolean;
  };
};

export type SmartMoneyConfigInput = {
  version?: string;
  sourceZoneTimeframes?: SmcSourceTimeframe[];
  sweepTimeframes?: SweepTimeframe[];
  forbiddenSourceZoneTimeframes?: Array<'5m' | '3m' | '1m'>;
  strictMode?: boolean;
  fvg?: {
    enabled?: boolean;
    detectTinyGaps?: boolean;
    minGapBps?: number;
    quality?: {
      atrPeriod?: number;
      minGapBpsForAcceptable?: number;
      minGapAtrMultipleForAcceptable?: number;
      displacement?: {
        minBodyToRangeRatio?: number;
        minRangeAtrMultiple?: number;
        bullishMinCloseLocationPct?: number;
        bearishMaxCloseLocationPct?: number;
      };
      structure?: {
        maxCandlesAfterBos?: number;
      };
      barriers?: {
        maxDistancePct?: number;
      };
    };
  };
  orderBlock?: Partial<Omit<SmartMoneyConfig['orderBlock'], 'invalidation'>> & {
    invalidation?: Partial<SmartMoneyConfig['orderBlock']['invalidation']>;
  };
  sweeps?: Partial<Omit<SmartMoneyConfig['sweeps'], 'liquidityLevel' | 'significance'>> & {
    liquidityLevel?: Partial<SmartMoneyConfig['sweeps']['liquidityLevel']>;
    significance?: Partial<SmartMoneyConfig['sweeps']['significance']>;
  };
  reaction?: Partial<SmartMoneyConfig['reaction']>;
  evidence?: Partial<SmartMoneyConfig['evidence']>;
  safety?: Partial<SmartMoneyConfig['safety']>;
};

export type SmartMoneyEngineInput = {
  symbol: string;
  cursorMs: number;
  candlesByTimeframe: Partial<Record<SmcInputTimeframe, Candle[]>>;
  referenceLevels?: LiquidityReferenceLevel[];
  config?: SmartMoneyConfigInput;
};

export type SmartMoneyEngineOutput = {
  contractVersion: 'smi-core-v2';
  snapshotId: string;
  configVersion: string;
  valid: boolean;
  symbol: string;
  cursorMs: number;
  aois: Array<FvgAoi | OrderBlockAoi>;
  sweeps: LiquiditySweepEvidence[];
  facts: SmcAoiFact[];
  events: SmcLifecycleEvent[];
  violations: SmcEngineViolation[];
};

export type SmartMoneyInput = Omit<SmartMoneyEngineInput, 'cursorMs'> & {
  cursorTime?: number;
};

export type SmartMoneySnapshot = SmartMoneyEngineOutput & {
  schemaVersion: 'smi.snapshot.v1';
  apiVersion: string;
  cursorTime: number;
  zones: Array<FvgAoi | OrderBlockAoi>;
  diagnostics: {
    valid: boolean;
    violations: SmcEngineViolation[];
  };
};

export type SmartMoneyZone = FvgAoi | OrderBlockAoi;
export type FairValueGapZone = FvgAoi;
export type OrderBlockZone = OrderBlockAoi;
export type LiquiditySweep = LiquiditySweepEvidence;

export type SmartMoneyRollingConfig = SmartMoneyConfig & {
  bufferSizes: {
    sourceZoneTimeframes: Record<SmcSourceTimeframe, number>;
    sweepTimeframes: Record<SweepTimeframe, number>;
  };
};

export type SmartMoneyRollingUpdate = {
  symbol: string;
  cursorMs: number;
  closedCandlesByTimeframe: Partial<Record<SmcInputTimeframe, Candle[]>>;
  referenceLevels?: LiquidityReferenceLevel[];
  config?: SmartMoneyConfigInput;
};

export type SmartMoneySnapshotInput = {
  symbol: string;
  cursorMs: number;
  referenceLevels?: LiquidityReferenceLevel[];
  config?: SmartMoneyConfigInput;
};

export type SmartMoneyBufferDiagnostics = {
  symbols: Array<{
    symbol: string;
    timeframes: Array<{
      timeframe: Timeframe;
      candleCount: number;
      firstCloseTime?: number;
      lastCloseTime?: number;
      lastCursorMs?: number;
      droppedCandles: number;
      duplicateCandles: number;
      rejectedFutureCandles: number;
      rejectedFormingCandles: number;
      rejectedMalformedCandles: number;
    }>;
  }>;
};

export type SmartMoneyResetScope =
  | { type: 'ALL' }
  | { type: 'SYMBOL'; symbol: string }
  | { type: 'SYMBOL_TIMEFRAME'; symbol: string; timeframe: Timeframe };

export type SmartMoneyRollingEngine = {
  update(input: SmartMoneyRollingUpdate): SmartMoneyEngineOutput;
  snapshot(input: SmartMoneySnapshotInput): SmartMoneyEngineOutput;
  getBufferState(): SmartMoneyBufferDiagnostics;
  reset(scope?: SmartMoneyResetScope): void;
};
