# `/debug/smc/*` Deprecation

`/debug/smc/*` endpoints are deprecated compatibility wrappers over SMI legacy exports.

Use `/smi/v1/*` and `/debug/smi/v1/*` for new work.

Compatibility responses include:

```ts
meta: {
  deprecated: true,
  replacement: "/smi/v1/...",
  idPolicy: "STABLE_ZONE_ID",
  deprecatedRandomIds: true
}
```

Removal target: release N+1.
