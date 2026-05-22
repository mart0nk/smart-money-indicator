# SMI Rules v1

This document is the shared rule specification for Smart Money Indicator v1 implementations.

The TypeScript core package implements the full backend/package engine. The TradingView Pine Script implements a standalone visual subset for the current chart timeframe. Parity is semantic: Pine output is not expected to be byte-for-byte or runtime-identical to the TypeScript core output.

## Boundary

SMI rules describe context only. They do not create entries, watches, trigger confirmations, risk sizing, orders, execution, positions, portfolio mutations, PnL claims, `AgentDecision`, or `FinalEntryGuard` output.

## Candle Safety

Events are confirmed on closed candles only.

Confirmed zones must not repaint. Pivot-based swing labels can appear after the right-side pivot confirmation delay.

## Structure

Swing highs and lows are confirmed by a configurable left/right pivot window.

BOS is a close beyond a confirmed swing by default.

CHoCH is a close beyond the opposite protected swing against the current structure bias.

## FVG

Bullish FVG:

- candle 1 high is below candle 3 low
- optional legacy-compatible impulse filter requires candle 2 to close above open
- zone low is candle 1 high
- zone high is candle 3 low

Bearish FVG:

- candle 1 low is above candle 3 high
- optional legacy-compatible impulse filter requires candle 2 to close below open
- zone low is candle 3 high
- zone high is candle 1 low

Midpoint / CE touch updates mitigation context only. It is not an entry, trigger, or automatic invalidation.

Bullish FVG invalidation: close below zone low.

Bearish FVG invalidation: close above zone high.

## Order Blocks

Bullish OB is the last bearish candle before bullish displacement / BOS.

Bearish OB is the last bullish candle before bearish displacement / BOS.

OB touch and midpoint touch update mitigation context only. They are not entries, triggers, or automatic invalidations.

## Liquidity Sweeps

Sell-side sweep:

- price trades below a valid reference low
- the same closed candle closes back above the reference low

Buy-side sweep:

- price trades above a valid reference high
- the same closed candle closes back below the reference high

A close beyond the reference level is a break/BOS candidate, not a sweep.

One reference swing should not emit unlimited sweep markers. Sweep evidence is fresh only for the current reference lifecycle and should reset when a new confirmed reference swing appears.

## Lifecycle

A newly detected zone is not eligible for touch, mitigation, reaction, or invalidation on its creation bar.

Reaction requires a recent touch. The visual Pine implementation supports a configurable reaction window and a midpoint-vs-outside-zone reaction mode.

## Pine Status Labels

TradingView Pine uses a narrower visual status set:

- `PINE_CONTEXT_ONLY`
- `PINE_WATCHABLE`
- `PINE_WAIT_FOR_REACTION`
- `PINE_REACTION_CONFIRMED`
- `PINE_INVALIDATED`

Pine does not use `TRIGGER_READY`.

## Alerts

Alerts are context-only. They must not use entry, execution, or guaranteed outcome language.
