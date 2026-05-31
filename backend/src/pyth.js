import fetch from 'node-fetch';

// SUI/USD price feed ID on Pyth Network
const SUI_USD_FEED_ID = '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744';
const HERMES_URL      = 'https://hermes.pyth.network';

// Rolling window for TWAP calculation (keeps last N readings)
const PRICE_HISTORY_SIZE = 20;
const priceHistory = [];

export async function fetchSuiPrice() {
  const url = `${HERMES_URL}/v2/updates/price/latest?ids[]=${SUI_USD_FEED_ID}`;
  const res  = await fetch(url, { signal: AbortSignal.timeout(5_000) });

  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`);

  const body   = await res.json();
  const parsed = body.parsed?.[0];
  if (!parsed) throw new Error('Pyth: no parsed price data');

  const { price, conf, expo, publish_time } = parsed.price;
  const usdPrice    = Number(price) * Math.pow(10, expo);
  const confidence  = Number(conf)  * Math.pow(10, expo);
  const publishTime = Number(publish_time);

  return { usdPrice, confidence, publishTime };
}

// Returns { price, twap, deviationPct, staleSecs, isStale }
export function analysePrice(reading) {
  const now = Math.floor(Date.now() / 1000);

  priceHistory.push(reading.usdPrice);
  if (priceHistory.length > PRICE_HISTORY_SIZE) priceHistory.shift();

  const twap = priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
  const deviationPct = twap > 0 ? Math.abs((reading.usdPrice - twap) / twap) * 100 : 0;
  const staleSecs    = now - reading.publishTime;
  const isStale      = staleSecs > 30;

  return { price: reading.usdPrice, twap, deviationPct, staleSecs, isStale };
}
