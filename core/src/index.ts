export { calculateMitigationPenalty, isMitigationInvalidated } from './aoi/mitigation-scoring.js';
export { hasSufficientReactionEvidence, sweepStrengthFromEvidence } from './aoi/reaction-evidence-builder.js';
export { detectLiquiditySweep, scoreLiquiditySweep, sweepStrengthFromScore } from './liquidity/liquidity-sweep-detector.js';
export { detectSmartMoneyBos, detectSmartMoneyBos as detectBos } from './structure/bos-detector.js';
export { detectSmartMoneySwingPoints, detectSmartMoneySwingPoints as detectSwingPoints } from './structure/swing-detector.js';
export { isSmartMoneySwingUsableAt, isSmartMoneySwingUsableAt as isSwingUsableAt } from './structure/swing-point.types.js';
export { scoreVolumeEvidence } from './quality/volume-evidence.js';
export { detectFvgZones } from './zones/fvg-detector.js';
export { detectOrderBlocks } from './zones/order-block-detector.js';
export { runSmartMoneyEngine } from './v2/smart-money-engine.js';
export { createSmartMoneyRollingEngine } from './v2/smart-money-rolling-engine.js';
export {
  defaultSmartMoneyConfig,
  defaultSmartMoneyRollingConfig,
  resolveSmartMoneyConfig,
  resolveRollingConfig,
} from './v2/smc-config.js';
export {
  buildZoneId,
  buildSourceId,
  buildSweepId,
  buildFactId,
} from './v2/smc-ids.js';
export type {
  PrimitiveBosEvent as BosEvent,
  PrimitiveCandle,
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
  Candle,
  Candle as CanonicalSmcCandle,
  Timeframe,
  SmcSourceTimeframe,
  SweepTimeframe,
  SmcInputTimeframe,
  SmcSide,
  SmcSweepSide,
  TemporalProvenance,
  LiquidityReferenceLevel,
  SmcAoiState,
  FvgAoi,
  OrderBlockAoi,
  LiquiditySweepEvidence,
  LiquiditySweepEvidence as CanonicalLiquiditySweepEvidence,
  SmcAoiFactType,
  SmcAoiFact,
  SmcLifecycleEventType,
  SmcLifecycleEvent,
  SmcEngineViolationSeverity,
  SmcEngineViolationCode,
  SmcEngineViolation,
  SmartMoneyConfig,
  SmartMoneyEngineInput,
  SmartMoneyEngineOutput,
  SmartMoneyRollingConfig,
  SmartMoneyRollingUpdate,
  SmartMoneySnapshotInput,
  SmartMoneyBufferDiagnostics,
  SmartMoneyResetScope,
  SmartMoneyRollingEngine,
} from './v2/smc-core.types.js';
