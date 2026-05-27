# Pine Limitations

TradingView Pine Script is a chart runtime. Gecko SMI Pine v1 is intentionally current-timeframe-only and standalone.

## Standalone Input

The Pine script uses only chart OHLCV data, `time`, and `bar_index`. It does not call external endpoints or services.

## No MTF In v1

Pine v1 does not request higher or lower timeframe data. If a user opens a 15m chart, the script displays 15m SMI context. If the user switches to 1H, the same script displays 1H SMI context.

## Object Limits

TradingView limits drawing objects. The script sets explicit object limits and exposes inputs for maximum zones, liquidity levels, labels, and invalidated zone display.

When the maximum count is exceeded, the oldest related objects are removed together so boxes, midpoint lines, and labels do not become orphaned.

## Display Modes

The script uses a display mode input and derived visibility controls:

- Clean: prioritized visual context with structure labels, swing labels, invalidated zones, and per-zone status labels hidden.
- Normal: more chart detail while still avoiding full debug output.
- Debug: all configured diagnostic visuals.

Pine inputs do not dynamically change default values after another input changes, so display mode is applied through effective visibility booleans at runtime.

## Confirmation Delay

Swing points use pivot confirmation. A swing label can appear after the right-side pivot confirmation delay. This is expected and avoids marking unconfirmed swings.

## No-Repaint Policy

SMI events are confirmed on closed bars. Confirmed zones are not repainted. Forming-bar context is not used for alerts.

New zones are not eligible for touch, midpoint touch, reaction, or invalidation on the same bar where they are created.

## Sweep Dedupe

One confirmed swing high or low can emit one sweep marker. The swept flag resets only when a new confirmed swing is created.
