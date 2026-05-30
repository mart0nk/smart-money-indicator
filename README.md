# Smart Money Indicator

Deterministic SMC/AOI primitives and optional closed-candle rolling buffers.

## Packages

- `core/`: deterministic TypeScript SMC/AOI engine with stateless and in-memory rolling entrypoints.
- `tradingview/`: visualization-only Pine artifact.

## Commands

```sh
npm install
npm run typecheck
npm test
npm run build
npm run smoke:exports
```

## Packaging

The root package is the public consumer entrypoint:

```ts
import {
  createSmartMoneyEngine,
  runSmartMoneyEngine,
  strictCryptoIntradayConfig,
} from 'smart-money-indicator';
import { defaultSmartMoneyConfig } from 'smart-money-indicator/config';
import type { Candle, SmartMoneySnapshot } from 'smart-money-indicator/types';
```

`smart-money-indicator/profiles` exposes `primitiveResearchConfig`, `standardSmartMoneyConfig` and `strictCryptoIntradayConfig`.

Packaging migration:

- The core workspace package name changed from the old scoped name to `smart-money-indicator-core`.
- Consumers should depend on the root package and import from `smart-money-indicator` or `smart-money-indicator/config`.
- Existing consumers using the old scoped package name must update package references and imports.

## Boundaries

The package may retain closed candles in memory through `createSmartMoneyRollingEngine()`. It has no HTTP, database, exchange, watch, trigger, risk, alert, execution, position, portfolio, or external orchestration dependencies.
