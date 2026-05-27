# Temporal Semantics

- `sourceTime`: origin candle or supplied reference-level event time.
- `availableFrom`: first timestamp at which evidence is observable on closed candles.
- `observedAt`: caller cursor at which SMI returns the AOI, fact or event.
- `eventTime`: closed-candle timestamp at which a lifecycle transition occurred.
- `cursorMs`: visibility upper bound supplied by the caller.

Every emitted AOI/fact obeys `sourceTime <= availableFrom <= observedAt <= cursorMs`. Forming or future candles are rejected with violations and never contribute to output.

The rolling engine keeps closed candles only. For the same initial state, update sequence and config, it returns the same output sequence.
