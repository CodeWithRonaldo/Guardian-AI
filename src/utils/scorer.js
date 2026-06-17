// Mirrors the weight constants in backend/src/scorer.js.
// Keep these in sync if you change the backend weights.
const WEIGHTS = {
  priceDeviation: 30,
  priceDevSmall:  15,
  oracleStale:    20,
  poolDrop50:     55,
  poolDrop20:     35,
  poolDrop5:      15,
};

// Computes a 0-100 risk score from the three signals the simulation injects.
// Matches the backend scorer for these signals — does not include z-score,
// Deepbook divergence, or pool absolute-low (no real data available in sim).
export function computeSimScore({ priceDevPct, poolDropPct, oracleStale }) {
  let score = 0;

  if (priceDevPct > 10)       score += WEIGHTS.priceDeviation;
  else if (priceDevPct > 3)   score += WEIGHTS.priceDevSmall;

  if (poolDropPct > 50)       score += WEIGHTS.poolDrop50;
  else if (poolDropPct > 20)  score += WEIGHTS.poolDrop20;
  else if (poolDropPct > 5)   score += WEIGHTS.poolDrop5;

  if (oracleStale)            score += WEIGHTS.oracleStale;

  return Math.min(score, 100);
}
