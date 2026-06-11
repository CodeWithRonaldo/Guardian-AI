// Rule-based risk scoring engine.
// Each signal contributes a weighted score. Total is capped at 100.
// Weights are tuned for testnet demo — adjust before mainnet.

const WEIGHTS = {
  priceDeviation:  30,  // Pyth price deviates >10% from TWAP
  priceDevSmall:   15,  // Pyth price deviates 3-10% from TWAP
  oracleStale:     20,  // Pyth publish_time > 30s ago
  poolDrop50:      55,  // Pool balance dropped >50% since last poll — critical drain
  poolDrop20:      35,  // Pool balance dropped >20% since last poll
  poolDrop5:       15,  // Pool balance dropped 5-20%
  poolAbsLow:      90,  // Pool balance critically low (<5% of baseline) — pause-level on its own
  alreadyPaused:   10,  // Protocol paused flag already set on-chain
};

// Baseline pool balance set at launch of the test_protocol (10_000 SUI in MIST)
const POOL_BASELINE_MIST = 10_000_000_000_000;

export function computeRiskScore(priceAnalysis, chainState) {
  const signals = [];
  let score = 0;

  function add(weight, label) {
    score += weight;
    signals.push(label);
  }

  // ── Price deviation ──────────────────────────────
  if (priceAnalysis.deviationPct > 10) {
    add(WEIGHTS.priceDeviation, `Price deviation ${priceAnalysis.deviationPct.toFixed(1)}% from TWAP`);
  } else if (priceAnalysis.deviationPct > 3) {
    add(WEIGHTS.priceDevSmall, `Price deviation ${priceAnalysis.deviationPct.toFixed(1)}% from TWAP`);
  }

  // ── Oracle staleness ─────────────────────────────
  if (priceAnalysis.isStale) {
    add(WEIGHTS.oracleStale, `Oracle stale: ${priceAnalysis.staleSecs}s since last update`);
  }

  // ── Pool balance drop (delta) ────────────────────
  if (chainState.poolDropPct > 50) {
    add(WEIGHTS.poolDrop50, `Pool balance dropped ${chainState.poolDropPct.toFixed(1)}% this interval`);
  } else if (chainState.poolDropPct > 20) {
    add(WEIGHTS.poolDrop20, `Pool balance dropped ${chainState.poolDropPct.toFixed(1)}% this interval`);
  } else if (chainState.poolDropPct > 5) {
    add(WEIGHTS.poolDrop5, `Pool balance dropped ${chainState.poolDropPct.toFixed(1)}% this interval`);
  }

  // ── Pool balance absolute low ────────────────────
  // Catches a drained pool even when the backend restarts after the drain.
  const poolPct = (chainState.poolBalance / POOL_BASELINE_MIST) * 100;
  if (poolPct <= 5) {
    add(WEIGHTS.poolAbsLow, `Pool critically low: ${poolPct.toFixed(2)}% of baseline (${(chainState.poolBalance / 1e9).toFixed(2)} SUI)`);
  }

  // ── Protocol already paused ──────────────────────
  if (chainState.paused) {
    add(WEIGHTS.alreadyPaused, 'Protocol is already paused on-chain');
  }

  return {
    score:   Math.min(score, 100),
    signals,
    reason:  signals.join('; ') || 'No active signals',
  };
}

export function actionForScore(score, thresholds) {
  if (score >= thresholds.pause)      return 'pause';
  if (score >= thresholds.tightenLtv) return 'tighten_ltv';
  if (score >= thresholds.notify)     return 'notify';
  return 'log';
}
