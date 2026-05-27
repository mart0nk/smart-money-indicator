# TradingView Script Plan

TradingView SMI v1 is the third Smart Money Indicator delivery target.

It is a standalone Pine Script visual overlay for the current chart timeframe. It is not an npm package and does not import the TypeScript core.

## Delivery Targets

- `core/`: full TypeScript SMI engine package.
- TradingView Pine Script: standalone current-timeframe visual overlay.

## v1 Scope

The Pine script detects and draws:

- confirmed swing highs and lows
- optional HH / HL / LH / LL labels
- BOS / CHoCH labels
- bullish and bearish FVGs
- bullish and bearish order blocks
- liquidity pools from swings
- sell-side and buy-side sweeps
- zone lifecycle state
- midpoint / CE lines
- reaction markers
- invalidated zones
- primitive visibility labels
- context-only alerts

## Exclusions

Pine v1 does not include:

- MTF or HTF overlays
- backend/API synchronization
- TypeScript runtime sharing
- strategy orders
- watch, trigger, risk, execution, PnL or portfolio behavior

## Implementation Sequence

1. Add the Pine artifact and TradingView docs.
2. Implement current-timeframe structure.
3. Implement current-timeframe FVGs.
4. Implement current-timeframe sweeps.
5. Implement order blocks from BOS and the last opposite candle.
6. Implement zone lifecycle and object cleanup.
7. Implement context-only alerts.
8. Add manual golden chart cases.
9. Publish a private development script.
