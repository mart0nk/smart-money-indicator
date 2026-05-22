# SMI Core Contract

The core package owns SMC computation only. It has no HTTP, database, exchange, trader-agent runtime, risk, execution, position or portfolio dependencies.

Core supports two modes:

- `STATELESS_REBUILD`: rebuild a snapshot from candle history.
- `INCREMENTAL`: accept `previousState` plus new closed candles and return `nextState`.

The core does not decide where state is stored. Callers may persist `SmartMoneyEngineState` in memory, Redis, Postgres, SQLite, a file snapshot, trader-agent storage, or a standalone SMI service store.

Every output includes proof metadata with cursor, closed-candle and lookahead safety fields.
