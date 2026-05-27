export type PrimitiveTimeframe = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export type PrimitiveCandle = {
  symbol: string;
  timeframe: PrimitiveTimeframe;
  openTime: Date;
  closeTime?: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
};

export type PrimitiveSwingPointType = 'HIGH' | 'LOW';
export type PrimitiveSwingPointConfirmationStatus = 'CANDIDATE' | 'CONFIRMED' | 'INVALIDATED';

export type PrimitiveSwingPoint = {
  id: string;
  type: PrimitiveSwingPointType;
  price: number;
  candleIndex: number;
  candleOpenTime: number;
  leftBars: number;
  rightBars: number;
  confirmationStatus: PrimitiveSwingPointConfirmationStatus;
  confirmedAtCandleIndex?: number;
  confirmedAtOpenTime?: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
  source: 'CLOSED_CANDLES_ONLY';
};

export type PrimitiveBosEvent = {
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

export type PrimitiveMitigationState =
  | 'UNMITIGATED'
  | 'PARTIALLY_MITIGATED'
  | 'MITIGATED'
  | 'OVER_MITIGATED'
  | 'INVALIDATED';

export type PrimitiveFvgZone = {
  id: string;
  zoneId?: string;
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
  mitigationState: PrimitiveMitigationState;
  fillPct: number;
  touchCount: number;
  lastTouchCandleIndex?: number;
  invalidated: boolean;
  invalidatedAtCandleIndex?: number;
};

export type PrimitiveOrderBlock = {
  id: string;
  zoneId?: string;
  direction: 'BULLISH' | 'BEARISH';
  candleIndex: number;
  candleOpenTime: number;
  detectedAtOpenTime?: number;
  high: number;
  low: number;
  open: number;
  close: number;
  bosEventId: string;
  bosDirection: 'BULLISH' | 'BEARISH';
  bosLevel: number;
  mitigationState: PrimitiveMitigationState;
  fillPct: number;
  touchCount: number;
  lastTouchCandleIndex?: number;
  invalidated: boolean;
  invalidatedAtCandleIndex?: number;
  strength: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type PrimitiveLiquiditySweepDirection = 'BUY_SIDE_SWEEP' | 'SELL_SIDE_SWEEP';

export type PrimitiveLiquiditySweepEvidence = {
  detected: boolean;
  direction: PrimitiveLiquiditySweepDirection;
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

export type PrimitiveMitigationPenaltyInput = {
  mitigationState: PrimitiveMitigationState;
  fillPct: number;
  touchCount: number;
  htfTrendAlignment: 'STRONG' | 'ALIGNED' | 'NEUTRAL' | 'AGAINST';
  relativeStrengthState: 'SUPPORTIVE' | 'NEUTRAL' | 'UNFAVORABLE';
};

export type PrimitiveReactionEvidence = {
  liquiditySweep: boolean;
  closeBackInDirection: boolean;
  momentumShift: boolean;
  liquiditySweepEvidence?: PrimitiveLiquiditySweepEvidence;
  candlePattern?: 'ENGULFING' | 'STRONG_REJECTION' | 'PIN_BAR' | string;
};

export type PrimitiveScoreBonus = {
  code: string;
  source: 'SETUP_QUALITY';
  points: number;
  reason: string;
};

export type PrimitiveScorePenalty = {
  code: string;
  source: 'SETUP_QUALITY';
  points: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
};

export type PrimitiveVolumeEvidence = {
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
