import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { bcs } from '@mysten/sui/bcs';
import { client } from './chain.js';
import { CONFIG } from './config.js';
import { log } from './logger.js';

// Clock object is a well-known shared object on all Sui networks
const CLOCK_ID = '0x0000000000000000000000000000000000000000000000000000000000000006';

// Supports three private key formats:
//   suiprivkey1...  — Sui CLI bech32 export
//   0x<64 hex>      — browser wallet hex export
//   <64 hex>        — raw hex without 0x prefix
function loadKeypair(raw) {
  const key = raw.trim();
  if (key.startsWith('suiprivkey1')) {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const hex = key.startsWith('0x') ? key.slice(2) : key;
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(hex, 'hex')));
  }
  // Fall back: try base64
  return Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(key, 'base64')));
}

const keypair = loadKeypair(CONFIG.agentPrivateKey);

// Track the last action taken to avoid repeatedly firing at the same score
let lastActionScore = -1;
let lastActionType  = null;

export function shouldAct(score, actionType, thresholds) {
  // Don't fire the same action twice in a row at the same or lower score
  if (actionType === lastActionType && score <= lastActionScore) return false;
  // Don't tighten LTV if already paused
  if (actionType === 'tighten_ltv' && lastActionType === 'pause') return false;
  return true;
}

export async function executePause(riskScore, reason) {
  const tx = new Transaction();

  tx.moveCall({
    target:    `${CONFIG.packageId}::test_protocol::pause_protocol`,
    arguments: [
      tx.object(CONFIG.guardianCapId),
      tx.object(CONFIG.guardianConfigId),
      tx.object(CONFIG.protocolId),
      tx.object(CONFIG.actionLogId),
      tx.object(CLOCK_ID),
      tx.pure(bcs.u8().serialize(riskScore)),
      tx.pure(bcs.string().serialize(reason)),
    ],
  });

  return submitTx(tx, 'pause', riskScore);
}

export async function executeTightenLtv(riskScore, reason, newLtv) {
  const tx = new Transaction();

  tx.moveCall({
    target:    `${CONFIG.packageId}::test_protocol::tighten_ltv`,
    arguments: [
      tx.object(CONFIG.guardianCapId),
      tx.object(CONFIG.guardianConfigId),
      tx.object(CONFIG.protocolId),
      tx.object(CONFIG.actionLogId),
      tx.object(CLOCK_ID),
      tx.pure(bcs.u64().serialize(BigInt(newLtv))),
      tx.pure(bcs.u8().serialize(riskScore)),
      tx.pure(bcs.string().serialize(reason)),
    ],
  });

  return submitTx(tx, 'tighten_ltv', riskScore);
}

async function submitTx(tx, actionType, riskScore) {
  log.info(`Submitting ${actionType} transaction (score=${riskScore})…`);

  const result = await client.signAndExecuteTransaction({
    signer:      keypair,
    transaction: tx,
    options:     { showEffects: true },
  });

  const digest = result.digest;
  const status = result.effects?.status?.status;

  if (status !== 'success') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.effects?.status)}`);
  }

  log.info(`✓ ${actionType} confirmed — digest: ${digest}`);

  lastActionScore = riskScore;
  lastActionType  = actionType;

  return { digest, actionType, riskScore };
}

export function resetLastAction() {
  lastActionScore = -1;
  lastActionType  = null;
}
