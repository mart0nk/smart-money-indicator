# Pine Vs Core Parity

TypeScript core is the backend/package source of truth for Smart Money Indicator behavior.

TradingView Pine is a standalone visual implementation of `packages/smart-money-indicator/docs/smi-rules-v1.md`.

## Parity Model

Parity is semantic, not runtime-identical.

The Pine script and TypeScript core should agree on core rule definitions:

- FVG shape
- OB origin concept
- sweep semantics
- midpoint / CE behavior
- invalidation by close beyond zone edge
- context-only alert language

The Pine output is not guaranteed to match TypeScript output byte-for-byte because Pine has a different runtime, chart-scoped data, drawing limits, and no shared TypeScript state.

## Boundary

Pine output must not be used as backend execution authority.

Trader Agent runtime decisions remain outside the Pine script and outside SMI context generation.
