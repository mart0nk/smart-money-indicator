# SMI Source Of Truth

All Smart Money logic belongs in `packages/smart-money-indicator/core`.

New code must not import `src/smc`.

Allowed imports:

- `@trader-agent/smart-money-indicator-core`
- `@trader-agent/smart-money-indicator-core/legacy` during migration only
- `@trader-agent/smart-money-indicator-api`

Forbidden imports:

- `src/smc/*`
- `../smc/*`
- `../../../smc/*`
