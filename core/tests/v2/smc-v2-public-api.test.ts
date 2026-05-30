import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index.js';
import * as configApi from '../../src/v2/smc-config.js';

describe('SMI core v2 public API', () => {
  it('exports the truth-layer engine APIs and config helpers', () => {
    expect(publicApi.runSmartMoneyEngine).toBeTypeOf('function');
    expect(publicApi.createSmartMoneyEngine).toBeTypeOf('function');
    expect(publicApi.createSmartMoneyRollingEngine).toBeTypeOf('function');
    expect(publicApi.validateCandles).toBeTypeOf('function');
    expect(publicApi.linkSweepToZone).toBeTypeOf('function');
    expect(publicApi.detectOrderBlockZones).toBeTypeOf('function');
    expect(publicApi.detectLiquiditySweeps).toBeTypeOf('function');
    expect(publicApi.defaultSmartMoneyConfig.version).toBe('smi-config-v2');
    expect(publicApi.primitiveResearchConfig.version).toBe('smi-config-v2-primitive-research');
    expect(publicApi.standardSmartMoneyConfig.version).toBe('smi-config-v2-standard');
    expect(publicApi.strictCryptoIntradayConfig.version).toBe('smi-config-v2-strict-crypto-intraday');
    expect(configApi.defaultSmartMoneyConfig).toEqual(publicApi.defaultSmartMoneyConfig);
    expect(configApi.resolveSmartMoneyConfig({ fvg: { minGapBps: 5 } }).fvg.minGapBps).toBe(5);
  });

  it('creates a stable open public snapshot wrapper without trading semantics', () => {
    const engine = publicApi.createSmartMoneyEngine(publicApi.strictCryptoIntradayConfig);
    const snapshot = engine.run({
      symbol: 'BTCUSDT',
      cursorTime: 1_700_000_900_000,
      candlesByTimeframe: {
        '15m': [
          {
            symbol: 'BTCUSDT',
            timeframe: '15m',
            openTime: 1_700_000_000_000,
            closeTime: 1_700_000_900_000,
            open: 100,
            high: 101,
            low: 99,
            close: 100.5,
            volume: 100,
            closed: true,
          },
        ],
      },
    });

    expect(snapshot.schemaVersion).toBe('smi.snapshot.v1');
    expect(snapshot.cursorTime).toBe(snapshot.cursorMs);
    expect(snapshot.zones).toBe(snapshot.aois);
    expect(snapshot.diagnostics.valid).toBe(snapshot.valid);
  });

  it('does not export trading-runtime concepts', () => {
    const forbiddenExports = [
      'createSmartMoneyRuntime',
      'evaluateSmartMoneySnapshot',
      'SmartMoneyAlert',
      'Watch',
      'Watchable',
      'Trigger',
      'Risk',
      'Alert',
      'Execution',
      'CandidateScore',
      'SetupModelHint',
      'SmartMoneyPosition',
      'SmartMoneyOrder',
    ];
    const exportedNames = Object.keys(publicApi);

    expect(forbiddenExports.filter((name) => exportedNames.some((item) => item.includes(name)))).toEqual([]);
  });
});
