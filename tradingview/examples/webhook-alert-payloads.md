# Webhook Alert Payload Examples

TradingView alerts are optional. Gecko SMI Pine v1 works without webhooks.

v1 uses fixed `alertcondition()` events. Users create actual alerts in the TradingView UI.

Future v1.1 work may add dynamic `alert()` messages for JSON-like webhook payloads.

## Example Payloads

Bullish FVG:

```json
{
  "source": "tradingview",
  "indicator": "gecko-smart-money-indicator-v1",
  "event": "SMI Bullish FVG detected",
  "symbol": "{{ticker}}",
  "timeframe": "{{interval}}",
  "barTime": "{{time}}",
  "price": "{{close}}",
  "contextOnly": true
}
```

Sell-side sweep:

```json
{
  "source": "tradingview",
  "indicator": "gecko-smart-money-indicator-v1",
  "event": "SMI Sell-side Sweep",
  "symbol": "{{ticker}}",
  "timeframe": "{{interval}}",
  "barTime": "{{time}}",
  "price": "{{close}}",
  "contextOnly": true
}
```

These payloads are examples only. They are not trading commands.
