import type { PrimitiveBosEvent, PrimitiveCandle, PrimitiveSwingPoint } from '../primitives/primitives.types.js';
import { isSmartMoneySwingUsableAt } from './swing-point.types.js';

export function detectSmartMoneyBos(
  candle: PrimitiveCandle,
  candleIndex: number,
  swing: PrimitiveSwingPoint,
  atr: number
): PrimitiveBosEvent | null {
  if (!candle.closed || !isSmartMoneySwingUsableAt(swing, candleIndex)) return null;
  if (swing.type === 'HIGH') {
    const wickBreak = candle.high > swing.price;
    if (!wickBreak) return null;
    const closeBreak = candle.close > swing.price;
    return buildBosEvent(candle, candleIndex, swing, atr, 'BULLISH', closeBreak, !closeBreak);
  }
  const wickBreak = candle.low < swing.price;
  if (!wickBreak) return null;
  const closeBreak = candle.close < swing.price;
  return buildBosEvent(candle, candleIndex, swing, atr, 'BEARISH', closeBreak, !closeBreak);
}

function buildBosEvent(
  candle: PrimitiveCandle,
  candleIndex: number,
  swing: PrimitiveSwingPoint,
  atr: number,
  direction: 'BULLISH' | 'BEARISH',
  confirmed: boolean,
  wickOnlyBreak: boolean
): PrimitiveBosEvent {
  const displacementScore = atr > 0 ? Math.abs(candle.close - candle.open) / atr : 0;
  const atrMultiple = atr > 0 ? Math.abs(candle.close - swing.price) / atr : 0;
  return {
    id: `${candle.symbol}:${candle.timeframe}:BOS:${direction}:${swing.id}:${candle.openTime.getTime()}`,
    direction,
    brokenSwingId: swing.id,
    brokenSwingType: swing.type,
    brokenLevel: swing.price,
    breakCandleIndex: candleIndex,
    breakCandleOpenTime: candle.openTime.getTime(),
    closeBeyondLevel: confirmed,
    wickOnlyBreak,
    displacementScore,
    atrMultiple,
    confirmed,
    confirmedAtOpenTime: candle.openTime.getTime(),
  };
}
