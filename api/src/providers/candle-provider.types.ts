import type { SmartMoneyCandle, Timeframe } from '@trader-agent/smart-money-indicator-core';

export type SmartMoneyCandleProvider = {
  getClosedCandles(input: {
    symbol: string;
    timeframe: Timeframe;
    limit: number;
    beforeOrAt?: number;
  }): Promise<SmartMoneyCandle[]>;
};
