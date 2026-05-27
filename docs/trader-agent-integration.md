# Trader-Agent Integration

Trader Agent imports `@trader-agent/smart-money-indicator-core` through its `SmartMoneyProvider` adapter.

- Live/replay orchestration sends newly closed candles to `createSmartMoneyRollingEngine()`.
- Trader Agent generates visible `LiquidityReferenceLevel[]` and passes them to SMI for sweep evaluation.
- Phase 5 consumes canonical SMI AOIs/facts; Phase 6 maps those facts to setup models.

Exchange ingestion, resampling, persistence, replay cursors, reference-level generation, market context, WATCHLIST, trigger, risk, alerts, execution, `AgentDecision` and `FinalEntryGuard` remain outside SMI.

SMI exposes no Express router or state-store/candle-provider API.
