import fetch from 'node-fetch';
import { CONFIG } from './config.js';
import { log } from './logger.js';

// Stores a JSON audit record to Walrus and returns the blob ID.
// Non-fatal — if Walrus write fails, the on-chain ActionLog is the source of truth.
export async function storeAuditBlob(record) {
  try {
    const body = JSON.stringify({ ...record, storedAt: new Date().toISOString() });

    const res = await fetch(`${CONFIG.walrusPublisher}/v1/blobs`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal:  AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      log.warn(`Walrus PUT failed: HTTP ${res.status}`);
      return null;
    }

    const data   = await res.json();
    const blobId = data?.newlyCreated?.blobObject?.blobId
                ?? data?.alreadyCertified?.blobId
                ?? null;

    if (blobId) log.info(`Walrus blob stored: ${blobId}`);
    return blobId;
  } catch (err) {
    log.warn(`Walrus write skipped: ${err.message}`);
    return null;
  }
}
