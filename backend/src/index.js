import express from 'express';
import fetch from 'node-fetch';
import { CONFIG } from './config.js';
import { fetchSuiPrice, analysePrice } from './pyth.js';
import { fetchProtocolState, fetchGuardianEnabled } from './chain.js';
import { computeRiskScore, actionForScore } from './scorer.js';
import { executePause, executeTightenLtv, shouldAct, resetLastAction } from './executor.js';
import { storeAuditBlob } from './walrus.js';
import { log } from './logger.js';

// ── Mutable runtime config ─────────────────────────────────────────────────
let currentThresholds   = { ...CONFIG.thresholds };
let currentLtvTightenBps = 500;   // how many bps to reduce LTV when tighten fires
let currentWebhookUrl   = '';     // POST target for notify-level alerts

// ── Polling state ──────────────────────────────────────────────────────────
let latestPriceAnalysis = { deviationPct: 0, isStale: false, staleSecs: 0, price: 0, twap: 0 };
let latestChainState    = { poolBalance: 0, ltvRatio: 8000, paused: false, poolDropPct: 0 };
let latestScore         = 0;
let guardianEnabled     = true;
let executing           = false;

// ── Webhook notification ───────────────────────────────────────────────────
// Generic JSON payload — works with Discord, Slack, and any HTTP endpoint.
// Discord webhooks also accept the `content` field directly.
async function sendWebhook(score, reason, signals) {
  if (!currentWebhookUrl) return;
  try {
    const isDiscord = currentWebhookUrl.includes('discord.com/api/webhooks');
    const timestamp = new Date().toISOString();

    const payload = isDiscord
      ? {
          content: `🚨 **GuardianAI Alert** — Risk score **${score}**\n> ${reason}`,
          embeds: [{
            title:  'Active Signals',
            color:  score >= 85 ? 0xff3b5c : score >= 70 ? 0xf07830 : 0xf5a623,
            fields: signals.map(s => ({ name: '▸', value: s, inline: false })),
            footer: { text: `GuardianAI · ${timestamp}` },
          }],
        }
      : {
          source:    'GuardianAI',
          riskScore: score,
          reason,
          signals,
          timestamp,
        };

    await fetch(currentWebhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(6_000),
    });
    log.info('Webhook notification sent.');
  } catch (err) {
    log.warn(`Webhook failed: ${err.message}`);
  }
}

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

// ── Decision loop ──────────────────────────────────────────────────────────
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

  const action = actionForScore(score, currentThresholds);

  if (action === 'log') return;

  if (action === 'notify') {
    log.warn(`NOTIFY — score ${score}: ${reason}`);
    await sendWebhook(score, reason, signals);
    return;
  }

  if (!shouldAct(score, action, currentThresholds)) {
    log.info(`Suppressed repeated ${action} at score ${score}.`);
    return;
  }

  executing = true;

  try {
    let result;

    if (action === 'pause') {
      await sendWebhook(score, `PAUSE triggered — ${reason}`, signals);
      result = await executePause(score, reason);
    } else if (action === 'tighten_ltv') {
      const newLtv = Math.max(latestChainState.ltvRatio - currentLtvTightenBps, 1000);
      await sendWebhook(score, `LTV tightened to ${(newLtv / 100).toFixed(0)}% — ${reason}`, signals);
      result = await executeTightenLtv(score, reason, newLtv);
    }

    if (result) {
      await storeAuditBlob({
        digest:          result.digest,
        action:          result.actionType,
        riskScore:       score,
        reason,
        signals,
        priceUsd:        latestPriceAnalysis.price,
        priceTwap:       latestPriceAnalysis.twap,
        deviationPct:    latestPriceAnalysis.deviationPct,
        poolBalance:     latestChainState.poolBalance,
        ltvRatio:        latestChainState.ltvRatio,
        ltvTightenBps:   currentLtvTightenBps,
      });
    }
  } catch (err) {
    log.error(`Execution failed: ${err.message}`);
  } finally {
    executing = false;
  }
}

// ── API ────────────────────────────────────────────────────────────────────
const app = express();

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.options('*', (_req, res) => res.sendStatus(204));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', guardianEnabled, latestScore });
});

app.get('/status', (_req, res) => {
  res.json({
    score:      latestScore,
    guardian:   guardianEnabled,
    price:      latestPriceAnalysis,
    chain:      latestChainState,
    thresholds: currentThresholds,
    config: {
      thresholds:     currentThresholds,
      ltvTightenBps:  currentLtvTightenBps,
      webhookUrl:     currentWebhookUrl ? '(set)' : '',
    },
  });
});

// Update all runtime config in one call
app.post('/config', (req, res) => {
  const { thresholds, ltvTightenBps, webhookUrl } = req.body ?? {};

  // ── Validate thresholds ──
  if (thresholds !== undefined) {
    const { notify, tightenLtv, pause } = thresholds;
    if (typeof notify !== 'number' || typeof tightenLtv !== 'number' || typeof pause !== 'number') {
      return res.status(400).json({ error: 'Thresholds must be numbers.' });
    }
    if (!(notify < tightenLtv && tightenLtv < pause)) {
      return res.status(400).json({ error: 'Must satisfy: notify < tightenLtv < pause.' });
    }
    if (notify < 1 || pause > 99) {
      return res.status(400).json({ error: 'Values must be between 1 and 99.' });
    }
    currentThresholds = { notify, tightenLtv, pause };
  }

  // ── Validate LTV tighten amount ──
  if (ltvTightenBps !== undefined) {
    if (typeof ltvTightenBps !== 'number' || ltvTightenBps < 100 || ltvTightenBps > 5000) {
      return res.status(400).json({ error: 'ltvTightenBps must be between 100 and 5000.' });
    }
    currentLtvTightenBps = ltvTightenBps;
  }

  // ── Validate webhook URL ──
  if (webhookUrl !== undefined) {
    if (webhookUrl !== '' && !webhookUrl.startsWith('http')) {
      return res.status(400).json({ error: 'webhookUrl must be a valid HTTP/HTTPS URL.' });
    }
    currentWebhookUrl = webhookUrl;
  }

  log.info(`Config updated → thresholds=${JSON.stringify(currentThresholds)} ltvTightenBps=${currentLtvTightenBps} webhook=${currentWebhookUrl ? 'set' : 'none'}`);

  res.json({
    ok: true,
    config: {
      thresholds:    currentThresholds,
      ltvTightenBps: currentLtvTightenBps,
      webhookUrl:    currentWebhookUrl ? '(set)' : '',
    },
  });
});

// ── Startup ────────────────────────────────────────────────────────────────
log.info('GuardianAI backend starting…');
log.info(`Package:  ${CONFIG.packageId}`);
log.info(`Protocol: ${CONFIG.protocolId}`);

await pollPyth();
await pollChain();
await decide();

setInterval(pollPyth, CONFIG.intervals.pyth);
setInterval(async () => {
  await pollChain();
  await decide();
}, CONFIG.intervals.chain);

app.listen(CONFIG.port, () => {
  log.info(`Health server listening on port ${CONFIG.port}`);
});
