export type LegacyTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export type LegacyCandle = {
  symbol: string;
  timeframe: LegacyTimeframe;
  openTime: Date;
  closeTime?: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
};

export type LegacySwingPointType = 'HIGH' | 'LOW';
export type LegacySwingPointConfirmationStatus = 'CANDIDATE' | 'CONFIRMED' | 'INVALIDATED';

export type LegacySwingPoint = {
  id: string;
  type: LegacySwingPointType;
  price: number;
  candleIndex: number;
  candleOpenTime: number;
  leftBars: number;
  rightBars: number;
  confirmationStatus: LegacySwingPointConfirmationStatus;
  confirmedAtCandleIndex?: number;
  confirmedAtOpenTime?: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'CLOSED_CANDLES_ONLY';
};

export type LegacyBosEvent = {
  id: string;
  direction: 'BULLISH' | 'BEARISH';
  brokenSwingId: string;
  brokenSwingType: 'HIGH' | 'LOW';
  brokenLevel: number;
  breakCandleIndex: number;
  breakCandleOpenTime: number;
  closeBeyondLevel: boolean;
  wickOnlyBreak: boolean;
  displacementScore: number;
  atrMultiple: number;
  volumeScore?: number;
  confirmed: boolean;
  confirmedAtOpenTime: number;
  invalidated?: boolean;
  invalidatedAtOpenTime?: number;
};

export type LegacyMitigationState =
  | 'UNMITIGATED'
  | 'PARTIALLY_MITIGATED'
  | 'MITIGATED'
  | 'OVER_MITIGATED'
  | 'INVALIDATED';

export type LegacyFvgZone = {
  id: string;
  zoneId?: string;
  legacyIdWasRandom?: false;
  direction: 'BULLISH' | 'BEARISH';
  upperLevel: number;
  lowerLevel: number;
  midpoint: number;
  gapSize: number;
  gapSizeAtr?: number;
  candleIndexPrev: number;
  candleIndexImpulse: number;
  candleIndexNext: number;
  detectedAtCandleIndex: number;
  detectedAtOpenTime: number;
  mitigationState: LegacyMitigationState;
  fillPct: number;
  touchCount: number;
  lastTouchCandleIndex?: number;
  invalidated: boolean;
  invalidatedAtCandleIndex?: number;
};

export type LegacyOrderBlock = {
  id: string;
  zoneId?: string;
  legacyIdWasRandom?: false;
  direction: 'BULLISH' | 'BEARISH';
  candleIndex: number;
  candleOpenTime: number;
  high: number;
  low: number;
  open: number;
  close: number;
  bosEventId: string;
  bosDirection: 'BULLISH' | 'BEARISH';
  bosLevel: number;
  mitigationState: LegacyMitigationState;
  fillPct: number;
  touchCount: number;
  lastTouchCandleIndex?: number;
  invalidated: boolean;
  invalidatedAtCandleIndex?: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type LegacyLiquiditySweepDirection = 'BUY_SIDE_SWEEP' | 'SELL_SIDE_SWEEP';

export type LegacyLiquiditySweepEvidence = {
  detected: boolean;
  direction: LegacyLiquiditySweepDirection;
  referenceLevelId?: string;
  referenceLevelType:
    | 'SWING_HIGH'
    | 'SWING_LOW'
    | 'RANGE_HIGH'
    | 'RANGE_LOW'
    | 'OB_BOUNDARY'
    | 'FVG_BOUNDARY'
    | 'SR_ZONE'
    | 'PREVIOUS_HIGH_LOW';
  referenceLevel: number;
  wickExtreme: number;
  wickExtension: number;
  wickExtensionPct: number;
  wickExtensionAtr?: number;
  closeBackBeyondLevel: boolean;
  closeBackDistance: number;
  closeBackDistancePct: number;
  closeBackDistanceAtr?: number;
  candleIndex: number;
  candleOpenTime: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  evidence: string[];
};

export type LegacyMitigationPenaltyInput = {
  mitigationState: LegacyMitigationState;
  fillPct: number;
  touchCount: number;
  htfTrendAlignment: 'STRONG' | 'ALIGNED' | 'NEUTRAL' | 'AGAINST';
  relativeStrengthState: 'SUPPORTIVE' | 'NEUTRAL' | 'UNFAVORABLE';
};

export type LegacyReactionEvidence = {
  liquiditySweep: boolean;
  closeBackInDirection: boolean;
  momentumShift: boolean;
  liquiditySweepEvidence?: LegacyLiquiditySweepEvidence;
  candlePattern?: 'ENGULFING' | 'STRONG_REJECTION' | 'PIN_BAR' | string;
};

export type LegacyScoreBonus = {
  code: string;
  source: 'SETUP_QUALITY';
  points: number;
  reason: string;
};

export type LegacyScorePenalty = {
  code: string;
  source: 'SETUP_QUALITY';
  points: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
};

export type LegacyVolumeEvidence = {
  available: boolean;
  reliable: boolean;
  volume: number;
  volumeMa20?: number;
  relativeVolume?: number;
  quoteVolume?: number;
  quoteVolumeMa20?: number;
  volumeProfileNode?: 'HVN' | 'LVN' | 'UNKNOWN';
  scoreImpact: number;
  warnings: string[];
};
