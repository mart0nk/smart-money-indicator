# TradingView Publishing

The repository stores the canonical Pine source. Publishing to TradingView is a manual release step.

## Release Modes

- Development: private TradingView script.
- Beta: private or protected shared script, no paid access.
- Commercial paid access: public invite-only only if the TradingView account and TradingView rules allow it.

Do not sell access to private scripts. Keep paid access decisions separate from the repository artifact.

## Private Beta Gate

Before private beta:

- Pine compiles in TradingView Pine Editor v6.
- The script uses `indicator()`.
- No MTF request functions are present.
- No SMI API endpoint strings are present.
- No entry/exit command language is present.
- Object cleanup works when maximum zones are exceeded.
- Bullish and bearish FVG golden cases pass.
- Sweep golden cases pass.
- Invalidation cases pass.
- Alerts are context-only.
