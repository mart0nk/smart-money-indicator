# Canonical Facts

SMI facts describe observable primitives, never a setup selection or trade instruction.

| Fact | Meaning | Forbidden interpretation |
|---|---|---|
| `FVG_ZONE_AVAILABLE` | Closed three-candle pattern created a valid FVG AOI. | Entry or WATCHLIST verdict. |
| `PRICE_RETURNED_TO_FVG` | Price traded back into FVG bounds. | Trigger confirmation. |
| `FVG_REACTION_CONFIRMED` | Price-action evidence closed back away from the FVG. | Risk approval. |
| `ORDER_BLOCK_AVAILABLE` | Configured BOS/displacement/origin rules created an OB AOI. | Institutional order proof. |
| `PRICE_RETURNED_TO_ORDER_BLOCK` | Price traded into OB bounds. | Setup selection. |
| `ORDER_BLOCK_REACTION_CONFIRMED` | Price-action evidence closed away from the OB. | Execution signal. |
| `SELL_SIDE_SWEEP_DETECTED` / `BUY_SIDE_SWEEP_DETECTED` | Price swept a supplied reference and closed back. | LONG/SHORT compatibility decision. |

`INVALIDATED` lifecycle outcomes are terminal. `SWEEP_STALE` reports TTL expiry only.
