import type { PrimitiveSwingPoint } from '../primitives/primitives.types.js';

export type SmartMoneySwingPoint = PrimitiveSwingPoint;

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
