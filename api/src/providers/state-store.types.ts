import type {
  SmartMoneyDiagnosticsReport,
  SmartMoneyEngineState,
  SmartMoneyEvent,
} from '@trader-agent/smart-money-indicator-core';

export type SmartMoneyStateStore = {
  getState(symbol: string): Promise<SmartMoneyEngineState | null>;
  saveState(symbol: string, state: SmartMoneyEngineState): Promise<void>;
  getEvents?(input: { symbol: string; limit?: number }): Promise<SmartMoneyEvent[]>;
  getDiagnostics?(symbol: string): Promise<SmartMoneyDiagnosticsReport | null>;
};
