import type { LegacySwingPoint } from '../legacy/legacy.types.js';

export type SmartMoneySwingPoint = LegacySwingPoint;

export function isSmartMoneySwingUsableAt(
  swing: SmartMoneySwingPoint,
  currentCandleIndex: number
): boolean {
  return (
    swing.confirmationStatus === 'CONFIRMED' &&
    swing.confirmedAtCandleIndex !== undefined &&
    currentCandleIndex >= swing.confirmedAtCandleIndex
  );
}
