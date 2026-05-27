# Smart Money Indicator

Standalone Smart Money Indicator packages for Trader Agent.

## Packages

- `@trader-agent/smart-money-indicator-core`: pure TypeScript SMC/AOI engine.
- `@trader-agent/smart-money-indicator-api`: optional read-only Express router over the core package.

## Commands

```sh
npm install
npm run typecheck
npm test
npm run build
```

## Boundaries

The core package has no HTTP, database, exchange, execution, position, portfolio, or Trader Agent runtime dependencies.

The API package exposes read-only `/smi/v1/*` and `/debug/smi/v1/*` routes. It does not create orders, watches, triggers, risk decisions, positions, portfolio mutations, or agent decisions.
