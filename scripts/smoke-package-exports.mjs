import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const root = await import('smart-money-indicator');
const config = await import('smart-money-indicator/config');
const profiles = await import('smart-money-indicator/profiles');
await import('smart-money-indicator/types');
await import('smart-money-indicator/testing');

if (packageJson.private === true) {
  throw new Error('Root package is documented as the public consumer entrypoint but is marked private.');
}

if (typeof root.runSmartMoneyEngine !== 'function') {
  throw new Error('Missing runSmartMoneyEngine from root package export.');
}

if (typeof root.createSmartMoneyRollingEngine !== 'function') {
  throw new Error('Missing createSmartMoneyRollingEngine from root package export.');
}

if (typeof root.createSmartMoneyEngine !== 'function') {
  throw new Error('Missing createSmartMoneyEngine from root package export.');
}

if (typeof root.validateCandles !== 'function') {
  throw new Error('Missing validateCandles from root package export.');
}

if (typeof root.linkSweepToZone !== 'function') {
  throw new Error('Missing linkSweepToZone from root package export.');
}

if (config.defaultSmartMoneyConfig?.version !== 'smi-config-v2') {
  throw new Error('Missing defaultSmartMoneyConfig from ./config export.');
}

if (profiles.strictCryptoIntradayConfig?.version !== 'smi-config-v2-strict-crypto-intraday') {
  throw new Error('Missing strictCryptoIntradayConfig from ./profiles export.');
}
