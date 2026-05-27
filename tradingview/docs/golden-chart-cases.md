# Golden Chart Cases

Use these cases for manual TradingView QA before private beta.

## FVG

- Bullish FVG: candle 1 high is below candle 3 low. The script draws a bullish FVG box and midpoint.
- Bearish FVG: candle 1 low is above candle 3 high. The script draws a bearish FVG box and midpoint.
- Impulse filter: when enabled, bullish FVG requires a bullish impulse middle candle and bearish FVG requires a bearish impulse middle candle.
- Midpoint touch: price touches the midpoint / CE line and the zone remains valid.
- Creation bar guard: a newly created FVG does not become touched, reacted, or invalidated on the same bar where it is created.

## Invalidation

- Bullish invalidation: a closed candle closes below the bullish zone low.
- Bearish invalidation: a closed candle closes above the bearish zone high.
- If invalidated zones are visible, the zone is faded and marked invalidated.
- If invalidated zones are hidden, the zone box, midpoint line, and label are deleted.

## Sweeps

- Sell-side sweep: wick below a confirmed swing low and close back above it.
- Buy-side sweep: wick above a confirmed swing high and close back below it.
- Close beyond the swing level is not a sweep.
- Sweep dedupe: one confirmed swing low can emit only one sell-side sweep until a new swing low is confirmed.
- Sweep dedupe: one confirmed swing high can emit only one buy-side sweep until a new swing high is confirmed.

## Order Blocks

- Bullish OB: bullish BOS occurs and the last bearish candle within the configured lookback is drawn as demand context.
- Bearish OB: bearish BOS occurs and the last bullish candle within the configured lookback is drawn as supply context.
- OB touch and midpoint touch update context only.
- OB dedupe: the same origin candle does not create duplicate OB zones.

## Reaction

- Reaction requires a recent zone touch within `Reaction max bars after touch`.
- A close beyond midpoint does not confirm reaction when the touch is older than the reaction window.
- `Close outside zone` mode is stricter than `Close beyond midpoint` mode.

## Object Lifecycle

- Set maximum FVG zones to a low value and confirm old FVG boxes, midpoint lines, and labels are deleted together.
- Set maximum OB zones to a low value and confirm old OB boxes, midpoint lines, and labels are deleted together.

## Display Modes

- Clean mode hides HH / HL / LH / LL labels.
- Clean mode hides BOS / CHoCH labels.
- Clean mode hides invalidated zones.
- Clean mode hides per-zone status labels.
- Normal mode can show configured structure and recently invalidated zones.
- Debug mode can show all configured visual diagnostics.

## Liquidity Lines

- Historical liquidity line mode does not extend old liquidity lines.
- Active liquidity line mode extends liquidity lines to the latest bar.

## Alerts

- Context alerts appear as selectable TradingView alert conditions.
- Alert names do not contain entry, exit, or execution language.
