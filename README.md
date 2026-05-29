# Smart Money Indicator

Deterministic Smart Money Concepts (SMC) and Area of Interest (AOI) primitives for TypeScript applications, backtesting pipelines, screeners, dashboards, and TradingView-assisted analysis.

The package provides a pure market-structure engine that works from caller-provided candle data. It is designed to identify and maintain closed-candle-safe SMC/AOI structures such as imbalance/FVG zones, order-block-style zones, liquidity sweep evidence, mitigation/invalidation state, and zone lifecycle context.

It does **not** fetch market data, place trades, manage risk, send alerts, or act as a trading bot.

## What this package is

`smart-money-indicator` is a deterministic analysis library.

Given a sequence of closed OHLCV candles and configuration, it produces structured SMC/AOI output that can be consumed by:

* trading dashboards
* backtesting systems
* research tools
* signal engines
* higher-level strategy orchestration
* TradingView visual overlays

The engine is intended to act as a **truth layer for market-structure primitives**, not as a standalone trading strategy.

## What this package is not

This package does **not** provide:

* exchange connectivity
* HTTP clients
* database persistence
* websocket subscriptions
* order execution
* position management
* portfolio logic
* risk management
* alerts or notifications
* watchlist orchestration
* trade triggers
* buy/sell recommendations

SMC primitives such as sweeps, FVG touches, order-block touches, CE/midpoint touches, mitigation, and invalidation are treated as **evidence and context**. They are not direct LONG/SHORT triggers by themselves.

## Packages

This repository contains the following workspaces:

### `core/`

Deterministic TypeScript SMC/AOI engine.

It includes:

* stateless evaluation entrypoints
* optional in-memory rolling evaluation
* closed-candle SMC/AOI primitive detection
* zone lifecycle state
* sweep and reaction evidence
* mitigation and invalidation context
* typed configuration and output contracts

### `tradingview/`

Visualization-only Pine artifact.

The TradingView script is a visual aid for inspecting zones and market-structure context. It is not the source of truth for the engine and should not be used as a parity oracle for tests.

## Installation

```bash
npm install
```

## Development commands

```bash
npm run typecheck
npm test
npm run build
npm run smoke:exports
```

## Public package entrypoint

Consumers should import from the root package:

```ts
import { runSmartMoneyEngine } from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';
```

The root package is the public consumer entrypoint. Internal workspace package names should not be treated as the preferred public API.

## Quick start

```ts
import { runSmartMoneyEngine } from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';

const snapshot = runSmartMoneyEngine({
  symbol: 'BTCUSDT',
  timeframe: '5m',
  candles,
  config: defaultSmartMoneyConfig,
});

console.log(snapshot.zones);
console.log(snapshot.sweeps);
console.log(snapshot.warnings);
```

The exact output shape is structured and typed so downstream systems can reason about zones, lifecycle state, evidence, and diagnostics without parsing chart annotations.

## Stateless engine

Use the stateless entrypoint when the caller already owns the candle window.

This is the preferred mode for:

* backtesting
* historical replay
* deterministic research
* server-side evaluation
* reproducible tests

The caller is responsible for passing only the candles that should be visible at the current evaluation point.

For replay-safe testing, evaluate with candle prefixes:

```ts
for (let cursor = minBars; cursor < candles.length; cursor++) {
  const visibleCandles = candles.slice(0, cursor + 1);

  const snapshot = runSmartMoneyEngine({
    symbol: 'BTCUSDT',
    timeframe: '5m',
    candles: visibleCandles,
    config: defaultSmartMoneyConfig,
  });

  // Assert against point-in-time-safe output here.
}
```

## Rolling engine

For live-like applications, the package may retain closed candles in memory through `createSmartMoneyRollingEngine()`.

Use the rolling engine when the application wants to append closed candles over time and evaluate the current structure without managing the rolling buffer externally.

The rolling engine is still local and deterministic. It does not connect to exchanges, databases, HTTP APIs, queues, or alerting systems.

```ts
import { createSmartMoneyRollingEngine } from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';

const engine = createSmartMoneyRollingEngine({
  symbol: 'BTCUSDT',
  timeframe: '5m',
  config: defaultSmartMoneyConfig,
});

engine.pushClosedCandle(candle);

const snapshot = engine.evaluate();
```

## Data contract

The engine is designed around closed-candle market structure.

Callers should provide candles that are:

* sorted oldest to newest
* closed before evaluation
* free from duplicate timestamps
* consistent with the declared timeframe
* valid OHLCV candles
* sourced from a known market and price type

Recommended OHLCV invariants:

```txt
high >= open
high >= close
high >= low
low <= open
low <= close
low <= high
volume >= 0
openTime < closeTime
```

For backtesting and replay usage, callers must ensure the engine only receives candles that would have been available at the replay cursor. Passing future candles into a historical evaluation invalidates the result.

## Closed-candle safety

The engine is intended to work from closed candles only.

A zone, sweep, mitigation, invalidation, or lifecycle transition should only be derived from candles that are already available to the engine at evaluation time.

This matters because many market-structure concepts can look obvious in hindsight but are not valid until the confirming candles have closed.

Downstream systems should treat the engine output as point-in-time safe only when the input candle window is also point-in-time safe.

## Output model

The engine output is a structured snapshot of SMC/AOI context.

Depending on configuration and available data, the snapshot may include:

* SMC/AOI zones
* FVG / imbalance-style zones
* order-block-style zones
* liquidity sweep evidence
* mitigation and invalidation state
* lifecycle state
* warnings and diagnostics

Zones are represented as areas of interest, not single exact price lines.

The output is intended for downstream systems that need structured market-context data. It should not be interpreted as a trading signal by itself.

## Lifecycle and evidence

The engine separates **evidence** from **trade decisions**.

Examples of evidence:

* price swept liquidity and reclaimed
* price touched an imbalance
* price interacted with an order-block-style zone
* a zone was mitigated
* a zone was invalidated
* a reaction occurred from an AOI
* a zone remains fresh or has been tested

These events describe market structure. They do not automatically mean the caller should enter a position.

A strategy layer may consume this evidence together with its own rules for direction, confirmation, risk, execution, and portfolio management.

## Boundaries

The package may retain closed candles in memory through `createSmartMoneyRollingEngine()`.

It has no dependency on:

* HTTP
* databases
* exchanges
* websocket clients
* watchlist services
* trigger engines
* alerting systems
* order execution
* risk engines
* position tracking
* portfolio management
* external orchestration

This boundary is intentional. The package should remain deterministic, testable, and independent from infrastructure.

## Packaging migration

The core workspace package name changed from the old scoped name to:

```txt
smart-money-indicator-core
```

Consumers should depend on the root package and import from:

```ts
import { runSmartMoneyEngine } from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';
```

Existing consumers using the old scoped package name must update package references and imports.

Recommended consumer imports:

```ts
import { runSmartMoneyEngine } from 'smart-money-indicator';
import { createSmartMoneyRollingEngine } from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';
```

Avoid importing directly from workspace internals unless you are contributing to this repository.

## TradingView artifact

The `tradingview/` package is visualization-only.

It can help visually inspect the same market-structure ideas on a chart, but it should not be treated as the source of truth for:

* engine correctness
* test expectations
* historical replay parity
* production trading decisions

The TypeScript engine is the canonical implementation.

## Design principles

This package follows a few core principles:

1. **Deterministic over implicit**
   The same input should produce the same output.

2. **Closed-candle first**
   Market-structure evidence should be based on confirmed candles, not future information.

3. **Evidence, not execution**
   SMC/AOI events describe context. They are not trades by themselves.

4. **Pure engine boundary**
   Data loading, persistence, orchestration, alerts, and execution belong outside this package.

5. **Typed contracts**
   Consumers should integrate through typed inputs, typed configuration, and typed snapshots.

6. **Visualization is secondary**
   TradingView output is helpful for inspection, but the TypeScript engine is the source of truth.

## License

See the repository license.
