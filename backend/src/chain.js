import { SuiClient } from '@mysten/sui/client';
import { CONFIG } from './config.js';

export const client = new SuiClient({ url: CONFIG.suiRpcUrl });

// Previous pool balance snapshot — used to compute delta between polls
let prevPoolBalance = null;

export async function fetchProtocolState() {
  const obj = await client.getObject({
    id:      CONFIG.protocolId,
    options: { showContent: true },
  });

  const fields = obj.data?.content?.fields;
  if (!fields) throw new Error('Could not read Protocol object');

  const poolBalance = Number(fields.pool_balance);
  const ltvRatio    = Number(fields.ltv_ratio);
  const paused      = Boolean(fields.paused);

  // Pool balance delta since last poll
  let poolDropPct = 0;
  if (prevPoolBalance !== null && prevPoolBalance > 0) {
    const drop = prevPoolBalance - poolBalance;
    poolDropPct = (drop / prevPoolBalance) * 100;
  }
  prevPoolBalance = poolBalance;

  return { poolBalance, ltvRatio, paused, poolDropPct };
}

export async function fetchGuardianEnabled() {
  const obj = await client.getObject({
    id:      CONFIG.guardianConfigId,
    options: { showContent: true },
  });

  const fields = obj.data?.content?.fields;
  if (!fields) throw new Error('Could not read GuardianConfig object');

  return Boolean(fields.enabled);
}
