# SMI Source Of Truth

All backend/package Smart Money logic belongs in `packages/smart-money-indicator/core`.

TradingView Pine is a standalone visual implementation of `packages/smart-money-indicator/docs/smi-rules-v1.md`. It is not the backend source of truth, does not import TypeScript core, and does not call SMI API endpoints.

New code must not import `src/smc`.

Allowed imports:

- `@trader-agent/smart-money-indicator-core`
- `@trader-agent/smart-money-indicator-core/legacy` during migration only
- `@trader-agent/smart-money-indicator-api`
- `packages/smart-money-indicator/tradingview/pine/gecko_smart_money_indicator_v1.pine` as a TradingView artifact, not as runtime TypeScript code

Forbidden imports:

- `src/smc/*`
- `../smc/*`
- `../../../smc/*`
