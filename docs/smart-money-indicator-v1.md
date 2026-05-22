# Smart Money Indicator v1

Smart Money Indicator v1 is a multi-timeframe SMC/AOI context engine. It detects structure, FVGs, order blocks, liquidity pools, liquidity sweeps, mitigation, reactions and invalidations, then returns context snapshots, state, events, alerts and diagnostics.

It is not a trading bot. It does not emit BUY/SELL commands, create watches, confirm triggers, size risk, execute orders, track PnL, produce `AgentDecision`, or call `FinalEntryGuard`.

## Packages

- `@trader-agent/smart-money-indicator-core`: pure TypeScript engine.
- `@trader-agent/smart-money-indicator-api`: optional read-only HTTP router over the core package.

## TradingView Delivery Target

`packages/smart-money-indicator/tradingview` contains a standalone TradingView Pine Script artifact.

The Pine script is a current-chart-timeframe visual overlay. It does not import the TypeScript core, does not call the SMI API, and does not depend on Trader Agent runtime services.

The TypeScript core remains the backend/package source of truth. Pine implements a visual subset of `docs/smi-rules-v1.md`; parity is semantic, not byte-for-byte or runtime-identical.

The default v1 deployment is core plus embedded API router. Standalone service deployment is intentionally possible later, but not required for v1.
