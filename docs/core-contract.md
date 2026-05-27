# SMI Core Contract v2

The core package owns deterministic SMC/AOI computation, canonical facts/events/violations, stable IDs, validation and an optional in-memory rolling closed-candle buffer.

Public entrypoints:

- `runSmartMoneyEngine(input)`: stateless calculation from explicit visible history.
- `createSmartMoneyRollingEngine(config)`: stateful candle-buffer wrapper that calls the stateless calculation.

The rolling engine stores candles and buffer diagnostics only. It does not store WATCHLIST, setup-model, trigger, risk, alert, execution, replay-runner, provider or persistent database state.

The core has no HTTP, exchange, persistence or trading-decision dependencies.
