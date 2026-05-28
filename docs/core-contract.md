# SMI Core Contract v2

The core package owns deterministic SMC/AOI computation, canonical facts/events/violations, stable IDs, validation and an optional in-memory rolling closed-candle buffer.

Public entrypoints:

- `runSmartMoneyEngine(input)`: stateless calculation from explicit visible history.
- `createSmartMoneyRollingEngine(config)`: stateful candle-buffer wrapper that calls the stateless calculation.

The rolling engine stores candles and buffer diagnostics only. It does not store WATCHLIST, setup-model, trigger, risk, alert, execution, replay-runner, provider or persistent database state.

The core has no HTTP, exchange, persistence or trading-decision dependencies.

## Validation Semantics

`SmartMoneyEngineOutput.valid` is `false` when the run contains at least one `FATAL` violation.

- `strictMode: true`: any `FATAL` validation/config violation returns a deterministic safe-empty output. AOIs, sweeps, facts and events are empty; violations are still returned.
- `strictMode: false`: the engine may return partial output from valid normalized candles, but `valid` remains `false`. Forbidden source-zone timeframes are always filtered and never create FVG/OB zones.

All candles used by the core must be closed and must have finite positive OHLC prices. Zero or negative prices are malformed input.
