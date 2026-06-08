import express from 'express';
import { CONFIG } from './config.js';
import { fetchSuiPrice, analysePrice } from './pyth.js';
import { fetchProtocolState, fetchGuardianEnabled } from './chain.js';
import { computeRiskScore, actionForScore } from './scorer.js';
import { executePause, executeTightenLtv, shouldAct, resetLastAction } from './executor.js';
import { storeAuditBlob } from './walrus.js';
import { log } from './logger.js';

// ── State shared between both polling loops ────────────────────────────────
let latestPriceAnalysis = { deviationPct: 0, isStale: false, staleSecs: 0, price: 0, twap: 0 };
let latestChainState    = { poolBalance: 0, ltvRatio: 8000, paused: false, poolDropPct: 0 };
let latestScore         = 0;
let guardianEnabled     = true;
let executing           = false; // simple mutex to prevent concurrent tx submissions

// ── Pyth polling loop ──────────────────────────────────────────────────────
async function pollPyth() {
  try {
    const reading       = await fetchSuiPrice();
    latestPriceAnalysis = analysePrice(reading);
    log.info(`Pyth SUI/USD $${latestPriceAnalysis.price.toFixed(4)} | dev ${latestPriceAnalysis.deviationPct.toFixed(2)}% | stale ${latestPriceAnalysis.isStale}`);
  } catch (err) {
    log.warn(`Pyth poll failed: ${err.message}`);
  }
}

// ── Chain polling loop ─────────────────────────────────────────────────────
async function pollChain() {
  try {
    [latestChainState, guardianEnabled] = await Promise.all([
      fetchProtocolState(),
      fetchGuardianEnabled(),
    ]);
    log.info(`Chain | paused=${latestChainState.paused} ltv=${latestChainState.ltvRatio} poolDrop=${latestChainState.poolDropPct.toFixed(2)}% guardian=${guardianEnabled}`);
  } catch (err) {
    log.warn(`Chain poll failed: ${err.message}`);
  }
}

// ── Decision loop — runs after every chain poll ────────────────────────────
async function decide() {
  if (!guardianEnabled) {
    log.info('Guardian disabled on-chain — skipping decision.');
    resetLastAction();
    return;
  }

  if (executing) {
    log.info('Transaction in progress — skipping decision tick.');
    return;
  }

  const { score, signals, reason } = computeRiskScore(latestPriceAnalysis, latestChainState);
  latestScore = score;

  log.info(`Risk score: ${score} | signals: ${signals.join(', ') || 'none'}`);

  const action = actionForScore(score, CONFIG.thresholds);

  if (action === 'log') return;

  if (action === 'notify') {
    log.warn(`NOTIFY — score ${score}: ${reason}`);
    return;
  }

  if (!shouldAct(score, action, CONFIG.thresholds)) {
    log.info(`Suppressed repeated ${action} at score ${score}.`);
    return;
  }

  // ── Execute on-chain action ──────────────────────────────────────────────
  executing = true;

  try {
    let result;

    if (action === 'pause') {
      result = await executePause(score, reason);
    } else if (action === 'tighten_ltv') {
      // Tighten to 70% (7000 bps) if currently above that
      const newLtv = Math.min(latestChainState.ltvRatio - 500, 7000);
      result       = await executeTightenLtv(score, reason, newLtv);
    }

    if (result) {
      await storeAuditBlob({
        digest:       result.digest,
        action:       result.actionType,
        riskScore:    score,
        reason,
        signals,
        priceUsd:     latestPriceAnalysis.price,
        priceTwap:    latestPriceAnalysis.twap,
        deviationPct: latestPriceAnalysis.deviationPct,
        poolBalance:  latestChainState.poolBalance,
        ltvRatio:     latestChainState.ltvRatio,
      });
    }
  } catch (err) {
    log.error(`Execution failed: ${err.message}`);
  } finally {
    executing = false;
  }
}

// ── Health / status API ────────────────────────────────────────────────────
const app = express();

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', guardianEnabled, latestScore });
});

app.get('/status', (_req, res) => {
  res.json({
    score:    latestScore,
    guardian: guardianEnabled,
    price:    latestPriceAnalysis,
    chain:    latestChainState,
  });
});

// ── Startup ────────────────────────────────────────────────────────────────
log.info('GuardianAI backend starting…');
log.info(`Package:  ${CONFIG.packageId}`);
log.info(`Protocol: ${CONFIG.protocolId}`);

// Initial polls
await pollPyth();
await pollChain();
await decide();

// Recurring polls
setInterval(pollPyth,  CONFIG.intervals.pyth);
setInterval(async () => {
  await pollChain();
  await decide();
}, CONFIG.intervals.chain);

app.listen(CONFIG.port, () => {
  log.info(`Health server listening on port ${CONFIG.port}`);
});
