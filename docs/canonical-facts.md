# Canonical Facts

SMI facts describe observable primitives, never a setup selection or trade instruction.

## v2 Fact Rename Migration

- `PRICE_RETURNED_TO_FVG` was renamed to `IMBALANCE_PULLBACK_LOCATION_CONFIRMED`.
- `PRICE_RETURNED_TO_ORDER_BLOCK` was renamed to `PULLBACK_INTO_ORDER_BLOCK`.

These names are the canonical v2 contract. Consumers should migrate off the legacy names.

| Fact | Meaning | Forbidden interpretation |
|---|---|---|
| `FVG_ZONE_AVAILABLE` | Closed three-candle pattern created a valid FVG AOI. | Entry or WATCHLIST verdict. |
| `IMBALANCE_PULLBACK_LOCATION_CONFIRMED` | Price traded back into FVG bounds. | Trigger confirmation. |
| `FVG_REACTION_CONFIRMED` | Price-action evidence closed back away from the FVG. | Risk approval. |
| `ORDER_BLOCK_AVAILABLE` | Configured BOS/displacement/origin rules created an OB AOI. | Institutional order proof. |
| `PULLBACK_INTO_ORDER_BLOCK` | Price traded into OB bounds. | Setup selection. |
| `ORDER_BLOCK_REACTION_CONFIRMED` | Price-action evidence closed away from the OB. | Execution signal. |
| `SELL_SIDE_SWEEP_DETECTED` / `BUY_SIDE_SWEEP_DETECTED` | Price swept a supplied reference and closed back. | LONG/SHORT compatibility decision. |

`INVALIDATED` lifecycle outcomes are terminal. `SWEEP_STALE` reports TTL expiry only.
