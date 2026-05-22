# SMI API Contract

The API package exposes a reusable Express router factory:

```ts
createSmartMoneyApiRouter({
  candleProvider,
  engine,
  config,
  stateStore,
  defaultLookback,
});
```

The API package is read-only. It exposes `/smi/v1/*` and `/debug/smi/v1/*` endpoints, but never creates orders, watches, triggers, risk decisions, positions, portfolio mutations or agent decisions.

The API package does not know where candles come from. Runtimes provide a `SmartMoneyCandleProvider` that returns closed candles only.
