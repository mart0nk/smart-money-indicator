# Smart Money Indicator v1

Smart Money Indicator is a multi-timeframe SMC/AOI primitive engine. Its v2 contract returns AOIs, sweeps, canonical facts, lifecycle events and violations, with optional in-memory closed-candle buffering.

It is not a trading bot. It does not emit BUY/SELL commands, create watches, confirm triggers, size risk, execute orders, track PnL, produce `AgentDecision`, or call `FinalEntryGuard`.

## Packages

- `@trader-agent/smart-money-indicator-core`: deterministic TypeScript engine and optional rolling buffer.

## TradingView Delivery Target

`packages/smart-money-indicator/tradingview` contains a standalone TradingView Pine Script artifact.

The Pine script is a current-chart-timeframe visual overlay. It does not import the TypeScript core, does not call the SMI API, and does not depend on Trader Agent runtime services.

The TypeScript core remains the backend/package source of truth. Pine implements a visual subset of `docs/smi-rules-v1.md`; parity is semantic, not byte-for-byte or runtime-identical.

HTTP, persistence and trading-runtime adapters belong to Trader Agent, not this package.
