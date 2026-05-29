# Real-data SMI fixtures

These fixtures are committed deterministic test inputs. Unit and regression tests must not fetch live market data.

## Source

Source: Binance public spot klines API (`/api/v3/klines`)

Range start: `2024-01-01T00:00:00.000Z`

Timestamp convention: `openTime` and `closeTime` are UTC milliseconds. Binance kline close timestamps are stored as exclusive close times by adding `1ms`, so each candle duration matches the SMI timeframe interval exactly.

Closed candles only: yes

Validation: fixtures are loaded by the v2 engine validation tests and real-data replay tests. Each candle has finite positive OHLC, non-negative volume, increasing `openTime`/`closeTime`, and `closed: true`.

Update policy: manual only. Do not fetch data during tests. If fixtures are refreshed, review the regression summary snapshot diffs.

## Broad samples

Tier 1:

- `BTCUSDT-15m-sample.json`
- `BTCUSDT-3m-sample.json`
- `BTCUSDT-1h-sample.json`
- `ETHUSDT-15m-sample.json`
- `ETHUSDT-3m-sample.json`
- `ETHUSDT-1h-sample.json`

Tier 2:

- `SOLUSDT-15m-sample.json`
- `SOLUSDT-3m-sample.json`
- `SOLUSDT-1h-sample.json`
- `BNBUSDT-15m-sample.json`
- `BNBUSDT-3m-sample.json`
- `BNBUSDT-1h-sample.json`
- `XRPUSDT-15m-sample.json`
- `XRPUSDT-3m-sample.json`
- `XRPUSDT-1h-sample.json`

Broad samples are used for deterministic replay, rolling/stateless parity, and summary regression snapshots.

## Curated cases

Curated cases under `cases/` use smaller real candle windows selected from the broad samples. Some sweep cases include fixed reference levels so the engine can evaluate sweep evidence without relying on a live swing detector.

## Checksums

Regression summaries under `snapshots/` act as compact behavioral checksums for each broad sample. They intentionally snapshot counts and fact distributions instead of full engine output to keep diffs reviewable.
