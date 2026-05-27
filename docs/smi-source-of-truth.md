# SMI Source Of Truth

All backend/package Smart Money logic belongs in `packages/smart-money-indicator/core`.

TradingView Pine is a standalone visual implementation of `packages/smart-money-indicator/docs/smi-rules-v1.md`. It is not the backend source of truth, does not import TypeScript core, and does not call SMI API endpoints.

Do not add duplicate SMC detector logic under Trader Agent `src`. Trader Agent provides runtime adapters, reference levels and downstream decision logic.

Allowed imports:

- `@trader-agent/smart-money-indicator-core`
- `packages/smart-money-indicator/tradingview/pine/gecko_smart_money_indicator_v1.pine` as a TradingView artifact, not as runtime TypeScript code

Forbidden imports:

- `src/smc/*`
- `../smc/*`
- `../../../smc/*`
- `@trader-agent/smart-money-indicator-core/legacy`
- SMI-owned HTTP, WATCHLIST, trigger, risk, alert or execution modules
