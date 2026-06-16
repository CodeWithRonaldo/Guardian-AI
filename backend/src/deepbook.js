import { Transaction } from '@mysten/sui/transactions';
import { client } from './chain.js';
import { log } from './logger.js';

const DEEPBOOK_PKG = '0xfb28c4cbc6865bd1c897d26aecbe1f8792d1509a20ffec692c800660cbec6982';
const SUI_DBUSDC_POOL = '0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5';
const CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

const SUI_TYPE    = '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI';
const DBUSDC_TYPE = '0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC';

// Deepbook v3 stores prices as:
//   stored_price = quote_smallest_units / base_smallest_units * FLOAT_SCALING (1e9)
// For SUI (9 decimals) / DBUSDC (6 decimals):
//   human_price = stored_price * 10^9 / 10^6 / 10^9 = stored_price / 1_000_000
const PRICE_DIVISOR = 1_000_000;

export async function fetchDeepbookMidPrice() {
  const tx = new Transaction();
  tx.moveCall({
    target: `${DEEPBOOK_PKG}::pool::mid_price`,
    typeArguments: [SUI_TYPE, DBUSDC_TYPE],
    arguments: [tx.object(SUI_DBUSDC_POOL), tx.object(CLOCK_ID)],
  });

  const result = await client.devInspectTransactionBlock({
    transactionBlock: tx,
    sender: '0x0000000000000000000000000000000000000000000000000000000000000000',
  });

  if (result.effects?.status?.status !== 'success') {
    throw new Error(`devInspect failed: ${JSON.stringify(result.effects?.status)}`);
  }

  const returnValue = result.results?.[0]?.returnValues?.[0];
  if (!returnValue) throw new Error('mid_price returned no value');

  const [bytes] = returnValue;
  const rawPrice = Buffer.from(bytes).readBigUInt64LE(0);
  if (rawPrice === 0n) throw new Error('mid_price returned 0 — pool may have no orders');

  const usdPrice = Number(rawPrice) / PRICE_DIVISOR;
  log.info(`Deepbook SUI/DBUSDC mid-price: $${usdPrice.toFixed(4)} (raw ${rawPrice})`);
  return usdPrice;
}
