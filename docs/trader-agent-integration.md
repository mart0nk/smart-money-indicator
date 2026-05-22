# Trader-Agent Integration

Trader-agent can use SMI in two v1 modes:

1. Package-only mode: import `@trader-agent/smart-money-indicator-core` and call the engine directly.
2. Embedded API mode: mount the router from `@trader-agent/smart-money-indicator-api`.

Trader-agent provides:

- a candle provider
- optional state store
- optional config

Trader-agent does not own or manually implement `/smi/v1/*` endpoints. Those endpoints live in the SMI API package.

WATCH, TRIGGER, Risk, Execution, `AgentDecision` and `FinalEntryGuard` remain outside SMI.
