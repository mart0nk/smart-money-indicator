# SMI Migration Inventory

`src/smc` is deprecated. Smart Money Indicator core is the source of truth.

## Inventory Command

```sh
rg "src/smc|../smc|../../../smc" src packages tests
```

## Current Legacy Surface

Production imports before migration:

- `src/app/express-server/routes/debug-smc.routes.ts`
- `src/setup/setup.types.ts`

Test imports before migration:

- `tests/smc/fvg-detector.test.ts`
- `tests/smc/fvg-types.test.ts`
- `tests/smc/order-block-detector.test.ts`
- `tests/smc/liquidity-sweep.test.ts`
- `tests/smc/mitigation-scoring.test.ts`
- `tests/smc/reaction-evidence.test.ts`
- `tests/smc/volume-evidence.test.ts`
- `tests/smc/smc-primitives-e2e.test.ts`

Debug route contracts:

- `/debug/smc/swing-points/:symbol`
- `/debug/smc/bos/:symbol`
- `/debug/smc/liquidity-sweeps/:symbol`
- `/debug/smc/fvg/:symbol`
- `/debug/smc/order-blocks/:symbol`

Legacy debug responses are compatibility-only and now include deprecation metadata plus stable ID policy metadata.

## Migration Matrix

| Legacy file | SMI module | Compatibility export | Tests |
|---|---|---|---|
| `src/smc/fvg-detector.ts` | `core/src/zones/fvg-detector.ts` | `core/legacy/detectLegacyFvgZones` | `core/tests/legacy-compat/fvg.test.ts` |
| `src/smc/order-block-detector.ts` | `core/src/zones/order-block-detector.ts` | `core/legacy/detectLegacyOrderBlocks` | `core/tests/legacy-compat/order-block.test.ts` |
| `src/smc/liquidity-sweep-detector.ts` | `core/src/liquidity/liquidity-sweep-detector.ts` | `core/legacy/detectLegacyLiquiditySweep` | `core/tests/legacy-compat/liquidity-sweep.test.ts` |
| `src/smc/mitigation-scoring.ts` | `core/src/aoi/mitigation-scoring.ts` | `core/legacy/calculateLegacyMitigationPenalty` | `core/tests/legacy-compat/mitigation.test.ts` |
| `src/smc/reaction-evidence-builder.ts` | `core/src/aoi/reaction-evidence-builder.ts` | `core/legacy/hasLegacyReactionEvidence` | `core/tests/legacy-compat/reaction.test.ts` |
| `src/smc/volume-evidence.ts` | `core/src/quality/volume-evidence.ts` | `core/legacy/scoreLegacyVolumeEvidence` | `core/tests/legacy-compat/volume.test.ts` |

Removal target: release N+1.
