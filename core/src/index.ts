export { DEFAULT_SMART_MONEY_ENGINE_CONFIG, SMART_MONEY_PRIMITIVE_COMPAT_CONFIG, mergeSmartMoneyConfig } from './config/index.js';
export { createSmartMoneyEngine, evaluateSmartMoneySnapshot } from './engine/smart-money-engine.js';
export { calculateMitigationPenalty, isMitigationInvalidated } from './aoi/mitigation-scoring.js';
export { hasSufficientReactionEvidence, sweepStrengthFromEvidence } from './aoi/reaction-evidence-builder.js';
export { detectLiquiditySweep, scoreLiquiditySweep, sweepStrengthFromScore } from './liquidity/liquidity-sweep-detector.js';
export { detectSmartMoneyBos, detectSmartMoneyBos as detectBos } from './structure/bos-detector.js';
export { detectSmartMoneySwingPoints, detectSmartMoneySwingPoints as detectSwingPoints } from './structure/swing-detector.js';
export { isSmartMoneySwingUsableAt, isSmartMoneySwingUsableAt as isSwingUsableAt } from './structure/swing-point.types.js';
export { scoreVolumeEvidence } from './quality/volume-evidence.js';
export { detectFvgZones, detectSmartMoneyFvgZones } from './zones/fvg-detector.js';
export { detectOrderBlocks, detectSmartMoneyOrderBlockZones } from './zones/order-block-detector.js';
export type {
  PrimitiveBosEvent as BosEvent,
  PrimitiveCandle as Candle,
  PrimitiveFvgZone as FvgZone,
  PrimitiveLiquiditySweepDirection,
  PrimitiveLiquiditySweepEvidence,
  PrimitiveMitigationPenaltyInput as MitigationPenaltyInput,
  PrimitiveMitigationState as MitigationState,
  PrimitiveOrderBlock as OrderBlock,
  PrimitiveReactionEvidence,
  PrimitiveReactionEvidence as ReactionEvidence,
  PrimitiveScoreBonus as ScoreBonus,
  PrimitiveScorePenalty as ScorePenalty,
  PrimitiveSwingPoint as SwingPoint,
  PrimitiveSwingPointConfirmationStatus as SwingPointConfirmationStatus,
  PrimitiveSwingPointType as SwingPointType,
  PrimitiveVolumeEvidence as VolumeEvidence,
} from './primitives/primitives.types.js';
export type {
  EvaluateSmartMoneyIncrementalInput,
  EvaluateSmartMoneyInput,
  EvaluateSmartMoneyResult,
  LiquidityPool,
  LiquiditySweepEvidence,
  SmartMoneyAlert,
  SmartMoneyAOI,
  SmartMoneyCandle,
  SmartMoneyDiagnosticsReport,
  SmartMoneyEngine,
  SmartMoneyEngineConfig,
  SmartMoneyEngineState,
  SmartMoneyEvent,
  SmartMoneyFvgZone,
  SmartMoneyIndicatorOutput,
  SmartMoneyOrderBlockZone,
  SmartMoneyZone,
  SmartMoneyProof,
  SmartMoneyQuality,
  SmartMoneyReactionEvidence,
  SmartMoneyStatus,
  SmartMoneyStructure,
  SmartMoneyTimeframeState,
  SmartMoneyZoneRegistry,
  SmcSourceTimeframe,
  WatchlistTimeframe,
  SweepDiagnosticsTimeframe,
  Phase7ConfirmationTimeframe,
  Timeframe,
} from './types/index.js';
