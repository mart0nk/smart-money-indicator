const root = await import('smart-money-indicator');
const config = await import('smart-money-indicator/config');

if (typeof root.runSmartMoneyEngine !== 'function') {
  throw new Error('Missing runSmartMoneyEngine from root package export.');
}

if (typeof root.createSmartMoneyRollingEngine !== 'function') {
  throw new Error('Missing createSmartMoneyRollingEngine from root package export.');
}

if (config.defaultSmartMoneyConfig?.version !== 'smi-config-v2') {
  throw new Error('Missing defaultSmartMoneyConfig from ./config export.');
}
