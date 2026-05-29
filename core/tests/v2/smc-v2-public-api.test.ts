import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index.js';
import * as configApi from '../../src/v2/smc-config.js';

describe('SMI core v2 public API', () => {
  it('exports the truth-layer engine APIs and config helpers', () => {
    expect(publicApi.runSmartMoneyEngine).toBeTypeOf('function');
    expect(publicApi.createSmartMoneyRollingEngine).toBeTypeOf('function');
    expect(publicApi.defaultSmartMoneyConfig.version).toBe('smi-config-v2');
    expect(configApi.defaultSmartMoneyConfig).toEqual(publicApi.defaultSmartMoneyConfig);
    expect(configApi.resolveSmartMoneyConfig({ fvg: { minGapBps: 5 } }).fvg.minGapBps).toBe(5);
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
