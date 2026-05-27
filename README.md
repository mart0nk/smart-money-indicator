# Smart Money Indicator

Deterministic SMC/AOI primitives and optional closed-candle rolling buffers for Trader Agent.

## Packages

- `@trader-agent/smart-money-indicator-core`: deterministic TypeScript SMC/AOI engine with stateless and in-memory rolling entrypoints.
- `tradingview/`: visualization-only Pine artifact.

## Commands

```sh
npm install
npm run typecheck
npm test
npm run build
```

## Boundaries

The package may retain closed candles in memory through `createSmartMoneyRollingEngine()`. It has no HTTP, database, exchange, WATCHLIST, trigger, risk, alert, execution, position, portfolio, or Trader Agent orchestration dependencies.
