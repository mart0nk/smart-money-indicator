# SMI Migration Status

`src/smc` and the SMI HTTP package have been removed. Smart Money Indicator core is the source of truth.

## Guard Command

```sh
npm run check:no-legacy-smc-imports
```

## Current Runtime Surface

- `@trader-agent/smart-money-indicator-core`
- `src/smart-money-indicator/*` for Trader Agent runtime adapters only

## Removed Surface

- `src/smc/*`
- `@trader-agent/smart-money-indicator-core/legacy`
- `@trader-agent/smart-money-indicator-api`

## v2 Surface

- `runSmartMoneyEngine()` for deterministic one-shot calculation.
- `createSmartMoneyRollingEngine()` for in-memory closed-candle buffering and the same canonical output.
- Canonical facts carry `sourceTime`, `availableFrom` and `observedAt`; lifecycle events carry `eventTime` and `observedAt`.

## Preserved Logic

| Primitive | Current module | Tests |
|---|---|---|
| FVG detection | `core/src/zones/fvg-detector.ts` | `core/tests/primitives/fvg.test.ts` |
| Order block detection | `core/src/zones/order-block-detector.ts` | `core/tests/primitives/order-block.test.ts` |
| Liquidity sweep detection/scoring | `core/src/liquidity/liquidity-sweep-detector.ts` | `core/tests/primitives/liquidity-sweep.test.ts` |
| Mitigation scoring | `core/src/aoi/mitigation-scoring.ts` | `core/tests/primitives/mitigation-reaction-volume.test.ts` |
| Reaction evidence | `core/src/aoi/reaction-evidence-builder.ts` | `core/tests/primitives/mitigation-reaction-volume.test.ts` |
| Volume evidence | `core/src/quality/volume-evidence.ts` | `core/tests/primitives/mitigation-reaction-volume.test.ts` |
