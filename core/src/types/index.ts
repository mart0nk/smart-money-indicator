export type Timeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export type SmcSourceTimeframe = '4h' | '1h' | '30m' | '15m';
export type WatchlistTimeframe = '15m';
export type SweepDiagnosticsTimeframe = '15m' | '5m' | '3m';
export type Phase7ConfirmationTimeframe = '1m';

export type SmartMoneyStatus =
  | 'NO_CONTEXT'
  | 'CONTEXT_ONLY'
  | 'WATCHABLE'
  | 'WAIT_FOR_REACTION'
  | 'REACTION_CONFIRMED'
  | 'MICRO_CONFIRMATION_PRESENT'
  | 'CONFLICTED'
  | 'INVALIDATED';

export type SmartMoneySide = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type SmartMoneyZoneType =
  | 'FVG'
  | 'ORDER_BLOCK'
  | 'SUPPORT'
  | 'RESISTANCE'
  | 'RANGE_BOUNDARY'
  | 'LIQUIDITY_POOL';

export type SmartMoneyCandle = {
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

export type SmartMoneyProof = {
  cursorMs: number;
  closedCandlesOnly: boolean;
  lookaheadSafe: boolean;
  latestClosedByTimeframe: Partial<Record<Timeframe, number>>;
  sourceTimestamps: Record<string, number>;
  missingFeatures: string[];
  warnings: string[];
};

export type SmartMoneyStructure = {
  trend: 'BULLISH' | 'BEARISH' | 'RANGE' | 'TRANSITION' | 'UNCLEAR';
  lastEvent?:
    | 'BOS_BULLISH'
    | 'BOS_BEARISH'
    | 'CHOCH_BULLISH'
    | 'CHOCH_BEARISH'
    | 'MSS_BULLISH'
    | 'MSS_BEARISH';
  lastSwingHigh?: { price: number; time: number; confirmedAt: number };
  lastSwingLow?: { price: number; time: number; confirmedAt: number };
  protectedHigh?: number;
  protectedLow?: number;
  range?: { high: number; low: number; midpoint: number };
};

export type SmartMoneyQuality = {
  score: number;
  verdict:
    | 'HIGH_QUALITY_CONTEXT'
    | 'WATCHABLE'
    | 'WAIT_FOR_REACTION'
    | 'REACTION_CONFIRMED'
    | 'CONFLICTED'
    | 'LOW_QUALITY'
    | 'INVALID';
  components: {
    structureAlignment: number;
    htfConfluence: number;
    zoneFreshness: number;
    displacementQuality: number;
    mitigationQuality: number;
    liquiditySweepQuality: number;
    reactionQuality: number;
    volumeParticipation?: number;
    pathToLiquidity?: number;
    conflictPenalty: number;
    staleEvidencePenalty: number;
    invalidationPenalty: number;
  };
  warnings: string[];
  penalties: string[];
  evidence: string[];
};

export type SmartMoneyFvgZone = {
  sourceId: string;
  zoneId: string;
  type: 'FVG';
  side: 'BULLISH' | 'BEARISH';
  symbol: string;
  timeframe: SmcSourceTimeframe;
  sourceTimeframe: SmcSourceTimeframe;
  zoneLow: number;
  zoneHigh: number;
  midpoint: number;
  sourceCandles: { candle1Time: number; candle2Time: number; candle3Time: number };
  sourceCandleTime: number;
  createdAt: number;
  availableFrom: number;
  state:
    | 'DETECTED'
    | 'ACTIVE'
    | 'FIRST_RETURN'
    | 'PARTIALLY_MITIGATED'
    | 'MITIGATED'
    | 'REACTION_CONFIRMED'
    | 'INVALIDATED';
  mitigationPct: number;
  firstReturnAt?: number;
  mitigatedAt?: number;
  reactedAt?: number;
  invalidatedAt?: number;
  invalidationReason?: 'CLOSE_BEYOND_ZONE' | 'STRUCTURE_INVALIDATION';
  quality?: SmartMoneyQuality;
  proof: SmartMoneyProof;
};

export type SmartMoneyOrderBlockZone = {
  sourceId: string;
  zoneId: string;
  type: 'ORDER_BLOCK';
  side: 'BULLISH' | 'BEARISH';
  symbol: string;
  timeframe: SmcSourceTimeframe;
  sourceTimeframe: SmcSourceTimeframe;
  zoneLow: number;
  zoneHigh: number;
  midpoint: number;
  originCandleTime: number;
  sourceCandleTime: number;
  originBosId?: string;
  displacementEventId?: string;
  createdAt: number;
  availableFrom: number;
  state:
    | 'DETECTED'
    | 'ACTIVE'
    | 'PULLBACK_INTO_ZONE'
    | 'PARTIALLY_MITIGATED'
    | 'MITIGATED'
    | 'REACTION_CONFIRMED'
    | 'INVALIDATED';
  mitigationPct: number;
  firstTouchAt?: number;
  reactedAt?: number;
  invalidatedAt?: number;
  invalidationReason?: 'CLOSE_BEYOND_OB_EDGE' | 'STRUCTURE_LOSS' | 'OVER_MITIGATION';
  quality?: SmartMoneyQuality;
  proof: SmartMoneyProof;
};

export type SmartMoneyZone = SmartMoneyFvgZone | SmartMoneyOrderBlockZone;

export type LiquidityPool = {
  poolId: string;
  symbol: string;
  timeframe: Timeframe;
  type: 'BUY_SIDE' | 'SELL_SIDE';
  source: 'SWING' | 'EQUAL_HIGH_LOW' | 'SESSION' | 'RANGE' | 'SUPPORT_RESISTANCE';
  level: number;
  zoneLow?: number;
  zoneHigh?: number;
  createdAt: number;
  availableFrom: number;
  state: 'ACTIVE' | 'SWEPT' | 'STALE' | 'INVALIDATED';
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  sweptAt?: number;
  sweptBySweepId?: string;
  proof: SmartMoneyProof;
};

export type LiquiditySweepEvidence = {
  sweepId: string;
  symbol: string;
  sourceTimeframe: SweepDiagnosticsTimeframe;
  side: 'SELL_SIDE' | 'BUY_SIDE';
  referenceLevel: number;
  referenceType:
    | 'LOCAL_HIGH'
    | 'LOCAL_LOW'
    | 'EQUAL_HIGH'
    | 'EQUAL_LOW'
    | 'SESSION_HIGH'
    | 'SESSION_LOW'
    | 'RANGE_HIGH'
    | 'RANGE_LOW'
    | 'AOI_EDGE';
  sweptExtreme: number;
  closeBackPrice: number;
  wickExtensionPct?: number;
  closeBackPct?: number;
  detectedAt: number;
  detectedCandleTime: number;
  rejectionConfirmed: boolean;
  followedByChoCh: boolean;
  freshness: 'FRESH' | 'STALE';
  validForCandles: number;
  expiresAt: number;
  staleReason?: 'TTL_EXPIRED' | 'STRUCTURE_CHANGED' | 'ZONE_INVALIDATED';
  rejectedReason?:
    | 'WRONG_SIDE'
    | 'TINY_WICK'
    | 'REACTION_ONLY'
    | 'NO_CLOSE_BACK'
    | 'REFERENCE_NOT_VALID';
  proof: SmartMoneyProof;
};

export type SmartMoneyAOI = {
  aoiId: string;
  sourceId: string;
  zoneId: string;
  symbol: string;
  timeframe: SmcSourceTimeframe;
  sourceTimeframe: SmcSourceTimeframe;
  type: SmartMoneyZoneType;
  side: SmartMoneySide;
  zoneLow: number;
  zoneHigh: number;
  midpoint: number;
  state:
    | 'ACTIVE'
    | 'TOUCHED'
    | 'FIRST_RETURN'
    | 'PARTIALLY_MITIGATED'
    | 'MITIGATED'
    | 'REACTION_CONFIRMED'
    | 'INVALIDATED';
  mitigationPct: number;
  quality: SmartMoneyQuality;
  relatedZoneId?: string;
  relatedLiquidityPoolIds?: string[];
  relatedSweepIds?: string[];
  invalidationLevel?: number;
  warnings: string[];
  evidence: string[];
  proof: SmartMoneyProof;
};

export type SmartMoneyConflict = {
  type:
    | 'LTF_BULLISH_IN_HTF_SUPPLY'
    | 'LTF_BEARISH_IN_HTF_DEMAND'
    | 'OPPOSING_ACTIVE_ZONES'
    | 'RANGE_MIDDLE_NO_EDGE'
    | 'STALE_SWEEP'
    | 'CHOP_CONTEXT';
  severity: 'INFO' | 'WARN' | 'BLOCKING_FOR_ALERT';
  message: string;
};

export type SmartMoneyMtfConfluence = {
  bias: 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';
  htfContext:
    | 'IN_HTF_DEMAND'
    | 'IN_HTF_SUPPLY'
    | 'BETWEEN_ZONES'
    | 'AT_MAJOR_LIQUIDITY'
    | 'RANGE_MIDDLE'
    | 'UNKNOWN';
  activeHtfAoiId?: string;
  activeCoreAoiId?: string;
  ltfEvidence: {
    freshSweep: boolean;
    sweepSide?: 'SELL_SIDE' | 'BUY_SIDE';
    reactionConfirmed: boolean;
    microConfirmationPresent: boolean;
  };
  conflicts: SmartMoneyConflict[];
  score: number;
  labels: string[];
  warnings: string[];
};

export type SmartMoneyReactionEvidence = {
  reactionId: string;
  symbol: string;
  timeframe: Timeframe;
  aoiId: string;
  zoneId?: string;
  side: 'BULLISH' | 'BEARISH';
  reactionType:
    | 'REJECTION_CANDLE'
    | 'CLOSE_BACK_FROM_MIDPOINT'
    | 'DISPLACEMENT_AWAY'
    | 'MICRO_CHOCH'
    | 'MICRO_HIGHER_LOW'
    | 'MICRO_LOWER_HIGH';
  detectedAt: number;
  sourceCandleTime: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  proof: SmartMoneyProof;
};

export type SmartMoneyAlert = {
  alertId: string;
  symbol: string;
  timeframe: Timeframe;
  type:
    | 'AOI_TOUCHED'
    | 'FVG_FIRST_RETURN'
    | 'OB_PULLBACK_INTO_ZONE'
    | 'SELL_SIDE_SWEEP'
    | 'BUY_SIDE_SWEEP'
    | 'REACTION_CONFIRMED'
    | 'MICRO_CONFIRMATION_PRESENT'
    | 'ZONE_INVALIDATED'
    | 'HIGH_QUALITY_AOI_WATCHABLE'
    | 'CONFLICT_DETECTED';
  status: SmartMoneyStatus;
  aoiId?: string;
  zoneId?: string;
  sweepId?: string;
  message: string;
  createdAt: number;
  proof: SmartMoneyProof;
};

export type SmartMoneyTimeframeState = {
  timeframe: Timeframe;
  structure: SmartMoneyStructure;
  activeAois: SmartMoneyAOI[];
  zones: { fvgs: SmartMoneyFvgZone[]; orderBlocks: SmartMoneyOrderBlockZone[] };
  liquidity: { pools: LiquidityPool[]; sweeps: LiquiditySweepEvidence[] };
  reactions: SmartMoneyReactionEvidence[];
  latestClosedCandleTime: number;
  proof: SmartMoneyProof;
};

export type SmartMoneyIndicatorOutput = {
  symbol: string;
  timestamp: number;
  cursorMs: number;
  timeframes: Partial<Record<Timeframe, SmartMoneyTimeframeState>>;
  mtfSummary: {
    bias: 'BULLISH' | 'BEARISH' | 'MIXED' | 'NEUTRAL' | 'UNKNOWN';
    status: SmartMoneyStatus;
    bestBullishAoiId?: string;
    bestBearishAoiId?: string;
    activeHtfContext?: string;
    activeCoreContext?: string;
    conflicts: SmartMoneyConflict[];
    notes: string[];
  };
  activeAois: SmartMoneyAOI[];
  zones: { fvgs: SmartMoneyFvgZone[]; orderBlocks: SmartMoneyOrderBlockZone[] };
  liquidity: { pools: LiquidityPool[]; recentSweeps: LiquiditySweepEvidence[] };
  reactions: SmartMoneyReactionEvidence[];
  alerts: SmartMoneyAlert[];
  proof: SmartMoneyProof;
};

export type SmartMoneyEvent = {
  eventId: string;
  symbol: string;
  timeframe: Timeframe;
  timestamp: number;
  cursorMs: number;
  type:
    | 'STRUCTURE_SWING_CONFIRMED'
    | 'BOS_CONFIRMED'
    | 'CHOCH_CONFIRMED'
    | 'MSS_CONFIRMED'
    | 'FVG_DETECTED'
    | 'FVG_ACTIVE'
    | 'FVG_FIRST_RETURN'
    | 'FVG_MITIGATED'
    | 'FVG_REACTION_CONFIRMED'
    | 'FVG_INVALIDATED'
    | 'FVG_TOO_SMALL'
    | 'ORDER_BLOCK_DETECTED'
    | 'ORDER_BLOCK_ACTIVE'
    | 'PULLBACK_INTO_ORDER_BLOCK'
    | 'ORDER_BLOCK_REACTION_CONFIRMED'
    | 'ORDER_BLOCK_INVALIDATED'
    | 'LIQUIDITY_POOL_CREATED'
    | 'LIQUIDITY_SWEPT'
    | 'SWEEP_DETECTED'
    | 'SWEEP_STALE'
    | 'SWEEP_REJECTED_WRONG_SIDE'
    | 'SWEEP_REJECTED_TINY_WICK'
    | 'SWEEP_REJECTED_REACTION_ONLY'
    | 'AOI_CREATED'
    | 'AOI_TOUCHED'
    | 'AOI_MITIGATION_UPDATED'
    | 'AOI_REACTION_CONFIRMED'
    | 'AOI_INVALIDATED'
    | 'AOI_STATUS_CHANGED'
    | 'MTF_CONFLICT_DETECTED'
    | 'QUALITY_UPDATED';
  zoneId?: string;
  aoiId?: string;
  sweepId?: string;
  liquidityPoolId?: string;
  details: Record<string, unknown>;
  proof: SmartMoneyProof;
};

export type SmartMoneyZoneRegistry = {
  zonesById: Record<string, SmartMoneyZone>;
  invalidatedZoneIds: string[];
};

export type SmartMoneyEngineState = {
  symbol: string;
  zoneRegistry: SmartMoneyZoneRegistry;
  liquidityPools: LiquidityPool[];
  activeSweeps: LiquiditySweepEvidence[];
  activeAois: SmartMoneyAOI[];
  lastStructureByTimeframe: Partial<Record<Timeframe, SmartMoneyStructure>>;
  eventLog: SmartMoneyEvent[];
  lastEvaluatedCursorMs: number;
  latestClosedByTimeframe: Partial<Record<Timeframe, number>>;
};

export type SmartMoneyDiagnosticsReport = {
  cursorMs: number;
  safety: 'PASS' | 'FAIL';
  violations: {
    formingCandles: number;
    lookahead: number;
    malformedZones: number;
    unstableZoneIds: number;
    forbiddenTradingFields: number;
  };
  warnings: string[];
  proof: SmartMoneyProof;
};

export type SmartMoneyTimeframeRole =
  | 'MICRO_CONFIRMATION'
  | 'SWEEP_REACTION'
  | 'CORE_AOI'
  | 'HTF_CONTEXT';

export type SmartMoneyEngineConfig = {
  timeframes: Timeframe[];
  sourceZoneTimeframes: SmcSourceTimeframe[];
  sweepTimeframes: SweepDiagnosticsTimeframe[];
  confirmationTimeframes: Phase7ConfirmationTimeframe[];
  timeframeRoles: Partial<Record<Timeframe, SmartMoneyTimeframeRole>>;
  structure: {
    swingPivotLeft: number;
    swingPivotRight: number;
    bosBreakMode: 'CLOSE_BEYOND_SWING' | 'WICK_ALLOWED';
    chochBreakMode: 'CLOSE_BEYOND_SWING' | 'WICK_ALLOWED';
    minBosDisplacementAtr?: number;
    minMssDisplacementAtr?: number;
    requireSweepBeforeMss: boolean;
  };
  fvg: {
    minGapBps?: number;
    minGapAtrPct?: number;
    impulseRule?: 'CANDLE_COLOR' | 'BODY_ATR' | 'NONE';
    requireDisplacementCandle: boolean;
    minDisplacementAtr?: number;
    rejectTinyFvg: boolean;
    maxActiveZonesPerTimeframe?: number;
  };
  orderBlock: {
    zonePolicy: 'BODY' | 'FULL_WICK' | 'BODY_PLUS_WICK_BUFFER';
    requireConfirmedBos?: boolean;
    originCandlePolicy?: 'LAST_OPPOSITE_BEFORE_BOS';
    requireBos: boolean;
    requireDisplacement: boolean;
    minDisplacementAtr?: number;
    maxCandlesBackFromBos: number;
    allowMultipleOriginCandles: boolean;
  };
  sweeps: {
    validForCandles: number;
    minWickExtensionBps: number;
    requireConfirmedSwing?: boolean;
    requireCloseBack?: boolean;
  };
};

export type EvaluateSmartMoneyInput = {
  symbol: string;
  cursorMs: number;
  candlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  config?: Partial<SmartMoneyEngineConfig>;
  mode?: 'STATELESS_REBUILD' | 'INCREMENTAL';
  previousState?: SmartMoneyEngineState;
};

export type EvaluateSmartMoneyIncrementalInput = {
  symbol: string;
  cursorMs: number;
  previousState: SmartMoneyEngineState;
  newlyClosedCandlesByTimeframe: Partial<Record<Timeframe, SmartMoneyCandle[]>>;
  config?: Partial<SmartMoneyEngineConfig>;
};

export type EvaluateSmartMoneyResult = {
  snapshot: SmartMoneyIndicatorOutput;
  nextState: SmartMoneyEngineState;
  events: SmartMoneyEvent[];
  alerts: SmartMoneyAlert[];
  diagnostics: SmartMoneyDiagnosticsReport;
};

export type SmartMoneyEngine = {
  evaluate(input: EvaluateSmartMoneyInput): EvaluateSmartMoneyResult;
  evaluateIncremental(
    input: EvaluateSmartMoneyIncrementalInput
  ): EvaluateSmartMoneyResult;
  getConfig(): SmartMoneyEngineConfig;
};
